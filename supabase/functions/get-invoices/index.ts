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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le customer_id de l'utilisateur
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (customerError || !customerData) {
      return new Response(
        JSON.stringify({ error: 'Client Stripe introuvable', invoices: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les factures depuis Stripe
    const invoices = await stripe.invoices.list({
      customer: customerData.customer_id,
      limit: 100,
    });

    // Formater les factures pour le frontend
    const formattedInvoices = invoices.data.map((invoice) => {
      let description = 'Abonnement';

      if (invoice.lines.data.length > 0) {
        const line = invoice.lines.data[0];
        description = line.description || 'Abonnement';

        if (invoice.lines.data.some(l => l.proration === true)) {
          description = 'Ajustement de prorata - Changement de plan';
        }
      }

      return {
        id: invoice.id,
        number: invoice.number || invoice.id,
        amount: invoice.total / 100,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        created: invoice.created,
        invoice_pdf: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        description,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
      };
    });

    return new Response(
      JSON.stringify({ invoices: formattedInvoices }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erreur lors de la récupération des factures:', error);
    return new Response(
      JSON.stringify({ error: error.message, invoices: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
