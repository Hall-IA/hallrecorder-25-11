import { ArrowLeft, Calendar, FileText, Mail, Plus, Trash2, Download, Upload, Copy, FileDown, Edit2, Save, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase, EmailAttachment } from '../lib/supabase';
import { generatePDFFromHTML } from '../services/pdfGenerator';
import { EmailComposer } from './EmailComposer';
import { generateEmailBody } from '../services/emailTemplates';
import { SuccessModal } from './SuccessModal';
import { WordCorrectionModal } from './WordCorrectionModal';

interface MeetingResultProps {
  title: string;
  transcript: string;
  summary: string;
  suggestions?: Array<{
    segment_number?: number;
    summary?: string;
    key_points?: string[];
    suggestions?: string[];
    topics_to_explore?: string[];
    timestamp?: number;
  }>;
  userId: string;
  meetingId?: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export const MeetingResult = ({ title, transcript, summary, suggestions = [], userId, meetingId, onClose, onUpdate }: MeetingResultProps) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'suggestions'>('summary');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showWordCorrection, setShowWordCorrection] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [wordPosition, setWordPosition] = useState({ start: 0, end: 0, text: '' });
  const [emailMethod, setEmailMethod] = useState<'gmail' | 'local' | 'smtp'>('gmail');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [initialEmailBody, setInitialEmailBody] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedSummary, setEditedSummary] = useState(summary);
  const [editedTranscript, setEditedTranscript] = useState(transcript);
  const [senderName, setSenderName] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [signatureLogoUrl, setSignatureLogoUrl] = useState('');
  const summaryRef = React.useRef<HTMLDivElement>(null);

  // Charger les paramètres utilisateur
  const handleWordDoubleClick = (e: React.MouseEvent) => {
    console.log('🖱️ Double-clic détecté sur:', e.target);

    const selection = window.getSelection();
    if (!selection) {
      console.log('❌ Pas de sélection disponible');
      return;
    }

    const selectedText = selection.toString().trim();
    console.log('📝 Texte actuellement sélectionné:', selectedText);

    if (selectedText && selectedText.length > 0 && selectedText.length < 50) {
      const cleanWord = selectedText.replace(/[^\w'À-ſ\s-]/g, '').trim();
      const words = cleanWord.split(/\s+/);
      const word = words[0];

      if (word && word.length > 0) {
        console.log('✅ Ouverture modal pour:', word);
        setSelectedWord(word);
        setWordPosition({ start: 0, end: word.length, text: word });
        setShowWordCorrection(true);
      }
    } else {
      const target = e.target as HTMLElement;
      const text = target.textContent || '';

      if (text) {
        selection.removeAllRanges();
        const range = document.createRange();
        const textNode = target.firstChild || target;

        if (textNode.nodeType === Node.TEXT_NODE) {
          range.selectNodeContents(textNode);
          selection.addRange(range);

          selection.modify('move', 'backward', 'word');
          selection.modify('extend', 'forward', 'word');

          const word = selection.toString().trim();
          console.log('📝 Mot extrait:', word);

          if (word && word.length > 0) {
            const cleanWord = word.replace(/[^\w'À-ſ-]/g, '');
            if (cleanWord) {
              console.log('✅ Ouverture modal pour:', cleanWord);
              setSelectedWord(cleanWord);
              setWordPosition({ start: 0, end: cleanWord.length, text: cleanWord });
              setShowWordCorrection(true);
            }
          }
        }
      }

      selection.removeAllRanges();
    }
  };

  const handleWordReplace = async (newWord: string, replaceAll: boolean, saveToDict: boolean) => {
    console.log('🔄 Remplacement:', { selectedWord, newWord, replaceAll, saveToDict, activeTab });

    if (saveToDict) {
      const { error } = await supabase
        .from('custom_dictionary')
        .upsert({
          user_id: userId,
          incorrect_word: selectedWord.toLowerCase(),
          correct_word: newWord,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,incorrect_word',
        });

      if (error) {
        console.error('Erreur lors de l\'enregistrement dans le dictionnaire:', error);
      } else {
        console.log('✅ Mot ajouté au dictionnaire personnalisé');
      }
    }

    let updatedText = '';
    if (activeTab === 'summary') {
      updatedText = replaceAll
        ? editedSummary.replace(new RegExp(`\\b${selectedWord}\\b`, 'gi'), newWord)
        : editedSummary.replace(selectedWord, newWord);

      console.log('📝 Mise à jour du résumé');
      setEditedSummary(updatedText);

      if (meetingId) {
        await supabase
          .from('meetings')
          .update({ summary: updatedText })
          .eq('id', meetingId);

        console.log('✅ Résumé sauvegardé dans la base de données');
      }
    } else if (activeTab === 'transcript') {
      updatedText = replaceAll
        ? editedTranscript.replace(new RegExp(`\\b${selectedWord}\\b`, 'gi'), newWord)
        : editedTranscript.replace(selectedWord, newWord);

      console.log('📝 Mise à jour de la transcription');
      setEditedTranscript(updatedText);

      if (meetingId) {
        await supabase
          .from('meetings')
          .update({ display_transcript: updatedText })
          .eq('id', meetingId);

        console.log('✅ Transcription sauvegardée dans la base de données');
      }
    }

    setShowWordCorrection(false);
    setSelectedWord('');
    setWordPosition(null);
  };

  const loadSettings = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('user_settings')
      .select('email_method, gmail_connected, sender_name, signature_text, signature_logo_url')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('📊 Settings chargés:', data);

    if (data) {
      setSenderName(data.sender_name || '');
      setSignatureText(data.signature_text || '');
      setSignatureLogoUrl(data.signature_logo_url || '');

      if (data.email_method) {
        if (data.email_method === 'gmail' && !data.gmail_connected) {
          console.log('⚠️ Gmail sélectionné mais non connecté, passage en local');
          setEmailMethod('local');
        } else {
          console.log('✅ Utilisation de:', data.email_method);
          setEmailMethod(data.email_method);
        }
      }
    }
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    console.log('🔧 MeetingResult: Installation du listener double-clic');

    const handleDblClick = (e: MouseEvent) => {
      console.log('🌍 Double-clic global détecté');

      const target = e.target as HTMLElement;
      const summaryDiv = summaryRef.current;

      if (summaryDiv && summaryDiv.contains(target)) {
        console.log('✅ Clic dans la zone résumé');
        handleWordDoubleClick(e as any);
      } else {
        console.log('❌ Clic hors zone résumé', target);
      }
    };

    document.addEventListener('dblclick', handleDblClick);
    console.log('✅ Listener double-clic installé');

    return () => {
      console.log('🗑️ MeetingResult: Suppression du listener double-clic');
      document.removeEventListener('dblclick', handleDblClick);
    };
  }, [editedSummary, editedTranscript, activeTab]);

  const handleSave = async () => {
    if (!meetingId) {
      alert('Impossible de sauvegarder : ID de réunion manquant');
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          title: editedTitle,
          summary: editedSummary,
          display_transcript: editedTranscript,
        })
        .eq('id', meetingId);

      if (error) throw error;

      setIsEditing(false);
      if (onUpdate) onUpdate();
      alert('✓ Modifications enregistrées');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(title);
    setEditedSummary(summary);
    setEditedTranscript(transcript);
    setIsEditing(false);
  };

  const handleDownloadPDF = async () => {
    try {
      await generatePDFFromHTML(editedTitle, editedSummary);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  };

  const formatDate = () => {
    const date = new Date();
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopyReport = async () => {
    const report = `${editedTitle}\n\n${editedSummary}`;
    try {
      await navigator.clipboard.writeText(report);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert('Erreur lors de la copie');
    }
  };

  // Préparer le body initial de l'email
  const prepareInitialEmailBody = async (): Promise<string> => {
    if (!senderName && !signatureText && !signatureLogoUrl) {
      await loadSettings();
    }
    return await generateEmailBody({
      title: editedTitle,
      date: formatDate(),
      summary: editedSummary,
      attachments: [],
      senderName,
      signatureText,
      signatureLogoUrl,
      deliveryMethod: emailMethod === 'smtp' || emailMethod === 'gmail' ? emailMethod : 'app',
    });
  };

  // Gérer l'envoi d'email avec le nouveau composant
  const handleEmailSend = async (emailData: {
    recipients: Array<{ email: string }>;
    ccRecipients: Array<{ email: string }>;
    bccRecipients: Array<{ email: string }>;
    subject: string;
    htmlBody: string;
    textBody: string;
    attachments: EmailAttachment[];
  }) => {
    setIsSendingEmail(true);

    console.log('🔍 Email method actuel:', emailMethod);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const trackingId = crypto.randomUUID();
      const allRecipientsRaw = [
        ...emailData.recipients.map(r => r.email),
        ...emailData.ccRecipients.map(r => r.email),
        ...emailData.bccRecipients.map(r => r.email),
      ].filter(Boolean) as string[];
      const uniqueRecipients = Array.from(new Set(allRecipientsRaw.map(email => email.trim())));

      const trackingPixels = uniqueRecipients.map(recipientEmail => {
        const pixelUrl = `${supabaseUrl}/functions/v1/email-open-tracker?id=${trackingId}&recipient=${encodeURIComponent(recipientEmail)}`;
        return `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;" />`;
      }).join('\n');

      const htmlWithTracking = trackingPixels
        ? emailData.htmlBody.includes('</body>')
          ? emailData.htmlBody.replace('</body>', `${trackingPixels}</body>`)
          : `${emailData.htmlBody}\n${trackingPixels}`
        : emailData.htmlBody;

      if (emailMethod === 'smtp') {
        // Envoi via SMTP
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Non authentifié');
        }

        console.log('🔍 SMTP - Nombre de PJ reçues:', emailData.attachments.length);
        console.log('🔍 SMTP - Attachments:', emailData.attachments);

        // Convertir les pièces jointes en base64 pour SMTP aussi
        const attachmentsFormatted = await Promise.all(emailData.attachments.map(async (att) => {
          try {
            const response = await fetch(att.url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
              };
              reader.readAsDataURL(blob);
            });

            return {
              filename: att.name,
              content: base64,
              contentType: att.type || 'application/octet-stream',
            };
          } catch (error) {
            console.error(`Erreur lors de la conversion de ${att.name}:`, error);
            return null;
          }
        }));

        const validAttachments = attachmentsFormatted.filter(a => a !== null);

        console.log('✅ SMTP - Nombre de PJ valides après conversion:', validAttachments.length);
        console.log('✅ SMTP - PJ valides:', validAttachments.map(a => a?.filename));

        const response = await fetch(`${supabaseUrl}/functions/v1/send-email-smtp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            to: emailData.recipients.map(r => r.email),
            cc: emailData.ccRecipients.map(r => r.email),
            subject: emailData.subject,
            htmlBody: htmlWithTracking,
            textBody: emailData.textBody,
            attachments: validAttachments,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Erreur lors de l\'envoi');
        }

        const attachmentsSize = validAttachments.reduce((sum, att: any) => {
          return sum + ((att.content.length * 3) / 4);
        }, 0);

        await supabase.from('email_history').insert({
          user_id: userId,
          meeting_id: meetingId || null,
          recipients: emailData.recipients.map(r => r.email).join(', '),
          cc_recipients: emailData.ccRecipients.length > 0
            ? emailData.ccRecipients.map(r => r.email).join(', ')
            : null,
          subject: emailData.subject,
          html_body: htmlWithTracking,
          method: 'smtp',
          attachments_count: validAttachments.length,
          total_attachments_size: Math.round(attachmentsSize),
          status: 'sent',
          tracking_id: trackingId,
        });

        setSuccessMessage('Email envoyé avec succès via SMTP !');
        setShowSuccessModal(true);
        setShowEmailComposer(false);
      } else if (emailMethod === 'gmail') {
        // Envoi via Gmail API
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Non authentifié');
        }

        // Convertir les pièces jointes en base64
        const attachmentsFormatted = await Promise.all(emailData.attachments.map(async (att) => {
          try {
            const response = await fetch(att.url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
              };
              reader.readAsDataURL(blob);
            });

            return {
              filename: att.name,
              content: base64,
              contentType: att.type || 'application/octet-stream',
            };
          } catch (error) {
            console.error(`Erreur lors de la conversion de ${att.name}:`, error);
            return null;
          }
        }));

        const validAttachments = attachmentsFormatted.filter(a => a !== null);

        const response = await fetch(`${supabaseUrl}/functions/v1/send-email-gmail`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emailData.recipients.map(r => r.email).join(', '),
            subject: emailData.subject,
            html: htmlWithTracking,
            attachments: validAttachments,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Erreur lors de l\'envoi via Gmail');
        }

        const attachmentsSize = validAttachments.reduce((sum, att: any) => {
          return sum + ((att.content.length * 3) / 4);
        }, 0);

        await supabase.from('email_history').insert({
          user_id: userId,
          meeting_id: meetingId || null,
          recipients: emailData.recipients.map(r => r.email).join(', '),
          cc_recipients: emailData.ccRecipients.length > 0
            ? emailData.ccRecipients.map(r => r.email).join(', ')
            : null,
          subject: emailData.subject,
          html_body: htmlWithTracking,
          method: 'gmail',
          attachments_count: validAttachments.length,
          total_attachments_size: Math.round(attachmentsSize),
          status: 'sent',
          message_id: result.messageId || null,
          thread_id: result.threadId || null,
          tracking_id: trackingId,
        });

        setSuccessMessage('Email envoyé avec succès via votre compte Gmail !');
        setShowSuccessModal(true);
        setShowEmailComposer(false);
      } else {
        // Envoi via client local
        const emailList = emailData.recipients.map(r => r.email).join(',');
        const ccList = emailData.ccRecipients.map(r => r.email).join(',');

        const mailtoLink = `mailto:${emailList}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.textBody)}${ccList ? `&cc=${encodeURIComponent(ccList)}` : ''}`;

        // Utiliser un lien temporaire au lieu de window.location.href
        const link = document.createElement('a');
        link.href = mailtoLink;
        link.click();

        setShowEmailComposer(false);

        // Petit délai pour s'assurer que le modal s'affiche après la fermeture du composer
        setTimeout(() => {
          setSuccessMessage('Votre client email local a été ouvert. Veuillez finaliser l\'envoi.');
          setShowSuccessModal(true);
        }, 100);
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      alert(`❌ Erreur lors de l'envoi de l'email:\n${error.message}\n\n${emailMethod === 'smtp' ? 'Vérifiez votre configuration SMTP dans les Paramètres.' : ''}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDownloadReport = () => {
    const report = `${title}\n\n${summary}`;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_resume.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const convertMarkdownToPlainText = (text: string) => {
    let plainText = text;
    
    // Convertir les titres ### et #### en MAJUSCULES pour les faire ressortir
    plainText = plainText.replace(/^### (.+)$/gm, '$1'.toUpperCase());
    plainText = plainText.replace(/^#### (.+)$/gm, '$1'.toUpperCase());
    
    // Supprimer le texte en gras **texte** et le garder normal
    plainText = plainText.replace(/\*\*([^*]+)\*\*/g, '$1');
    
    // Améliorer les checkboxes [ ] et [x]
    plainText = plainText.replace(/^- \[ \] (.+)$/gm, '☐ $1');
    plainText = plainText.replace(/^- \[x\] (.+)$/gm, '☑ $1');
    
    // Améliorer les listes avec -
    plainText = plainText.replace(/^- (.+)$/gm, '• $1');
    
    // Améliorer les sous-listes avec indentation
    plainText = plainText.replace(/^  - (.+)$/gm, '  ○ $1');
    
    return plainText;
  };

  const convertMarkdownToRichText = (text: string) => {
    let richText = text;
    
    // Convertir les titres ### en texte en gras (sans emoji, séparateur court)
    richText = richText.replace(/^### (.+)$/gm, '\n$1\n' + '-'.repeat(30));
    
    // Convertir les titres #### en texte simple
    richText = richText.replace(/^#### (.+)$/gm, '\n> $1');
    
    // Convertir le texte en gras **texte** en utilisant des caractères Unicode gras
    richText = richText.replace(/\*\*([^*]+)\*\*/g, (match, p1) => {
      // Convertir en caractères gras Unicode
      return p1.split('').map((char: string) => {
        const code = char.charCodeAt(0);
        // A-Z -> 𝗔-𝗭
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + (code - 65));
        // a-z -> 𝗮-𝘇
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
        // 0-9 -> 𝟬-𝟵
        if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7EC + (code - 48));
        return char;
      }).join('');
    });
    
    // Convertir les checkboxes [ ] et [x] (sans emoji)
    richText = richText.replace(/^- \[ \] (.+)$/gm, '  [ ] $1');
    richText = richText.replace(/^- \[x\] (.+)$/gm, '  [x] $1');
    
    // Convertir les listes avec -
    richText = richText.replace(/^- (.+)$/gm, '  - $1');
    
    // Améliorer les sous-listes avec indentation
    richText = richText.replace(/^  - (.+)$/gm, '    - $1');
    
    return richText;
  };

  const renderSummaryWithBold = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      // Support des checkboxes markdown: - [ ] et - [x]
      const markdownCheckboxMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/);
      const legacyCheckboxMatch = line.match(/^(☐|☑)\s+(.+)$/);
      
      if (markdownCheckboxMatch || legacyCheckboxMatch) {
        const content = markdownCheckboxMatch ? markdownCheckboxMatch[2] : legacyCheckboxMatch![2];
        const isInitiallyChecked = markdownCheckboxMatch ? markdownCheckboxMatch[1] === 'x' : legacyCheckboxMatch![1] === '☑';
        const itemId = `${lineIndex}-${content}`;
        const isChecked = checkedItems.has(itemId) ? true : (checkedItems.size === 0 && isInitiallyChecked);

        return (
          <div key={lineIndex} className="flex items-start gap-3 mb-2">
            <button
              onClick={() => {
                setCheckedItems(prev => {
                  const newSet = new Set(prev);
                  if (isChecked) {
                    newSet.delete(itemId);
                  } else {
                    newSet.add(itemId);
                  }
                  return newSet;
                });
              }}
              className="flex-shrink-0 w-5 h-5 mt-0.5 border-2 border-coral-500 rounded flex items-center justify-center hover:bg-coral-50 transition-colors"
            >
              {isChecked && (
                <svg className="w-4 h-4 text-coral-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              )}
            </button>
            <span
              className={`flex-1 ${isChecked ? 'line-through text-cocoa-400' : 'text-cocoa-800'}`}
              onDoubleClick={handleWordDoubleClick}
            >
              {content}
            </span>
          </div>
        );
      }

      // Support des titres markdown ### et ####
      if (line.startsWith('### ')) {
        const titleText = line.substring(4).trim();
        return (
          <h3
            key={lineIndex}
            className="text-xl font-bold text-cocoa-800 mt-6 mb-3"
            onDoubleClick={handleWordDoubleClick}
          >
            {titleText}
          </h3>
        );
      }

      if (line.startsWith('#### ')) {
        const titleText = line.substring(5).trim();
        return (
          <h4
            key={lineIndex}
            className="text-lg font-semibold text-cocoa-700 mt-4 mb-2"
            onDoubleClick={handleWordDoubleClick}
          >
            {titleText}
          </h4>
        );
      }

      // Support des listes avec -
      if (line.match(/^-\s+/) && !line.match(/^-\s+\[/)) {
        const content = line.substring(2);
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const renderedParts = parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const text = part.slice(2, -2);
            return <strong key={index}>{text}</strong>;
          }
          return part;
        });

        return (
          <div key={lineIndex} className="flex items-start gap-2 mb-1">
            <span className="text-coral-600 mt-1 text-sm">•</span>
            <span
              className="flex-1 text-cocoa-800"
              onDoubleClick={handleWordDoubleClick}
            >
              {renderedParts}
            </span>
          </div>
        );
      }

      // Support des sous-listes avec indentation (2 ou 4 espaces)
      if (line.match(/^\s{2,4}-\s+/) && !line.match(/^\s{2,4}-\s+\[/)) {
        const content = line.trim().substring(2);
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const renderedParts = parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const text = part.slice(2, -2);
            return <strong key={index}>{text}</strong>;
          }
          return part;
        });

        return (
          <div key={lineIndex} className="flex items-start gap-2 ml-6 mb-1">
            <span className="text-cocoa-400 mt-1 text-xs">○</span>
            <span
              className="flex-1 text-cocoa-700"
              onDoubleClick={handleWordDoubleClick}
            >
              {renderedParts}
            </span>
          </div>
        );
      }

      // Texte normal avec support du gras **
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const renderedParts = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return <strong key={index}>{content}</strong>;
        }
        return part;
      });

      return (
        <div
          key={lineIndex}
          className={line.trim() === '' ? 'h-2' : ''}
          onDoubleClick={handleWordDoubleClick}
        >
          {renderedParts}
          {lineIndex < lines.length - 1 && '\n'}
        </div>
      );
    });
  };


  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl md:rounded-3xl max-w-4xl w-full max-h-[95vh] md:max-h-[90vh] overflow-hidden shadow-2xl border-2 border-orange-100 flex flex-col">
        <div className="border-b-2 border-orange-100">
          <div className="p-4 md:p-8">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <button
                onClick={onClose}
                className="flex items-center gap-1 md:gap-2 text-cocoa-600 hover:text-coral-600 transition-colors font-semibold text-sm md:text-base"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                <span className="md:text-lg">Fermer</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 text-cocoa-600 hover:text-cocoa-800 hover:bg-orange-50 rounded-lg md:rounded-xl transition-colors font-semibold text-sm md:text-base"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5" />
                      <span>Annuler</span>
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 bg-gradient-to-r from-coral-500 to-coral-600 text-white hover:from-coral-600 hover:to-coral-700 rounded-lg md:rounded-xl transition-all shadow-lg shadow-coral-500/30 text-sm md:text-base"
                    >
                      <Save className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="font-semibold">Enregistrer</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCopyReport}
                      className="p-2 md:p-3 bg-gray-100 hover:bg-gray-200 text-cocoa-700 rounded-lg transition-all shadow-sm"
                      title="Copier le rapport"
                    >
                      <Copy className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 rounded-lg transition-all shadow-sm font-semibold text-sm"
                      title="Télécharger en PDF"
                    >
                      <FileDown className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Télécharger PDF</span>
                      <span className="sm:hidden">PDF</span>
                    </button>
                    <button
                      onClick={async () => {
                        const emailBody = await prepareInitialEmailBody();
                        setInitialEmailBody(emailBody);
                        setShowEmailComposer(true);
                      }}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 rounded-lg md:rounded-xl transition-all font-semibold shadow-lg shadow-green-500/30 text-sm md:text-base"
                    >
                      <Mail className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Envoyer par email</span>
                      <span className="sm:hidden">Email</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 text-cocoa-600 hover:text-cocoa-800 hover:bg-orange-50 rounded-lg md:rounded-xl transition-colors font-semibold border-2 border-transparent hover:border-orange-200 text-sm md:text-base"
                    >
                      <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Modifier</span>
                      <span className="sm:hidden">Modifier</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {copySuccess && (
              <div className="mt-2 text-right">
                <span className="text-sm text-green-600 font-semibold">✓ Copié !</span>
              </div>
            )}

            <div className="flex items-start gap-3 md:gap-5">
              <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl">
                <FileText className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-xl md:text-4xl font-bold text-cocoa-800 mb-2 md:mb-4 w-full border-b-2 border-coral-500 focus:outline-none bg-transparent"
                  />
                ) : (
                  <h1 className="text-xl md:text-4xl font-bold bg-gradient-to-r from-coral-600 to-sunset-600 bg-clip-text text-transparent mb-2 md:mb-4 break-words">
                    {editedTitle}
                  </h1>
                )}
                <div className="flex items-center gap-3 md:gap-6 text-cocoa-600 font-medium text-xs md:text-base">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 text-sunset-500" />
                    <span className="truncate">{formatDate()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 md:px-8 border-t-2 border-orange-100 bg-gradient-to-r from-orange-50/50 to-red-50/50 overflow-x-auto">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 md:px-8 py-3 md:py-4 text-sm md:text-base font-bold transition-all relative rounded-t-xl whitespace-nowrap ${
                activeTab === 'summary'
                  ? 'text-coral-600 bg-white'
                  : 'text-cocoa-600 hover:text-coral-500 hover:bg-orange-50/50'
              }`}
            >
              Résumé
              {activeTab === 'summary' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-coral-500 to-sunset-500 rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-4 md:px-8 py-3 md:py-4 text-sm md:text-base font-bold transition-all relative rounded-t-xl whitespace-nowrap ${
                activeTab === 'transcript'
                  ? 'text-coral-600 bg-white'
                  : 'text-cocoa-600 hover:text-coral-500 hover:bg-orange-50/50'
              }`}
            >
              Transcription
              {activeTab === 'transcript' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-coral-500 to-sunset-500 rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-4 md:px-8 py-3 md:py-4 text-sm md:text-base font-bold transition-all relative rounded-t-xl whitespace-nowrap ${
                activeTab === 'suggestions'
                  ? 'text-coral-600 bg-white'
                  : 'text-cocoa-600 hover:text-coral-500 hover:bg-orange-50/50'
              }`}
            >
              Suggestions
              {activeTab === 'suggestions' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-coral-500 to-sunset-500 rounded-full"></div>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 md:p-10 flex-1 flex justify-center">
          {activeTab === 'summary' ? (
            <div className="w-full max-w-5xl">
              {isEditing ? (
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full min-h-[400px] p-6 border-2 border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-coral-500 text-cocoa-800 text-lg leading-relaxed"
                />
              ) : (
                <div className="prose prose-slate max-w-none">
                  <div
                    ref={summaryRef}
                    className="text-cocoa-800 whitespace-pre-wrap leading-relaxed text-lg cursor-text"
                  >
                    {renderSummaryWithBold(editedSummary)}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'transcript' ? (
            <div className="w-full max-w-5xl">
              {isEditing ? (
                <textarea
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  className="w-full min-h-[400px] p-6 border-2 border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-coral-500 text-cocoa-800 text-lg leading-relaxed"
                />
              ) : (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border-2 border-orange-100">
                  <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-coral-300 scrollbar-track-coral-100">
                    {editedTranscript ? (
                    <div className="space-y-3">
                      {editedTranscript.split(/--- \d+s ---/).map((chunk, index) => {
                        if (!chunk.trim()) return null;
                        
                        const timeInSeconds = index * 15;
                        const minutes = Math.floor(timeInSeconds / 60);
                        const seconds = timeInSeconds % 60;
                        const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        
                        return (
                          <div key={index} className="relative">
                            {/* Séparateur élégant avec timestamp */}
                            {index > 0 && (
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-coral-200 to-transparent"></div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-coral-200">
                                  <div className="w-1.5 h-1.5 bg-coral-500 rounded-full animate-pulse"></div>
                                  <span className="text-coral-700 text-xs font-medium">{timeLabel}</span>
                                </div>
                                <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-coral-200 to-transparent"></div>
                              </div>
                            )}
                            
                            {/* Contenu du chunk avec header */}
                            <div className="bg-white rounded-xl shadow-sm border border-coral-100 overflow-hidden">
                              {/* Header du chunk */}
                              <div className="bg-gradient-to-r from-coral-50 to-orange-50 px-3 py-1.5 border-b border-coral-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 bg-coral-500 rounded-full"></div>
                                  <span className="text-coral-600 text-xs font-semibold uppercase tracking-wide">
                                    Segment {index + 1}
                                  </span>
                                  <span className="text-coral-400 text-xs">•</span>
                                  <span className="text-coral-500 text-xs">
                                    {timeLabel}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Contenu */}
                              <div className="p-3">
                                <p
                                  className="text-cocoa-700 leading-relaxed text-sm cursor-text"
                                  onDoubleClick={handleWordDoubleClick}
                                >
                                  {chunk.trim()}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-cocoa-500 text-center py-8">Aucune transcription disponible</p>
                  )}
                </div>
              </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-5xl">
              {suggestions && suggestions.length > 0 ? (
                <div className="space-y-4">
                  {suggestions.some(s => s.suggestions && s.suggestions.length > 0) && (
                    <div className="bg-white rounded-2xl p-6 border-2 border-purple-100 shadow-sm">
                      <h4 className="text-sm font-bold text-purple-900 mb-2">Points à clarifier</h4>
                      <div className="max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-50">
                        <ul className="space-y-1">
                          {suggestions.flatMap(s => s.suggestions || []).map((q, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-purple-500 mt-1">•</span>
                              <span className="text-cocoa-700">{q}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {suggestions.some(s => s.topics_to_explore && s.topics_to_explore.length > 0) && (
                    <div className="bg-white rounded-2xl p-6 border-2 border-purple-100 shadow-sm">
                      <h4 className="text-sm font-bold text-purple-900 mb-2">Sujets à explorer</h4>
                      <div className="max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-50">
                        <div className="flex flex-wrap gap-2">
                          {suggestions.flatMap(s => s.topics_to_explore || []).map((t, idx) => (
                            <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 border-2 border-gray-200 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-gray-600 font-medium">Aucune suggestion disponible</p>
                  <p className="text-sm text-gray-500 mt-2">Les suggestions sont générées pendant l'enregistrement</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Nouveau composant EmailComposer */}
      {showEmailComposer && (
        <EmailComposer
          subject={title}
          initialBody={initialEmailBody}
          recipients={[{ email: '' }]}
          ccRecipients={[]}
          bccRecipients={[]}
          attachments={[]}
          onSend={handleEmailSend}
          onClose={() => setShowEmailComposer(false)}
          isSending={isSendingEmail}
        />
      )}

      {/* INFO: Les pièces jointes doivent être ajoutées manuellement dans l'éditeur email via le bouton "Ajouter une pièce jointe" */}

      {/* Modal de succès */}
      <SuccessModal
        isOpen={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Modal de correction de mot */}
      <WordCorrectionModal
        isOpen={showWordCorrection}
        word={selectedWord}
        onReplace={handleWordReplace}
        onClose={() => setShowWordCorrection(false)}
      />
    </div>
  );
};
