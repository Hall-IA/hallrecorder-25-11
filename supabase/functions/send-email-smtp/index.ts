import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.7';
// Fonction pour construire manuellement un message MIME avec images inline
function buildMimeMessage(params) {
  const { from, to, cc, subject, htmlBody, textBody, inlineImages, attachments } = params;
  const boundaryMixed = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const boundaryRelated = `----=_Part_Related_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const boundaryAlternative = `----=_Part_Alt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  let message = '';
  // En-têtes de base
  message += `From: ${from}\r\n`;
  message += `To: ${to.join(', ')}\r\n`;
  if (cc && cc.length > 0) {
    message += `Cc: ${cc.join(', ')}\r\n`;
  }
  message += `Subject: ${subject}\r\n`;
  message += 'MIME-Version: 1.0\r\n';
  const hasInlineImages = inlineImages.length > 0;
  const hasAttachments = attachments && attachments.length > 0;
  if (hasAttachments) {
    // Structure multipart/mixed (attachments + contenu)
    message += `Content-Type: multipart/mixed; boundary="${boundaryMixed}"\r\n\r\n`;
    message += `--${boundaryMixed}\r\n`;
  }
  if (hasInlineImages) {
    // Structure multipart/related (HTML + images inline)
    message += `Content-Type: multipart/related; boundary="${boundaryRelated}"\r\n\r\n`;
    message += `--${boundaryRelated}\r\n`;
  }
  // Structure multipart/alternative (texte + HTML)
  message += `Content-Type: multipart/alternative; boundary="${boundaryAlternative}"\r\n\r\n`;
  // Partie texte
  message += `--${boundaryAlternative}\r\n`;
  message += 'Content-Type: text/plain; charset=UTF-8\r\n';
  message += 'Content-Transfer-Encoding: quoted-printable\r\n\r\n';
  message += `${textBody}\r\n\r\n`;
  // Partie HTML
  message += `--${boundaryAlternative}\r\n`;
  message += 'Content-Type: text/html; charset=UTF-8\r\n';
  message += 'Content-Transfer-Encoding: quoted-printable\r\n\r\n';
  message += `${htmlBody}\r\n\r\n`;
  message += `--${boundaryAlternative}--\r\n`;
  // Images inline
  if (hasInlineImages) {
    for (const img of inlineImages){
      message += `--${boundaryRelated}\r\n`;
      message += `Content-Type: ${img.mimeType}\r\n`;
      message += 'Content-Transfer-Encoding: base64\r\n';
      message += `Content-ID: <${img.cid}>\r\n`;
      message += 'Content-Disposition: inline\r\n\r\n';
      const base64 = btoa(String.fromCharCode(...img.data));
      // Diviser en lignes de 76 caractères (standard MIME)
      const lines = base64.match(/.{1,76}/g) || [];
      message += lines.join('\r\n') + '\r\n\r\n';
    }
    message += `--${boundaryRelated}--\r\n`;
  }
  // Pièces jointes normales
  if (hasAttachments) {
    for (const att of attachments){
      message += `--${boundaryMixed}\r\n`;
      message += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
      message += 'Content-Transfer-Encoding: base64\r\n';
      message += `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n`;
      // Diviser en lignes de 76 caractères
      const lines = att.content.match(/.{1,76}/g) || [];
      message += lines.join('\r\n') + '\r\n\r\n';
    }
    message += `--${boundaryMixed}--\r\n`;
  }
  return message;
}
// Fonction pour télécharger une image et retourner ses données
async function downloadImage(imageUrl, supabaseClient) {
  try {
    console.log('🖼️ Downloading image:', imageUrl);
    // Si c'est une URL Supabase Storage ET qu'on a un client Supabase
    if (imageUrl.includes('/storage/v1/object/') && supabaseClient) {
      console.log('🔐 Using authenticated Supabase download');
      // Extraire le bucket et le path depuis l'URL
      const urlParts = imageUrl.split('/storage/v1/object/');
      if (urlParts.length > 1) {
        const pathParts = urlParts[1].split('/').slice(1); // Skip 'public' or 'sign'
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');
        console.log('🪣 Bucket:', bucket, 'Path:', filePath);
        // Télécharger via Supabase client authentifié
        const { data, error } = await supabaseClient.storage.from(bucket).download(filePath);
        if (error) {
          console.error('❌ Supabase storage error:', error);
          return null;
        }
        if (data) {
          const arrayBuffer = await data.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const mimeType = data.type || 'image/png';
          console.log('✅ Image downloaded successfully:', mimeType, bytes.length, 'bytes');
          return {
            data: bytes,
            mimeType
          };
        }
      }
    }
    // Sinon, fetch normal pour les URLs externes
    console.log('🌐 Using regular fetch');
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status);
      return null;
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const mimeType = blob.type || 'image/png';
    console.log('✅ Image downloaded successfully:', mimeType, bytes.length, 'bytes');
    return {
      data: bytes,
      mimeType
    };
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}
// Fonction pour extraire et remplacer les images par des CID
async function extractInlineImages(html, supabaseClient) {
  const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
  const matches = Array.from(html.matchAll(imgRegex));
  let newHtml = html;
  const inlineImages = [];
  let imageCounter = 0;
  for (const match of matches){
    const fullTag = match[0];
    const beforeSrc = match[1];
    const srcUrl = match[2];
    const afterSrc = match[3];
    if (srcUrl.includes('email-open-tracker')) {
      console.log('🛑 Skipping tracking pixel from inline conversion');
      continue;
    }
    if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
      const imageData = await downloadImage(srcUrl, supabaseClient);
      if (imageData) {
        imageCounter++;
        const cid = `image${imageCounter}@hallia`;
        inlineImages.push({
          cid,
          data: imageData.data,
          mimeType: imageData.mimeType
        });
        // Remplacer l'URL par le CID en préservant les styles
        const newTag = `<img${beforeSrc}src="cid:${cid}"${afterSrc}>`;
        newHtml = newHtml.replace(fullTag, newTag);
        console.log('✅ Replaced image with CID:', cid);
      }
    } else if (srcUrl.startsWith('data:image')) {
      // Convertir data URI en inline attachment
      try {
        const matches = srcUrl.match(/data:([^;]+);base64,(.+)/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for(let i = 0; i < binaryString.length; i++){
            bytes[i] = binaryString.charCodeAt(i);
          }
          imageCounter++;
          const cid = `image${imageCounter}@hallia`;
          inlineImages.push({
            cid,
            data: bytes,
            mimeType
          });
          const newTag = `<img${beforeSrc}src="cid:${cid}"${afterSrc}>`;
          newHtml = newHtml.replace(fullTag, newTag);
          console.log('✅ Converted data URI to CID:', cid);
        }
      } catch (error) {
        console.error('Error converting data URI:', error);
      }
    }
  }
  return {
    html: newHtml,
    inlineImages
  };
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    // Get user from auth token
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }
    // Parse request body
    let emailRequest = await req.json();
    // Extraire les images inline et les convertir en CID (avec authentification Supabase)
    const { html: processedHtml, inlineImages } = await extractInlineImages(emailRequest.htmlBody, supabaseClient);
    emailRequest.htmlBody = processedHtml;
    console.log('📧 Nombre d\'images inline:', inlineImages.length);
    // Verify userId matches authenticated user
    if (emailRequest.userId !== user.id) {
      throw new Error('Unauthorized: User ID mismatch');
    }
    // Get SMTP configuration from user_settings
    const { data: settings, error: settingsError } = await supabaseClient.from('user_settings').select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_password_encrypted, smtp_secure, sender_name, sender_email').eq('user_id', user.id).maybeSingle();
    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error(`Database error: ${settingsError.message}`);
    }
    if (!settings) {
      throw new Error('SMTP configuration not found. Please configure SMTP settings in the Settings page.');
    }
    // Déchiffrer le mot de passe SMTP (priorise encrypted, fallback sur plain text pour rétrocompatibilité)
    let smtpPassword = settings.smtp_password; // Fallback pour anciennes données
    if (settings.smtp_password_encrypted) {
      console.log('🔐 Déchiffrement du mot de passe SMTP...');
      const { data: decryptedData, error: decryptError } = await supabaseClient.rpc('decrypt_smtp_password', {
        encrypted_password: settings.smtp_password_encrypted,
        user_id: user.id
      });
      if (decryptError) {
        console.error('❌ Erreur lors du déchiffrement:', decryptError);
        throw new Error('Failed to decrypt SMTP password');
      }
      smtpPassword = decryptedData;
      console.log('✅ Mot de passe déchiffré avec succès');
    } else {
      console.log('⚠️ Utilisation du mot de passe en clair (ancienne version)');
    }
    if (!settings.smtp_host || !settings.smtp_user || !smtpPassword) {
      throw new Error('SMTP configuration incomplete');
    }
    // Create nodemailer transporter (meilleur support pour images inline)
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: settings.smtp_port === 465,
      auth: {
        user: settings.smtp_user,
        pass: smtpPassword
      }
    });
    console.log('📧 Nombre de pièces jointes:', emailRequest.attachments?.length || 0);
    // Préparer les attachments pour nodemailer
    const attachments = [];
    // Ajouter les images inline avec CID
    for (const img of inlineImages){
      console.log('🖼️ Ajout image inline CID:', img.cid);
      attachments.push({
        filename: img.cid.replace('@hallia', '.png'),
        content: new Uint8Array(img.data),
        contentType: img.mimeType,
        cid: img.cid
      });
    }
    // Ajouter les pièces jointes normales
    if (emailRequest.attachments && emailRequest.attachments.length > 0) {
      for (const att of emailRequest.attachments){
        console.log('📎 Ajout PJ:', att.filename);
        attachments.push({
          filename: att.filename,
          content: att.content.replace(/\s/g, ''),
          contentType: att.contentType,
          encoding: 'base64'
        });
      }
    }
    console.log('📧 Total attachments (inline + PJ):', attachments.length);

    // IMPORTANT: Utiliser smtp_user comme adresse d'expéditeur pour éviter l'erreur 550
    // "Sender address is not allowed" - beaucoup de serveurs SMTP exigent que l'adresse
    // From corresponde exactement à l'utilisateur authentifié
    const fromAddress = settings.smtp_user;
    // Utiliser sender_name si défini, sinon juste l'adresse email (pas de nom par défaut)
    const fromName = settings.sender_name || null;
    const fromHeader = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

    // Si sender_email est différent de smtp_user, l'utiliser comme Reply-To
    const replyTo = settings.sender_email && settings.sender_email !== settings.smtp_user
      ? settings.sender_email
      : undefined;

    console.log('📧 From:', fromHeader);
    if (replyTo) {
      console.log('📧 Reply-To:', replyTo);
    }

    // Envoyer l'email via nodemailer
    const info = await transporter.sendMail({
      from: fromHeader,
      to: emailRequest.to.join(', '),
      cc: emailRequest.cc && emailRequest.cc.length > 0 ? emailRequest.cc.join(', ') : undefined,
      bcc: emailRequest.bcc && emailRequest.bcc.length > 0 ? emailRequest.bcc.join(', ') : undefined,
      replyTo: replyTo,
      subject: emailRequest.subject,
      text: emailRequest.textBody,
      html: emailRequest.htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined
    });
    
    // Log des destinataires pour debug
    console.log('📧 To:', emailRequest.to);
    if (emailRequest.cc && emailRequest.cc.length > 0) {
      console.log('📧 Cc:', emailRequest.cc);
    }
    if (emailRequest.bcc && emailRequest.bcc.length > 0) {
      console.log('📧 Bcc:', emailRequest.bcc);
    }
    console.log('✅ Email envoyé:', info.messageId);
    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to send email'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
})
