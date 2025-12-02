import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        const session = stripeData as Stripe.Checkout.Session;
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
          metadata,
        } = session;

        // Check if this is a plan upgrade payment
        if (metadata?.type === 'plan_upgrade') {
          console.info(`Processing plan upgrade payment for session: ${checkout_session_id}`);
          await handlePlanUpgradePayment(session);
          return;
        }

        // Insert the order into the stripe_orders table (for other one-time payments)
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed',
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

// Handle plan upgrade payment after successful checkout
async function handlePlanUpgradePayment(session: Stripe.Checkout.Session) {
  const { metadata, customer: customerId, amount_total } = session;
  
  if (!metadata || !customerId || typeof customerId !== 'string') {
    console.error('Missing metadata or customer for upgrade payment');
    return;
  }

  const {
    user_id: userId,
    new_plan: newPlan,
    subscription_id: subscriptionId,
    subscription_item_id: subscriptionItemId,
    new_price_id: newPriceId,
  } = metadata;

  console.log(`Processing upgrade for user ${userId}: upgrading to ${newPlan}`);
  console.log(`Subscription: ${subscriptionId}, Item: ${subscriptionItemId}, New Price: ${newPriceId}`);
  console.log(`Amount paid (with tax): ${(amount_total || 0) / 100} EUR`);

  try {
    // Step 1: Update the subscription in Stripe
    console.log('Step 1: Updating subscription in Stripe...');
    
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscriptionItemId,
        price: newPriceId,
      }],
      proration_behavior: 'none', // No proration - already paid via checkout
    });

    console.log(`✓ Updated subscription ${updatedSubscription.id} to price ${newPriceId}`);

    // Step 2: Update user_subscriptions in database
    console.log('Step 2: Updating database...');
    
    const billingCycleStart = new Date(updatedSubscription.current_period_start * 1000).toISOString();
    const billingCycleEnd = new Date(updatedSubscription.current_period_end * 1000).toISOString();

    const { error: updateSubError } = await supabase.from('user_subscriptions').update({
      plan_type: newPlan,
      minutes_quota: newPlan === 'starter' ? 600 : null,
      stripe_price_id: newPriceId,
      billing_cycle_start: billingCycleStart,
      billing_cycle_end: billingCycleEnd,
      pending_downgrade_plan: null, // Clear any pending downgrade
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    if (updateSubError) {
      console.error('Error updating user_subscriptions:', updateSubError);
      throw new Error('Failed to update user_subscriptions');
    }

    // Step 3: Update stripe_subscriptions in database
    const { error: updateStripeSubError } = await supabase.from('stripe_subscriptions').update({
      price_id: newPriceId,
      current_period_start: updatedSubscription.current_period_start,
      current_period_end: updatedSubscription.current_period_end,
      updated_at: new Date().toISOString(),
    }).eq('customer_id', customerId);

    if (updateStripeSubError) {
      console.error('Error updating stripe_subscriptions:', updateStripeSubError);
    }

    console.info(`✓ Successfully processed upgrade for user ${userId} to plan ${newPlan}`);
    console.info(`Amount paid: ${(amount_total || 0) / 100} EUR (includes tax)`);

  } catch (error) {
    console.error('Error processing upgrade payment:', error);
    throw error;
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
      return;
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;

    // Map price IDs to plan types (using environment variables)
    const STRIPE_PRICE_STARTER = Deno.env.get('STRIPE_PRICE_STARTER')!;
    const STRIPE_PRICE_UNLIMITED = Deno.env.get('STRIPE_PRICE_UNLIMITED')!;
    
    const PRICE_ID_MAP: Record<string, 'starter' | 'unlimited'> = {
      [STRIPE_PRICE_STARTER]: 'starter',
      [STRIPE_PRICE_UNLIMITED]: 'unlimited',
    };

    const planType = PRICE_ID_MAP[priceId];

    // store subscription state in stripe_subscriptions
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: priceId,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);

    // Get user_id from stripe_customers
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (customerError || !customerData) {
      console.error('Error fetching user_id for customer:', customerError);
      throw new Error('Failed to fetch user_id for customer');
    }

    const userId = customerData.user_id;
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    // Update user_subscriptions table
    if (planType) {
      const billingCycleStart = new Date(subscription.current_period_start * 1000).toISOString();
      const billingCycleEnd = new Date(subscription.current_period_end * 1000).toISOString();

      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('plan_type, pending_downgrade_plan')
        .eq('user_id', userId)
        .maybeSingle();

      let pendingDowngrade = existingSub?.pending_downgrade_plan;

      if (existingSub && existingSub.pending_downgrade_plan === planType) {
        console.info(`Applying scheduled downgrade to ${planType} for user: ${userId}`);
        pendingDowngrade = null;
      }

      const { error: userSubError } = await supabase.from('user_subscriptions').upsert(
        {
          user_id: userId,
          plan_type: planType,
          minutes_quota: planType === 'starter' ? 600 : null,
          billing_cycle_start: billingCycleStart,
          billing_cycle_end: billingCycleEnd,
          is_active: isActive,
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          pending_downgrade_plan: pendingDowngrade,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      );

      if (userSubError) {
        console.error('Error updating user_subscriptions:', userSubError);
        throw new Error('Failed to update user_subscriptions in database');
      }

      console.info(`Successfully updated user_subscriptions for user: ${userId}, plan: ${planType}`);
    } else {
      console.warn(`Unknown price_id: ${priceId}, skipping user_subscriptions update`);
    }
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}