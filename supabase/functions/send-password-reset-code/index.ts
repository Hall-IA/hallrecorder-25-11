import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Créer le client Supabase avec service_role
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

    // Vérifier si l'utilisateur existe
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', userError);
      return new Response(
        JSON.stringify({ error: 'Erreur serveur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      // Par sécurité, on renvoie toujours un succès même si l'email n'existe pas
      // (pour éviter l'énumération d'emails)
      console.log('⚠️ Email non trouvé:', email);
      return new Response(
        JSON.stringify({ success: true, message: 'Si votre email existe, vous recevrez un code de réinitialisation.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer un code aléatoire de 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expiration dans 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Invalider tous les codes précédents pour cet email
    await supabaseAdmin
      .from('password_reset_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // Insérer le nouveau code
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_codes')
      .insert({
        user_id: user.id,
        email: email,
        code: code,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
      console.error('❌ Erreur lors de l\'insertion du code:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur serveur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Envoyer l'email avec Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de votre mot de passe</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #FFF7ED 0%, #FED7AA 100%);">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; background: white; border-radius: 24px; box-shadow: 0 10px 40px rgba(251, 146, 60, 0.15); overflow: hidden;">

          <!-- Header avec dégradé -->
          <tr>
            <td style="background: linear-gradient(135deg, #FB923C 0%, #F97316 100%); padding: 48px 40px; text-align: center;">
              <h1 style="color: white; font-size: 32px; margin: 0 0 12px 0; font-weight: 700;">
                🔐 Réinitialisation du mot de passe
              </h1>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 0; font-weight: 500;">
                HALL Recorder
              </p>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td style="padding: 48px 40px;">
              <p style="color: #78350F; font-size: 18px; line-height: 1.6; margin: 0 0 24px 0; font-weight: 500;">
                Bonjour,
              </p>

              <p style="color: #92400E; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                Vous avez demandé à réinitialiser votre mot de passe. Voici votre code de vérification :
              </p>

              <!-- Code OTP stylisé -->
              <table role="presentation" style="width: 100%; margin: 0 0 32px 0;">
                <tr>
                  <td align="center">
                    <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border: 3px solid #FB923C; border-radius: 16px; padding: 32px; display: inline-block;">
                      <p style="color: #92400E; font-size: 14px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Votre code de vérification
                      </p>
                      <p style="color: #F97316; font-size: 48px; font-weight: 800; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${code}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Informations importantes -->
              <div style="background: #FFF7ED; border-left: 4px solid #FB923C; border-radius: 8px; padding: 20px 24px; margin: 0 0 32px 0;">
                <p style="color: #92400E; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
                  ⏱️ <strong>Ce code expire dans 15 minutes</strong>
                </p>
                <p style="color: #92400E; font-size: 14px; line-height: 1.6; margin: 0;">
                  🔒 <strong>Usage unique</strong> - Ce code ne peut être utilisé qu'une seule fois
                </p>
              </div>

              <p style="color: #92400E; font-size: 16px; line-height: 1.6; margin: 0;">
                Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email. Votre mot de passe reste inchangé.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FFF7ED; padding: 32px 40px; border-top: 2px solid #FFEDD5;">
              <p style="color: #92400E; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0; text-align: center;">
                Besoin d'aide ? Contactez-nous à
                <a href="mailto:support@help.hallia.ai" style="color: #F97316; text-decoration: none; font-weight: 600;">
                  support@help.hallia.ai
                </a>
              </p>
              <p style="color: #A8A29E; font-size: 12px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} HALL Recorder - Tous droits réservés
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    try {
      await resend.emails.send({
        from: 'HALL Recorder <support@help.hallia.ai>',
        to: [email],
        subject: '🔐 Code de réinitialisation de mot de passe - HALL Recorder',
        html: htmlBody,
      });

      console.log('✅ Email envoyé avec succès à:', email);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Un code de vérification a été envoyé à votre adresse email.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emailError) {
      console.error('❌ Erreur lors de l\'envoi de l\'email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'envoi de l\'email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
