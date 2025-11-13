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

const PRICE_ID_MAP: Record<string, 'starter' | 'unlimited'> = {
  'price_1SSyMI14zZqoQtSCb1gqGhke': 'starter',
  'price_1SSyNh14zZqoQtSCqPL9VwTj': 'unlimited',
};

const PLAN_TO_PRICE_ID: Record<'starter' | 'unlimited', string> = {
  starter: 'price_1SSyMI14zZqoQtSCb1gqGhke',
  unlimited: 'price_1SSyNh14zZqoQtSCqPL9VwTj',
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
      .select('plan_type, stripe_customer_id, stripe_price_id')
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

    if (currentPlan === newPlan) {
      return new Response(JSON.stringify({ error: 'Already on this plan' }), {
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
    const newPriceId = PLAN_TO_PRICE_ID[newPlan];

    if (isUpgrade) {
      console.info(`Processing UPGRADE from ${currentPlan} to ${newPlan} for user ${user.id}`);

      const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        items: [{
          id: subscriptionItemId,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      console.info(`Updated subscription ${updatedSubscription.id}, syncing to database...`);

      const billingCycleStart = new Date(updatedSubscription.current_period_start * 1000).toISOString();
      const billingCycleEnd = new Date(updatedSubscription.current_period_end * 1000).toISOString();

      const { error: updateSubError } = await supabase.from('user_subscriptions').update({
        plan_type: newPlan,
        minutes_quota: newPlan === 'starter' ? 600 : null,
        stripe_price_id: newPriceId,
        billing_cycle_start: billingCycleStart,
        billing_cycle_end: billingCycleEnd,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      if (updateSubError) {
        console.error('Error updating user subscription:', updateSubError);
      }

      const { error: updateStripeSubError } = await supabase.from('stripe_subscriptions').update({
        price_id: newPriceId,
        current_period_start: updatedSubscription.current_period_start,
        current_period_end: updatedSubscription.current_period_end,
        updated_at: new Date().toISOString(),
      }).eq('customer_id', userSub.stripe_customer_id);

      if (updateStripeSubError) {
        console.error('Error updating stripe subscription:', updateStripeSubError);
      }

      return new Response(JSON.stringify({
        success: true,
        type: 'upgrade',
        message: `Passage immédiat au plan ${newPlan === 'unlimited' ? 'Illimité' : 'Starter'}. Un prorata a été appliqué automatiquement par Stripe.`,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

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
