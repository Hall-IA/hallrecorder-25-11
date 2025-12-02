import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Price IDs from environment variables
const STRIPE_PRICE_STARTER = Deno.env.get('STRIPE_PRICE_STARTER')!;
const STRIPE_PRICE_UNLIMITED = Deno.env.get('STRIPE_PRICE_UNLIMITED')!;

const PRICE_ID_MAP: Record<string, 'starter' | 'unlimited'> = {
  [STRIPE_PRICE_STARTER]: 'starter',
  [STRIPE_PRICE_UNLIMITED]: 'unlimited',
};

const PLAN_TO_PRICE_ID: Record<'starter' | 'unlimited', string> = {
  starter: STRIPE_PRICE_STARTER,
  unlimited: STRIPE_PRICE_UNLIMITED,
};

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { new_plan } = await req.json();

    if (!new_plan || (new_plan !== 'starter' && new_plan !== 'unlimited')) {
      return new Response(JSON.stringify({ error: 'Invalid plan specified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userSub, error: subError } = await supabase
      .from('user_subscriptions')
      .select('plan_type, stripe_customer_id, stripe_price_id, pending_downgrade_plan')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subError || !userSub) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userSub.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No Stripe customer found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentPlan = userSub.plan_type as 'starter' | 'unlimited';
    const newPlan = new_plan as 'starter' | 'unlimited';

    console.log(`User ${user.id}: Current plan = ${currentPlan}, Requested plan = ${newPlan}`);
    console.log('User subscription data:', JSON.stringify(userSub));

    if (userSub.pending_downgrade_plan) {
      console.log(`User has pending downgrade to ${userSub.pending_downgrade_plan}`);

      if (userSub.pending_downgrade_plan === newPlan) {
        console.error(`User already has pending change to ${newPlan}`);
        return new Response(JSON.stringify({
          error: `Vous avez déjà programmé un changement vers ce plan`,
          current_plan: currentPlan,
          pending_plan: userSub.pending_downgrade_plan
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (newPlan === currentPlan) {
        console.log(`Cancelling pending downgrade to ${userSub.pending_downgrade_plan}`);
        const { error: cancelError } = await supabase
          .from('user_subscriptions')
          .update({ pending_downgrade_plan: null })
          .eq('user_id', user.id);

        if (cancelError) {
          console.error('Error cancelling pending downgrade:', cancelError);
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Changement de plan annulé. Vous restez sur le plan ${currentPlan === 'unlimited' ? 'Illimité' : 'Starter'}.`,
          type: 'cancel'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (currentPlan === newPlan) {
      console.error(`User already on ${currentPlan} plan, cannot change to same plan`);
      return new Response(JSON.stringify({
        error: 'Already on this plan',
        current_plan: currentPlan,
        requested_plan: newPlan
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isUpgrade = (currentPlan === 'starter' && newPlan === 'unlimited');
    const isDowngrade = (currentPlan === 'unlimited' && newPlan === 'starter');

    const subscriptions = await stripe.subscriptions.list({
      customer: userSub.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscription found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscription = subscriptions.data[0];
    const subscriptionItemId = subscription.items.data[0].id;
    const currentPriceId = subscription.items.data[0].price.id;
    const newPriceId = PLAN_TO_PRICE_ID[newPlan];

    console.log(`Subscription details:`, {
      subscriptionId: subscription.id,
      subscriptionItemId,
      currentPriceId,
      newPriceId,
      currentPlan,
      newPlan
    });

    if (isUpgrade) {
      console.info(`Processing UPGRADE from ${currentPlan} to ${newPlan} for user ${user.id}`);
      
      try {
        // Step 1: Get the prices to calculate the difference dynamically
        console.log('Step 1: Getting price details from Stripe...');
        
        const currentPrice = await stripe.prices.retrieve(currentPriceId);
        const newPrice = await stripe.prices.retrieve(newPriceId);
        
        // Default prices in cents (fallback if Stripe returns null)
        const DEFAULT_PRICES: Record<string, number> = {
          'starter': 3900,   // 39€
          'unlimited': 4900, // 49€
        };
        
        // Get prices from Stripe, with fallback to defaults
        let currentPriceAmount = currentPrice.unit_amount;
        let newPriceAmount = newPrice.unit_amount;
        
        if (!currentPriceAmount || currentPriceAmount === 0) {
          currentPriceAmount = DEFAULT_PRICES[currentPlan];
        }
        if (!newPriceAmount || newPriceAmount === 0) {
          newPriceAmount = DEFAULT_PRICES[newPlan];
        }
        
        const priceDifference = newPriceAmount - currentPriceAmount; // difference in cents (HT)
        
        console.log(`Current price (${currentPlan}): ${currentPriceAmount / 100} EUR HT`);
        console.log(`New price (${newPlan}): ${newPriceAmount / 100} EUR HT`);
        console.log(`Price difference: ${priceDifference / 100} EUR HT`);

        if (priceDifference <= 0) {
          return new Response(JSON.stringify({
            error: 'No price difference to charge for this upgrade',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Step 2: Create a Checkout Session for the upgrade payment
        console.log('Step 2: Creating Checkout Session for upgrade...');
        
        // Get the success/cancel URLs from request or use defaults
        const origin = req.headers.get('origin') || 'https://hallrecorder.com';
        const successUrl = `${origin}/#subscription?upgrade=success`;
        const cancelUrl = `${origin}/#subscription?upgrade=cancelled`;
        
        // Get customer's default payment method if available
        const customer = await stripe.customers.retrieve(userSub.stripe_customer_id);
        const defaultPaymentMethod = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
        
        console.log(`Customer default payment method: ${defaultPaymentMethod || 'none'}`);

        const checkoutSession = await stripe.checkout.sessions.create({
          customer: userSub.stripe_customer_id, // Pre-fill with existing customer
          mode: 'payment', // One-time payment for the difference
          line_items: [
            {
              price_data: {
                currency: 'eur',
                unit_amount: priceDifference, // Dynamic difference in cents (HT)
                tax_behavior: 'exclusive', // TVA added ON TOP of this amount
                product_data: {
                  name: `Upgrade vers le plan ${newPlan === 'unlimited' ? 'Illimité' : 'Starter'}`,
                  description: `Différence de prix entre le plan ${currentPlan === 'starter' ? 'Starter' : 'Illimité'} et le plan ${newPlan === 'unlimited' ? 'Illimité' : 'Starter'}`,
                },
              },
              quantity: 1,
            },
          ],
          // Use saved payment method if available, otherwise collect new one
          payment_method_collection: defaultPaymentMethod ? 'if_required' : 'always',
          // Show saved payment methods
          saved_payment_method_options: {
            payment_method_save: 'enabled',
            allow_redisplay_filters: ['always'],
          },
          // Generate invoice automatically for this payment
          invoice_creation: {
            enabled: true,
            invoice_data: {
              description: `Upgrade - Passage au plan ${newPlan === 'unlimited' ? 'Illimité' : 'Starter'}`,
              metadata: {
                type: 'plan_upgrade',
                user_id: user.id,
                current_plan: currentPlan,
                new_plan: newPlan,
              },
            },
          },
          // Automatic tax calculation (TVA)
          automatic_tax: {
            enabled: true,
          },
          // Collect billing address for tax (only if needed)
          customer_update: {
            address: 'auto',
          },
          // Metadata to identify this as an upgrade payment
          metadata: {
            type: 'plan_upgrade',
            user_id: user.id,
            current_plan: currentPlan,
            new_plan: newPlan,
            subscription_id: subscription.id,
            subscription_item_id: subscriptionItemId,
            new_price_id: newPriceId,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });

        console.log(`✓ Created checkout session ${checkoutSession.id}`);
        console.log(`Checkout URL: ${checkoutSession.url}`);

        // Return the checkout URL - frontend will redirect to it
        return new Response(JSON.stringify({
          success: true,
          type: 'upgrade_checkout',
          checkout_url: checkoutSession.url,
          checkout_session_id: checkoutSession.id,
          message: `Vous allez être redirigé vers la page de paiement pour ${priceDifference / 100}€ HT (+ TVA).`,
          price_difference_ht: priceDifference / 100,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (stripeError: any) {
        console.error(`✗ Stripe API error:`, stripeError);
        throw new Error(`Failed to create upgrade checkout: ${stripeError.message}`);
      }

    } else if (isDowngrade) {
      console.info(`Processing DOWNGRADE from ${currentPlan} to ${newPlan} for user ${user.id}`);

      await stripe.subscriptions.update(subscription.id, {
        items: [{
          id: subscriptionItemId,
          price: newPriceId,
        }],
        proration_behavior: 'none',
        billing_cycle_anchor: 'unchanged',
      });

      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          pending_downgrade_plan: newPlan,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating pending downgrade:', updateError);
        throw new Error('Failed to update pending downgrade');
      }

      const nextBillingDate = new Date(subscription.current_period_end * 1000);
      const formattedDate = nextBillingDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      return new Response(JSON.stringify({
        success: true,
        type: 'downgrade',
        message: `Votre changement vers le plan ${newPlan === 'starter' ? 'Starter' : 'Illimité'} sera appliqué le ${formattedDate}.`,
        effective_date: nextBillingDate.toISOString(),
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid plan change' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error changing subscription plan:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});