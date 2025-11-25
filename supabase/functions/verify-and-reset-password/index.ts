import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Email, code et nouveau mot de passe requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation du mot de passe
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Le mot de passe doit contenir au moins 6 caractères' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Créer le client Supabase avec service_role (Admin API)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Vérifier le code dans la base de données
    const { data: resetCode, error: fetchError } = await supabaseAdmin
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .single();

    if (fetchError || !resetCode) {
      console.error('❌ Code invalide ou déjà utilisé pour:', email);
      return new Response(
        JSON.stringify({ error: 'Code invalide ou expiré' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier si le code n'a pas expiré
    const now = new Date();
    const expiresAt = new Date(resetCode.expires_at);

    if (now > expiresAt) {
      console.error('❌ Code expiré pour:', email);

      // Marquer le code comme utilisé
      await supabaseAdmin
        .from('password_reset_codes')
        .update({ used: true })
        .eq('id', resetCode.id);

      return new Response(
        JSON.stringify({ error: 'Code expiré. Veuillez demander un nouveau code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Utiliser l'Admin API pour changer le mot de passe
    // IMPORTANT: Cette méthode ne crée PAS de session automatique
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resetCode.user_id,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour du mot de passe:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la mise à jour du mot de passe' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Marquer le code comme utilisé
    await supabaseAdmin
      .from('password_reset_codes')
      .update({ used: true })
      .eq('id', resetCode.id);

    // Invalider tous les autres codes pour cet email
    await supabaseAdmin
      .from('password_reset_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    console.log('✅ Mot de passe réinitialisé avec succès pour:', email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Votre mot de passe a été réinitialisé avec succès. Veuillez vous connecter avec votre nouveau mot de passe.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
