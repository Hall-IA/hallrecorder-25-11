import { ArrowLeft, Calendar, Clock, Edit2, FileText, Mail, Save, X, Paperclip, Download, FileDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Meeting, EmailAttachment, supabase } from '../lib/supabase';
import { generatePDFFromHTML } from '../services/pdfGenerator';
import { EmailComposer } from './EmailComposer';
import { generateEmailBody } from '../services/emailTemplates';
import { EmailSuccessModal } from './EmailSuccessModal';
import { WordCorrectionModal } from './WordCorrectionModal';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: () => void;
}

export const MeetingDetail = ({ meeting, onBack, onUpdate }: MeetingDetailProps) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'suggestions'>('summary');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(meeting.title);
  const [editedSummary, setEditedSummary] = useState(meeting.summary || '');
  const [editedTranscript, setEditedTranscript] = useState(meeting.display_transcript || meeting.transcript || '');
  const [editedNotes, setEditedNotes] = useState(meeting.notes || '');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailMethod, setEmailMethod] = useState<'gmail' | 'local' | 'smtp'>('gmail');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [emailAttachments] = useState<EmailAttachment[]>(meeting.email_attachments || []);
  const [senderName, setSenderName] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [signatureLogoUrl, setSignatureLogoUrl] = useState('');
  const [initialEmailBody, setInitialEmailBody] = useState<string>('');
  const [clarifications, setClarifications] = useState<Array<{ id: string; content: string }>>([]);
  const [topics, setTopics] = useState<Array<{ id: string; topic: string }>>([]);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean | null>(null);
  const [audioExpiresAt, setAudioExpiresAt] = useState<string | null>(null);
  const [audioTimeRemaining, setAudioTimeRemaining] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{ recipientCount: number; method: 'gmail' | 'smtp' }>({ recipientCount: 0, method: 'smtp' });
  const [showWordCorrection, setShowWordCorrection] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [wordPosition, setWordPosition] = useState<{ start: number; end: number; text: string } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSignature();
    loadSuggestionsData();
    checkAudioAvailability();
    loadAudioExpiration();
  }, [meeting.user_id, meeting.id]);

  useEffect(() => {
    console.log('🔧 MeetingDetail: Installation du listener double-clic');

    const handleDblClick = (e: MouseEvent) => {
      console.log('🌍 Double-clic global détecté sur MeetingDetail');

      const target = e.target as HTMLElement;
      const summaryDiv = summaryRef.current;
      const transcriptDiv = transcriptRef.current;

      if ((summaryDiv && summaryDiv.contains(target)) || (transcriptDiv && transcriptDiv.contains(target))) {
        console.log('✅ Clic dans la zone de texte');
        handleWordDoubleClick(e);
      } else {
        console.log('❌ Clic hors zone de texte', target);
      }
    };

    document.addEventListener('dblclick', handleDblClick);
    console.log('✅ Listener double-clic installé sur MeetingDetail');

    return () => {
      console.log('🗑️ MeetingDetail: Suppression du listener double-clic');
      document.removeEventListener('dblclick', handleDblClick);
    };
  }, [editedSummary, editedTranscript, activeTab]);

  const handleWordDoubleClick = (e: MouseEvent) => {
    console.log('🖱️ Double-clic traité dans handleWordDoubleClick');

    const selection = window.getSelection();
    if (!selection) {
      console.log('❌ Pas de sélection disponible');
      return;
    }

    const selectedText = selection.toString().trim();
    console.log('📝 Texte sélectionné:', selectedText);

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
          user_id: meeting.user_id,
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

      await supabase
        .from('meetings')
        .update({ summary: updatedText })
        .eq('id', meeting.id);

      console.log('✅ Résumé sauvegardé dans la base de données');
    } else if (activeTab === 'transcript') {
      updatedText = replaceAll
        ? editedTranscript.replace(new RegExp(`\\b${selectedWord}\\b`, 'gi'), newWord)
        : editedTranscript.replace(selectedWord, newWord);

      console.log('📝 Mise à jour de la transcription');
      setEditedTranscript(updatedText);

      await supabase
        .from('meetings')
        .update({ display_transcript: updatedText })
        .eq('id', meeting.id);

      console.log('✅ Transcription sauvegardée dans la base de données');
    }

    setShowWordCorrection(false);
    setSelectedWord('');
    setWordPosition(null);

    onUpdate();
  };

  // Timer pour mettre à jour le temps restant
  useEffect(() => {
    if (!audioExpiresAt) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(audioExpiresAt);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setAudioTimeRemaining('Expiré');
        setAudioAvailable(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setAudioTimeRemaining(`${hours}h ${minutes}min restantes`);
      } else if (minutes > 0) {
        setAudioTimeRemaining(`${minutes} minutes restantes`);
      } else {
        const seconds = Math.floor(diff / 1000);
        setAudioTimeRemaining(`${seconds} secondes restantes`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Mise à jour chaque minute

    return () => clearInterval(interval);
  }, [audioExpiresAt]);

  const loadAudioExpiration = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('audio_expires_at')
        .eq('id', meeting.id)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement expiration:', error);
        return;
      }

      if (data?.audio_expires_at) {
        setAudioExpiresAt(data.audio_expires_at);
      }
    } catch (error) {
      console.error('Erreur chargement expiration:', error);
    }
  };

  const checkAudioAvailability = async () => {
    if (!meeting.audio_url) {
      setAudioAvailable(false);
      return;
    }

    try {
      // Méthode simple : faire une requête HEAD pour vérifier l'existence
      const response = await fetch(meeting.audio_url, { method: 'HEAD' });
      
      if (response.ok) {
        setAudioAvailable(true);
      } else {
        setAudioAvailable(false);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'audio:', error);
      // En cas d'erreur, on suppose que le fichier n'est pas encore disponible
      setAudioAvailable(false);
    }
  };

  const loadSignature = async () => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('sender_name, signature_text, signature_logo_url, email_method, gmail_connected')
      .eq('user_id', meeting.user_id)
      .maybeSingle();

    if (error) {

    }

    if (data) {

      setSenderName(data.sender_name || '');
      setSignatureText(data.signature_text || '');
      setSignatureLogoUrl(data.signature_logo_url || '');

      // Si Gmail est sélectionné mais pas connecté, utiliser local
      if (data.email_method === 'gmail' && !data.gmail_connected) {
        console.log('⚠️ Gmail sélectionné mais non connecté, passage en local');
        setEmailMethod('local');
      } else {
        console.log('✅ Utilisation de:', data.email_method);
        setEmailMethod(data.email_method || 'gmail');
      }
    } else {

    }
  };

  // Préparer le body initial de l'email
  const prepareInitialEmailBody = async (): Promise<string> => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatDuration = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    return await generateEmailBody({
      title: meeting.title,
      date: formatDate(meeting.created_at),
      duration: meeting.duration ? formatDuration(meeting.duration) : undefined,
      participantName: meeting.participant_first_name && meeting.participant_last_name
        ? `${meeting.participant_first_name} ${meeting.participant_last_name}`
        : undefined,
      participantEmail: meeting.participant_email || undefined,
      summary: meeting.summary || '',
      attachments: emailAttachments,
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

    console.log('🔍 [MeetingDetail] Email method actuel:', emailMethod);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const trackingId = crypto.randomUUID();
      const allRecipientsRaw = [
        ...emailData.recipients.map(r => r.email),
        ...emailData.ccRecipients.map(r => r.email),
        ...emailData.bccRecipients.map(r => r.email),
      ].filter(Boolean) as string[];
      const uniqueRecipients = Array.from(new Set(allRecipientsRaw.map(email => email.trim())));
      const primaryRecipient = uniqueRecipients[0] || null;

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
            console.log('🔄 Début conversion:', att.name, 'URL:', att.url);

            const response = await fetch(att.url);
            console.log('🔄 Fetch response status:', response.status, response.ok);

            if (!response.ok) {
              throw new Error(`Fetch failed: ${response.status}`);
            }

            const blob = await response.blob();
            console.log('🔄 Blob size:', blob.size, 'Type:', blob.type);

            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (reader.result) {
                  const base64String = (reader.result as string).split(',')[1];
                  console.log('🔄 Base64 length:', base64String?.length || 0);
                  resolve(base64String);
                } else {
                  reject(new Error('FileReader result is null'));
                }
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });

            console.log('✅ Conversion réussie:', att.name);

            return {
              filename: att.name,
              content: base64,
              contentType: att.type || blob.type || 'application/octet-stream',
            };
          } catch (error) {
            console.error(`❌ Erreur lors de la conversion de ${att.name}:`, error);
            return null;
          }
        }));

        const validAttachments = attachmentsFormatted.filter(a => a !== null);

        console.log('✅ SMTP - Nombre de PJ valides après conversion:', validAttachments.length);
        console.log('✅ SMTP - PJ valides:', validAttachments.map(a => a?.filename));

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email-smtp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: meeting.user_id,
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

        // Enregistrer dans l'historique
        const attachmentsSize = emailData.attachments.reduce((sum, att) => {
          return sum + ((att.url.length * 3) / 4); // Estimation taille
        }, 0);

        await supabase.from('email_history').insert({
          user_id: session.user.id,
          meeting_id: meeting?.id || null,
          recipients: emailData.recipients.map(r => r.email).join(', '),
          cc_recipients: emailData.ccRecipients.length > 0 
            ? emailData.ccRecipients.map(r => r.email).join(', ') 
            : null,
          subject: emailData.subject,
          html_body: htmlWithTracking,
          method: 'smtp',
          attachments_count: emailData.attachments.length,
          total_attachments_size: Math.round(attachmentsSize),
          status: 'sent',
          tracking_id: trackingId,
        });

        // Afficher le modal de succès
        const totalRecipients = emailData.recipients.length + emailData.ccRecipients.length + emailData.bccRecipients.length;
        setSuccessModalData({ recipientCount: totalRecipients, method: 'smtp' });
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

        // Enregistrer dans l'historique
        const attachmentsSize = validAttachments.reduce((sum, att: any) => {
          return sum + ((att.content.length * 3) / 4); // base64 to bytes
        }, 0);

        await supabase.from('email_history').insert({
          user_id: session.user.id,
          meeting_id: meeting?.id || null,
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

        // Afficher le modal de succès
        const totalRecipients = emailData.recipients.length + emailData.ccRecipients.length + emailData.bccRecipients.length;
        setSuccessModalData({ recipientCount: totalRecipients, method: 'gmail' });
        setShowSuccessModal(true);
        setShowEmailComposer(false);
      } else {
        // Envoi via client local
        const emailList = emailData.recipients.map(r => r.email).join(',');
        const ccList = emailData.ccRecipients.map(r => r.email).join(',');
        
        const mailtoLink = `mailto:${emailList}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.textBody)}${ccList ? `&cc=${encodeURIComponent(ccList)}` : ''}`;
        window.location.href = mailtoLink;
        setShowEmailComposer(false);
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      
      // Enregistrer l'échec dans l'historique
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('email_history').insert({
            user_id: session.user.id,
            meeting_id: meeting?.id || null,
            recipients: emailData.recipients.map(r => r.email).join(', '),
            cc_recipients: emailData.ccRecipients.length > 0 
              ? emailData.ccRecipients.map(r => r.email).join(', ') 
              : null,
            subject: emailData.subject,
            html_body: emailData.htmlBody,
            method: emailMethod,
            attachments_count: emailData.attachments.length,
            status: 'failed',
            error_message: error.message,
          });
        }
      } catch (historyError) {
        console.error('Erreur enregistrement historique:', historyError);
      }
      
      alert(`❌ Erreur lors de l'envoi de l'email:\n${error.message}\n\n${emailMethod === 'smtp' ? 'Vérifiez votre configuration SMTP dans les Paramètres.' : ''}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const loadSuggestionsData = async () => {
    try {
      const [{ data: clarif }, { data: tpcs }] = await Promise.all([
        supabase
          .from('meeting_clarifications')
          .select('id, content')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('meeting_topics')
          .select('id, topic')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: true })
      ]);

      setClarifications(clarif || []);
      setTopics(tpcs || []);

      // DEBUG: Affichage console pour diagnostic
      // Meeting id + tailles + extraits
      // eslint-disable-next-line no-console
      console.log('Suggestions (history) — meeting_id:', meeting.id, {
        clarifications_count: (clarif || []).length,
        topics_count: (tpcs || []).length,
        clarifications_sample: (clarif || []).slice(0, 3),
        topics_sample: (tpcs || []).slice(0, 3),
      });
    } catch (_e) {
      // pas de log navigateur
    }
  };


  const renderSummaryWithBold = (text: string | null) => {
    if (!text) return <div className="text-cocoa-500 italic">Aucun résumé disponible</div>;
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
            <span className={`flex-1 ${isChecked ? 'line-through text-cocoa-400' : 'text-cocoa-800'}`}>
              {content}
            </span>
          </div>
        );
      }

      // Support des titres markdown ### et ####
      if (line.startsWith('### ')) {
        const titleText = line.substring(4).trim();
        return (
          <h3 key={lineIndex} className="text-xl font-bold text-cocoa-800 mt-6 mb-3">
            {titleText}
          </h3>
        );
      }

      if (line.startsWith('#### ')) {
        const titleText = line.substring(5).trim();
        return (
          <h4 key={lineIndex} className="text-lg font-semibold text-cocoa-700 mt-4 mb-2">
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
            <span className="flex-1 text-cocoa-800">{renderedParts}</span>
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
            <span className="flex-1 text-cocoa-700">{renderedParts}</span>
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
        <div key={lineIndex} className={line.trim() === '' ? 'h-2' : ''}>
          {renderedParts}
          {lineIndex < lines.length - 1 && '\n'}
        </div>
      );
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const handleSave = async () => {
    try {
      // Créer une version propre pour le résumé (sans séparateurs)
      const cleanTranscript = editedTranscript.replace(/--- \d+s ---/g, '').replace(/\n\n+/g, ' ').trim();
      
      const { error } = await supabase
        .from('meetings')
        .update({
          title: editedTitle,
          summary: editedSummary,
          transcript: cleanTranscript, // Version propre pour le résumé
          display_transcript: editedTranscript, // Version avec séparateurs pour l'affichage
          notes: editedNotes,
        })
        .eq('id', meeting.id);

      if (error) throw error;

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      
      alert('Erreur lors de la sauvegarde des modifications');
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(meeting.title);
    setEditedSummary(meeting.summary || '');
    setEditedTranscript(meeting.transcript || '');
    setEditedNotes(meeting.notes || '');
    setIsEditing(false);
  };


  const handleDownloadPDF = async () => {
    try {
      await generatePDFFromHTML(
        meeting.title,
        meeting.summary || ''
      );
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  };

  const handleDownloadAudio = async () => {
    if (!meeting.audio_url) {
      alert('Aucun fichier audio disponible pour cette réunion.');
      return;
    }

    // Avertissement sur la durée de disponibilité (24h)
    const shouldDownload = confirm(
      '⚠️ IMPORTANT : Disponibilité limitée\n\n' +
      'L\'audio sera automatiquement supprimé 24 heures après sa création.\n\n' +
      'Téléchargez-le maintenant si vous souhaitez le conserver.\n\n' +
      'Voulez-vous continuer le téléchargement ?'
    );

    if (!shouldDownload) {
      return;
    }

    setIsDownloadingAudio(true);

    try {
      // Télécharger directement depuis l'URL
      const response = await fetch(meeting.audio_url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      // Créer un lien de téléchargement
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_${meeting.title.replace(/[^a-z0-9]/gi, '_')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Marquer l'audio comme disponible
      setAudioAvailable(true);
    } catch (error: any) {
      console.error('Erreur lors du téléchargement de l\'audio:', error);
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        alert('L\'audio n\'est pas encore disponible. Veuillez patienter quelques instants et réessayer.');
        setAudioAvailable(false);
        // Revérifier après quelques secondes
        setTimeout(() => checkAudioAvailability(), 3000);
      } else {
        alert('Erreur lors du téléchargement de l\'audio. Veuillez réessayer.');
      }
    } finally {
      setIsDownloadingAudio(false);
    }
  };



  return (
    <>
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border-2 border-orange-100 h-full flex flex-col">
        <div className="border-b-2 border-orange-100 flex-shrink-0">
          <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
              <button
                onClick={onBack}
                className="flex items-center gap-1 md:gap-2 text-cocoa-600 hover:text-coral-600 transition-colors font-semibold text-sm md:text-base"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                <span className="md:text-lg">Retour à l'historique</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto pb-6 sm:pb-0">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 text-cocoa-600 hover:text-cocoa-800 hover:bg-orange-50 rounded-lg md:rounded-xl transition-colors font-semibold text-sm md:text-base flex-1 sm:flex-initial justify-center"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5" />
                      <span>Annuler</span>
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 bg-gradient-to-r from-coral-500 to-coral-600 text-white hover:from-coral-600 hover:to-coral-700 rounded-lg md:rounded-xl transition-all shadow-lg shadow-coral-500/30 text-sm md:text-base flex-1 sm:flex-initial justify-center"
                    >
                      <Save className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="font-semibold">Enregistrer</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 rounded-lg transition-all shadow-sm font-semibold text-sm flex-1 sm:flex-initial justify-center"
                    >
                      <FileDown className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Télécharger PDF</span>
                      <span className="sm:hidden">PDF</span>
                    </button>
                    
                    {/* Bouton télécharger audio */}
                    {meeting.audio_url && (
                      <div className="relative flex-1 sm:flex-initial">
                        <button
                          onClick={audioAvailable === false ? checkAudioAvailability : handleDownloadAudio}
                          disabled={isDownloadingAudio || (audioTimeRemaining?.includes('Expiré') ?? false)}
                          className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg transition-all shadow-sm font-semibold text-sm justify-center w-full ${
                            audioTimeRemaining?.includes('Expiré')
                              ? 'bg-gray-400 text-white cursor-not-allowed'
                              : audioAvailable === false
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : isDownloadingAudio
                              ? 'bg-blue-400 text-white cursor-wait'
                              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                          }`}
                          title={
                            audioTimeRemaining?.includes('Expiré')
                              ? 'Audio expiré (24h dépassées)'
                              : audioAvailable === false
                              ? 'Cliquez pour revérifier la disponibilité'
                              : audioTimeRemaining
                              ? `Télécharger l'audio (${audioTimeRemaining})`
                              : 'Télécharger l\'audio'
                          }
                        >
                          {isDownloadingAudio ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span className="hidden sm:inline">Téléchargement...</span>
                            </>
                          ) : audioTimeRemaining?.includes('Expiré') ? (
                            <>
                              <Clock className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden sm:inline">Audio expiré</span>
                              <span className="sm:hidden">Expiré</span>
                            </>
                          ) : audioAvailable === false ? (
                            <>
                              <Clock className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden sm:inline">Revérifier l'audio</span>
                              <span className="sm:hidden">Revérifier</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden sm:inline">Télécharger Audio</span>
                              <span className="sm:hidden">Audio</span>
                            </>
                          )}
                        </button>
                        {audioTimeRemaining && audioAvailable && !audioTimeRemaining.includes('Expiré') && (
                          <div className="absolute -bottom-5 left-0 right-0 text-xs text-center whitespace-nowrap">
                            <span className={`font-semibold ${audioTimeRemaining.includes('minutes') && !audioTimeRemaining.includes('h') ? 'text-amber-600' : 'text-blue-600'}`}>
                              ⏰ {audioTimeRemaining}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={async () => {
                        const emailBody = await prepareInitialEmailBody();
                        setInitialEmailBody(emailBody);
                        setShowEmailComposer(true);
                      }}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 text-cocoa-600 hover:text-cocoa-800 hover:bg-orange-50 rounded-lg md:rounded-xl transition-colors font-semibold border-2 border-transparent hover:border-orange-200 text-sm md:text-base flex-1 sm:flex-initial justify-center"
                    >
                      <Mail className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Envoyer par email</span>
                      <span className="sm:hidden">Email</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-3 text-cocoa-600 hover:text-cocoa-800 hover:bg-orange-50 rounded-lg md:rounded-xl transition-colors font-semibold border-2 border-transparent hover:border-orange-200 text-sm md:text-base flex-1 sm:flex-initial justify-center"
                    >
                      <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="hidden sm:inline">Modifier</span>
                      <span className="sm:hidden">Modifier</span>
                    </button>
                  </>
                )}
              </div>
            </div>

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
                    {meeting.title}
                  </h1>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-cocoa-600 font-medium text-xs md:text-base">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 text-sunset-500" />
                    <span className="truncate">{formatDate(meeting.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-sunset-500" />
                    <span>Durée : {formatDuration(meeting.duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 md:px-8 border-t-2 border-orange-100 bg-gradient-to-r from-orange-50/50 to-red-50/50 overflow-x-auto flex-shrink-0">
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

        <div className="p-4 md:p-10 flex-1 overflow-auto flex justify-center">
          <div className="w-full max-w-5xl">
          {!isEditing && (meeting.participant_first_name || meeting.participant_last_name || meeting.participant_email || meeting.attachment_name) && (
            <div className="mb-8">
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border-2 border-orange-100">
                <h3 className="text-xl font-bold text-cocoa-800 mb-4">Informations du participant</h3>
                {(meeting.participant_first_name || meeting.participant_last_name) && (
                  <p className="text-cocoa-700 mb-2">
                    <span className="font-semibold">Nom :</span> {meeting.participant_first_name} {meeting.participant_last_name}
                  </p>
                )}
                {meeting.participant_email && (
                  <p className="text-cocoa-700 mb-2">
                    <span className="font-semibold">Email :</span> {meeting.participant_email}
                  </p>
                )}
                {meeting.attachment_name && (
                  <div className="mt-3">
                    <span className="font-semibold text-cocoa-700">Fichier joint :</span>
                    <a
                      href={meeting.attachment_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 ml-2 px-4 py-2 bg-coral-500 text-white rounded-xl hover:bg-coral-600 transition-colors"
                    >
                      <Paperclip className="w-4 h-4" />
                      {meeting.attachment_name}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'summary' ? (
            <div>
              {isEditing ? null : (
                <>
                  {meeting.notes && (
                    <div className="mb-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-5 h-5 text-amber-600" />
                        <h4 className="text-lg font-bold text-cocoa-800">Notes prises pendant l'enregistrement</h4>
                      </div>
                      <p className="text-cocoa-700 whitespace-pre-wrap leading-relaxed">
                        {meeting.notes}
                      </p>
                    </div>
                  )}
                  <div className="prose prose-slate max-w-none">
                    <div ref={summaryRef} className="text-cocoa-800 whitespace-pre-wrap leading-relaxed text-lg cursor-text">
                      {renderSummaryWithBold(meeting.summary)}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'transcript' ? (
            <div>
              {isEditing ? null : (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border-2 border-orange-100">
                  <div ref={transcriptRef} className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-coral-300 scrollbar-track-coral-100 cursor-text">
                    {(meeting.display_transcript || meeting.transcript) ? (
                      <div className="space-y-3">
                        {(meeting.display_transcript || meeting.transcript || '').split(/--- \d+s ---/).map((chunk, index) => {
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
                                  <p className="text-cocoa-700 leading-relaxed text-sm">
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
            <div>
              {(clarifications.length > 0 || topics.length > 0) ? (
                <div className="space-y-4">
                  {clarifications.length > 0 && (
                    <div className="bg-white rounded-2xl p-6 border-2 border-purple-100 shadow-sm">
                      <h4 className="text-sm font-bold text-purple-900 mb-3">Points à clarifier</h4>
                      <div className="max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100">
                        <ul className="space-y-2">
                        {clarifications.map((c) => (
                          <li key={c.id} className="flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="text-cocoa-700 text-sm leading-relaxed">{c.content}</span>
                          </li>
                        ))}
                      </ul>
                      </div>
                    </div>
                  )}
                  {topics.length > 0 && (
                    <div className="bg-white rounded-2xl p-6 border-2 border-purple-100 shadow-sm">
                      <h4 className="text-sm font-bold text-purple-900 mb-3">Sujets à explorer</h4>
                      <div className="max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100">
                      <div className="flex flex-wrap gap-2">
                        {topics.map((t) => (
                          <span key={t.id} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                            {t.topic}
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
      </div>

      {/* Nouveau composant EmailComposer */}
      {showEmailComposer && (
        <EmailComposer
          subject={meeting.title}
          initialBody={initialEmailBody}
          recipients={[{ email: '' }]}
          ccRecipients={[]}
          bccRecipients={[]}
          attachments={emailAttachments}
          onSend={handleEmailSend}
          onClose={() => setShowEmailComposer(false)}
          isSending={isSendingEmail}
        />
      )}

      {/* Modal de succès */}
      <EmailSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        recipientCount={successModalData.recipientCount}
        method={successModalData.method}
      />

      {/* Modal de correction de mots */}
      <WordCorrectionModal
        isOpen={showWordCorrection}
        onClose={() => {
          setShowWordCorrection(false);
          setSelectedWord('');
          setWordPosition(null);
        }}
        word={selectedWord}
        onReplace={handleWordReplace}
        userId={meeting.user_id}
      />

      {/* Modal d'édition en plein écran */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-coral-500 to-sunset-500 p-6 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Edit2 className="w-6 h-6 text-white" />
                <h2 className="text-2xl font-bold text-white">Modification de la réunion</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-semibold"
                >
                  <X className="w-5 h-5" />
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-coral-600 hover:bg-orange-50 rounded-xl transition-colors font-semibold shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  Enregistrer
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Titre */}
              <div>
                <label className="block text-sm font-bold text-cocoa-800 mb-2">
                  Titre de la réunion
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-coral-500 text-cocoa-800 text-lg font-semibold"
                  placeholder="Titre de la réunion"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-cocoa-800 mb-2">
                  <FileText className="w-4 h-4 inline mr-2 text-amber-600" />
                  Notes prises pendant l'enregistrement
                </label>
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Ajoutez vos notes ici..."
                  className="w-full min-h-[150px] p-4 border-2 border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-cocoa-800 leading-relaxed bg-gradient-to-br from-amber-50 to-orange-50 resize-y"
                />
              </div>

              {/* Résumé IA */}
              <div className="flex-1">
                <label className="block text-sm font-bold text-cocoa-800 mb-2">
                  Résumé IA
                </label>
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  placeholder="Le résumé généré par l'IA apparaîtra ici..."
                  className="w-full min-h-[500px] p-6 border-2 border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-coral-500 text-cocoa-800 text-lg leading-relaxed resize-y"
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
