// Fonction pour convertir une image URL en data URI
export const imageUrlToDataUri = async (imageUrl: string): Promise<string> => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status);
      return imageUrl; // Fallback to original URL
    }

    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          resolve(reader.result as string);
        } else {
          reject(new Error('FileReader result is null'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to data URI:', error);
    return imageUrl; // Fallback to original URL
  }
};

// Convertir Markdown vers HTML simple pour l'éditeur d'email
export const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';

  let html = '';
  const lines = markdown.split('\n');
  let inList = false;
  let listItems: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmedLine = line.trim();

    // Ignorer les lignes vides avec juste un tiret
    if (trimmedLine === '-' || trimmedLine === '') {
      if (inList && listItems.length > 0) {
        // Fermer la liste en cours
        html += '<ul style="list-style-type: disc; margin: 10px 0; padding-left: 30px;">\n';
        listItems.forEach(item => {
          html += `  <li style="margin-bottom: 5px;">${item}</li>\n`;
        });
        html += '</ul>\n';
        inList = false;
        listItems = [];
      }
      if (trimmedLine === '') {
        html += '<br>\n';
      }
      continue;
    }

    // Titres H3 (###)
    if (trimmedLine.startsWith('### ')) {
      if (inList) {
        html += '<ul style="list-style-type: disc; margin: 10px 0; padding-left: 30px;">\n';
        listItems.forEach(item => html += `  <li style="margin-bottom: 5px;">${item}</li>\n`);
        html += '</ul>\n';
        inList = false;
        listItems = [];
      }
      const title = trimmedLine.substring(4);
      html += `<h3 style="color: #EF6855; font-size: 1.2em; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">${title}</h3>\n`;
      continue;
    }

    // Titres H4 (####)
    if (trimmedLine.startsWith('#### ')) {
      if (inList) {
        html += '<ul style="list-style-type: disc; margin: 10px 0; padding-left: 30px;">\n';
        listItems.forEach(item => html += `  <li style="margin-bottom: 5px;">${item}</li>\n`);
        html += '</ul>\n';
        inList = false;
        listItems = [];
      }
      const title = trimmedLine.substring(5);
      html += `<h4 style="color: #F7931E; font-size: 1.1em; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">${title}</h4>\n`;
      continue;
    }

    // Checkboxes
    if (trimmedLine.match(/^-\s+\[\s?\]\s+(.+)$/)) {
      if (inList) {
        html += '<ul style="list-style-type: disc; margin: 10px 0; padding-left: 30px;">\n';
        listItems.forEach(item => html += `  <li style="margin-bottom: 5px;">${item}</li>\n`);
        html += '</ul>\n';
        inList = false;
        listItems = [];
      }
      const content = trimmedLine.match(/^-\s+\[\s?\]\s+(.+)$/)?.[1] || '';
      html += `<p style="margin: 5px 0;">☐ ${content}</p>\n`;
      continue;
    }

    if (trimmedLine.match(/^-\s+\[x\]\s+(.+)$/)) {
      if (inList) {
        html += '<ul style="list-style-type: disc; margin: 10px 0; padding-left: 30px;">\n';
        listItems.forEach(item => html += `  <li style="margin-bottom: 5px;">${item}</li>\n`);
        html += '</ul>\n';
        inList = false;
        listItems = [];
      }
      const content = trimmedLine.match(/^-\s+\[x\]\s+(.+)$/)?.[1] || '';
      html += `<p style="margin: 5px 0;">☑ ${content}</p>\n`;
      continue;
    }

    // Listes à puces
    if (trimmedLine.match(/^-\s+(.+)$/)) {
      const content = trimmedLine.match(/^-\s+(.+)$/)?.[1] || '';
      if (content.trim()) {
        inList = true;
        // Appliquer le gras dans le contenu
        const formattedContent = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        listItems.push(formattedContent);
      }
      continue;
    }

    // Si on arrive ici et qu'on était dans une liste, la fermer
    if (inList) {
      html += '<ul style="list-style-type: disc; margin: 10px 0; padding-left: 30px;">\n';
      listItems.forEach(item => html += `  <li style="margin-bottom: 5px;">${item}</li>\n`);
      html += '</ul>\n';
      inList = false;
      listItems = [];
    }

    // Paragraphe normal
    if (trimmedLine) {
      let formattedLine = trimmedLine;
      // Gras
      formattedLine = formattedLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // Italique
      formattedLine = formattedLine.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html += `<p style="margin: 8px 0; line-height: 1.6;">${formattedLine}</p>\n`;
    }
  }

  // Fermer la liste si on en a une ouverte à la fin
  if (inList && listItems.length > 0) {
    html += '<ul style="list-style-type: disc; margin: 10px 0; padding-left: 30px;">\n';
    listItems.forEach(item => html += `  <li style="margin-bottom: 5px;">${item}</li>\n`);
    html += '</ul>\n';
  }

  return html;
};

