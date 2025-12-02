import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
/* ---------- Utils encodage ---------- */ // RFC 2047 pour en-têtes UTF-8 (Subject, etc.)
function encodeHeaderUtf8(value) {
  const b64 = btoa(unescape(encodeURIComponent(value)));
  return `=?UTF-8?B?${b64}?=`;
}
// base64url sans padding, efficace
function base64UrlEncodeBytes(bytes) {
  let binary = '';
  const chunkSize = 0x8000; // ~32KB
  for(let i = 0; i < bytes.length; i += chunkSize){
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
// wrap à 76 colonnes (RFC 2045)
function wrap76(b64) {
  const out = [];
  for(let i = 0; i < b64.length; i += 76)out.push(b64.slice(i, i + 76));
  return out.join('\r\n');
}
// fallback texte brut à partir du HTML
function htmlToTextFallback(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
// Message-ID simple
function makeMessageId(domainHint = 'localhost') {
  const rand = Math.random().toString(36).slice(2);
  const ts = Date.now();
  return `<${rand}.${ts}@${domainHint}>`;
}
function createMimeMessage(opts) {
  const { from, to, cc, bcc, subject, html, attachments, messageIdDomainHint } = opts;
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = boundary + '_ALT';
  const lines = [];
  const date = new Date().toUTCString();
  const subj = encodeHeaderUtf8(subject);
  const msgId = makeMessageId(messageIdDomainHint || (from?.split('@')[1] ?? 'localhost'));
  // En-têtes
  lines.push(`From: ${from ?? 'me'}`); // "me" accepté par Gmail API
  lines.push(`To: ${to}`);
  // Ajouter CC si présent
  if (cc && cc.trim()) {
    lines.push(`Cc: ${cc}`);
  }
  // Ajouter BCC si présent
  if (bcc && bcc.trim()) {
    lines.push(`Bcc: ${bcc}`);
  }
  lines.push(`Subject: ${subj}`);
  lines.push(`Date: ${date}`);
  lines.push(`Message-ID: ${msgId}`);
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push('');
  // Partie alternative (text + html)
  lines.push(`--${boundary}`);
  lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  lines.push('');
  // text/plain
  const textFallback = htmlToTextFallback(html);
  const textB64 = btoa(unescape(encodeURIComponent(textFallback)));
  lines.push(`--${altBoundary}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(wrap76(textB64));
  lines.push('');
  // text/html
  const htmlB64 = btoa(unescape(encodeURIComponent(html)));
  lines.push(`--${altBoundary}`);
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(wrap76(htmlB64));
  lines.push('');
  lines.push(`--${altBoundary}--`);
  lines.push('');
  // Pièces jointes (inclut inline avec Content-ID)
  if (attachments?.length) {
    for (const att of attachments){
      const cleanB64 = att.content.replace(/\r?\n/g, '').replace(/^data:[^;]+;base64,/, '');
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      const disposition = att.inline ? 'inline' : 'attachment';
      lines.push(`Content-Disposition: ${disposition}; filename="${att.filename}"`);
      if (att.inline && att.contentId) {
        lines.push(`Content-ID: <${att.contentId}>`);
      }
      lines.push('');
      lines.push(wrap76(cleanB64));
      lines.push('');
    }
  }
  lines.push(`--${boundary}--`);
  return lines.join('\r\n');
}
/* ---------- OAuth & Gmail send ---------- */ async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!response.ok) throw new Error(`Failed to refresh access token: ${await response.text()}`);
  return await response.json();
}
async function sendGmailMessage(accessToken, message) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error: ${response.status} - ${error}`);
  }
  return await response.json();
}
/* ---------- Handler ---------- */ Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');
    // Payload
    const body = await req.json();
    const { to, cc, bcc, subject, html, attachments, from } = body;
    
    console.log('📧 Gmail - To:', to);
    if (cc) console.log('📧 Gmail - Cc:', cc);
    if (bcc) console.log('📧 Gmail - Bcc:', bcc);
    // Limites côté Edge Function (10 MB cumul PJ)
    if (attachments?.length) {
      if (attachments.length > 10) {
        throw new Error(`Trop de pièces jointes (${attachments.length}). Maximum: 10.`);
      }
      const totalSize = attachments.reduce((sum, att)=>{
        const len = att.content.replace(/\r?\n/g, '').replace(/^data:[^;]+;base64,/, '').length;
        // base64 -> bytes ~ 3/4 (ignorer padding)
        return sum + Math.floor(len * 3 / 4);
      }, 0);
      const maxSize = 10 * 1024 * 1024;
      const totalMB = Math.round(totalSize / 1024 / 1024 * 10) / 10;
      if (totalSize > maxSize) {
        throw new Error(`Les pièces jointes sont trop volumineuses (${totalMB} MB). Limite côté Edge: 10 MB.\n\n` + `Solutions:\n• Réduire/compresser les fichiers\n• Envoyer en plusieurs emails\n• Utiliser un lien (Supabase Storage URL signée, Google Drive, etc.)`);
      }
    }
    // Récupérer/rafraîchir tokens Gmail
    const { data: settings, error: settingsError } = await supabase.from('user_settings').select('gmail_access_token, gmail_refresh_token, gmail_token_expiry, gmail_connected').eq('user_id', user.id).maybeSingle();
    if (settingsError || !settings) throw new Error('Impossible de récupérer les paramètres Gmail');
    if (!settings.gmail_connected || !settings.gmail_refresh_token) {
      throw new Error('Gmail non connecté. Veuillez vous connecter à Gmail dans les Paramètres.');
    }
    let accessToken = settings.gmail_access_token;
    const now = new Date();
    const expiry = settings.gmail_token_expiry ? new Date(settings.gmail_token_expiry) : null;
    if (!accessToken || !expiry || expiry <= now) {
      const clientId = Deno.env.get('GMAIL_CLIENT_ID');
      const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
      const tokenData = await refreshAccessToken(settings.gmail_refresh_token, clientId, clientSecret);
      accessToken = tokenData.access_token;
      const expiryDate = new Date(now.getTime() + tokenData.expires_in * 1000);
      await supabase.from('user_settings').update({
        gmail_access_token: accessToken,
        gmail_token_expiry: expiryDate.toISOString()
      }).eq('user_id', user.id);
    }
    // Construire MIME
    const mimeMessage = createMimeMessage({
      from: from ?? user.email,
      to,
      cc,
      bcc,
      subject,
      html,
      attachments,
      messageIdDomainHint: (from ?? user.email)?.split('@')[1]
    });
    // Encoder & envoyer
    const encoded = base64UrlEncodeBytes(new TextEncoder().encode(mimeMessage));
    const result = await sendGmailMessage(accessToken, {
      raw: encoded
    });
    return new Response(JSON.stringify({
      success: true,
      messageId: result.id,
      threadId: result.threadId,
      message: 'Email envoyé avec succès via Gmail'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    let userMessage = error?.message || 'Erreur inconnue';
    if (userMessage.includes('Unauthorized')) {
      userMessage = 'Session expirée. Veuillez vous reconnecter.';
    } else if (userMessage.includes('Gmail non connecté')) {
      userMessage = 'Gmail non connecté. Allez dans Paramètres > Méthode d\'envoi email > Connecter Gmail.';
    } else if (userMessage.match(/(413|Message too large|larger than)/i)) {
      userMessage = 'Message trop volumineux. Gmail limite les pièces jointes à ~25 MB au total. Utilisez un lien de téléchargement.';
    } else if (userMessage.includes('Gmail API error')) {
      userMessage = 'Erreur Gmail API. Vérifiez la connexion Gmail et les permissions.';
    }
    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      details: error?.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