interface EmailTemplateData {
  greeting?: string;
  title: string;
  date: string;
  duration?: string;
  participantName?: string;
  participantEmail?: string;
  summary: string;
  attachments?: Array<{ name: string; url: string }>;
  senderName?: string;
  signatureText?: string;
  signatureLogoUrl?: string;
  deliveryMethod?: 'gmail' | 'smtp' | 'app' | 'local';
}

export const generateEmailBody = async (data: EmailTemplateData): Promise<string> => {
  const {
    greeting = 'Bonjour',
    title,
    date,
    duration,
    participantName,
    participantEmail,
    summary,
    attachments = [],
    senderName,
    signatureText,
    signatureLogoUrl,
    deliveryMethod = 'app',
  } = data;

  // Pour Gmail, utiliser directement l'URL du logo (plus fiable que data URI)
  // Pour SMTP, convertir en data URI
  let logoDataUri = '';
  let logoUrl = signatureLogoUrl;
  
  // On peut détecter si c'est pour Gmail ou SMTP plus tard, 
  // pour l'instant utilisons l'URL directement
  if (signatureLogoUrl) {
    console.log('🖼️ Using logo URL directly:', signatureLogoUrl);
    logoUrl = signatureLogoUrl;
  }

  let htmlBody = `
<p>Bonjour,</p>

<p>À la suite de notre réunion, vous trouverez ci-joint le compte rendu détaillé reprenant les points essentiels abordés, les décisions prises et les actions à mettre en œuvre.</p>

<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">

<h2 style="color: #EF6855; font-size: 1.3em; margin-bottom: 15px;">Informations de la réunion</h2>

<p><strong>Titre:</strong> ${title}</p>
<p><strong>Date:</strong> ${date}</p>
${duration ? `<p><strong>Durée:</strong> ${duration}</p>` : ''}
${participantName ? `<p><strong>Participant:</strong> ${participantName}</p>` : ''}
${participantEmail ? `<p><strong>Email:</strong> ${participantEmail}</p>` : ''}

<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">

<h2 style="color: #EF6855; font-size: 1.3em; margin-bottom: 15px;">Compte-rendu détaillé</h2>

${markdownToHtml(summary)}

<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
`;

  // Ajouter les pièces jointes si présentes
  const includeAttachmentLinks = attachments.length > 0 && (deliveryMethod === 'app' || deliveryMethod === 'local');

  if (includeAttachmentLinks) {
    htmlBody += `
<h2 style="color: #EF6855; font-size: 1.3em; margin-bottom: 15px;">Documents joints</h2>
<ul style="list-style-type: none; padding: 0;">
`;
    attachments.forEach(att => {
      htmlBody += `  <li style="margin-bottom: 8px;">📎 <a href="${att.url}" style="color: #EF6855; text-decoration: none;">${att.name}</a></li>\n`;
    });
    htmlBody += `</ul>

<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
`;
  }

  // Pied de page
  htmlBody += `
<p>Je reste à votre disposition pour toute demande ou précision complémentaire.</p>

<p>Je vous souhaite une excellente journée,</p>

<p><strong>Cordialement,</strong></p>
`;

  // Signature
  if (senderName) {
    htmlBody += `<p>${senderName}</p>`;
  }
  if (signatureText) {
    // Préserver les retours à la ligne dans la signature
    const formattedSignature = signatureText.replace(/\n/g, '<br>');
    htmlBody += `<p style="color: #666; white-space: pre-line;">${formattedSignature}</p>`;
  }
  if (logoUrl) {
    // Utiliser l'URL directement (Gmail la téléchargera automatiquement)
    htmlBody += `<p><img src="${logoUrl}" alt="Logo" width="80" height="auto" style="max-width: 80px; height: auto; display: block;"></p>`;
  }

  return htmlBody;
};

