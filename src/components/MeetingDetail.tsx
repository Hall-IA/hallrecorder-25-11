import { ArrowLeft, Calendar, Clock, Edit2, FileText, Mail, Save, X, Paperclip, Download, FileDown, RotateCw, Sparkles, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Meeting, EmailAttachment, supabase } from '../lib/supabase';
import { generatePDFFromHTML } from '../services/pdfGenerator';
import { EmailComposer } from './EmailComposer';
import { generateEmailBody } from '../services/emailTemplates';
import { EmailSuccessModal } from './EmailSuccessModal';
import { WordCorrectionModal } from './WordCorrectionModal';
import { SummaryMode, generateSummary } from '../services/transcription';
import { invalidateDictionaryCache } from '../services/dictionaryCorrection';
import { SummaryRegenerationModal } from './SummaryRegenerationModal';
import { useDialog } from '../context/DialogContext';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: () => void;
  userDefaultSummaryMode?: SummaryMode | null;
}

const inferSummaryValues = (meeting: Meeting) => {
  const base = meeting.summary || '';
  return {
    detailed: meeting.summary_detailed ?? base,
    short: meeting.summary_short ?? base,
  };
};

export const MeetingDetail = ({ meeting, onBack, onUpdate, userDefaultSummaryMode }: MeetingDetailProps) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'suggestions'>('summary');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(meeting.title);
  // Priorité : mode par défaut de l'utilisateur > mode du résumé de la réunion > 'detailed'
  const [activeSummaryMode, setActiveSummaryMode] = useState<SummaryMode>(
    userDefaultSummaryMode || (meeting.summary_mode as SummaryMode) || 'detailed'
  );
  const [editedSummaries, setEditedSummaries] = useState(() => inferSummaryValues(meeting));
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
  const [showRegenerationModal, setShowRegenerationModal] = useState(false);
  const [regenerationMode, setRegenerationMode] = useState<SummaryMode>('detailed');
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [isGeneratingFailedSummary, setIsGeneratingFailedSummary] = useState(false);
  const [isGeneratingMissingSummary, setIsGeneratingMissingSummary] = useState<SummaryMode | null>(null);
  const canRegenerateSummary = useMemo(() => !meeting.summary_regenerated && !meeting.summary_failed, [meeting.summary_regenerated, meeting.summary_failed]);
  const needsSummaryGeneration = useMemo(() => meeting.summary_failed === true, [meeting.summary_failed]);
  const hasTranscript = useMemo(() => Boolean((meeting.transcript || '').trim().length), [meeting.transcript]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { showAlert, showConfirm } = useDialog();
  const meetingSummaries = useMemo(() => inferSummaryValues(meeting), [meeting.summary_detailed, meeting.summary_short, meeting.summary, meeting.id]);
  const displaySummaries = isEditing ? editedSummaries : meetingSummaries;
  const currentSummaryText = displaySummaries[activeSummaryMode] || '';
  
  // Vérifier si chaque résumé existe VRAIMENT (pas juste un fallback ou une copie)
  const { hasDetailedSummary, hasShortSummary } = useMemo(() => {
    const detailedContent = (meeting.summary_detailed || '').trim();
    const shortContent = (meeting.summary_short || '').trim();
    const mainContent = (meeting.summary || '').trim();
    const summaryMode = meeting.summary_mode || 'detailed';
    
    // Si les deux résumés sont identiques, c'est probablement une copie
    // On ne considère que celui du mode par défaut comme existant
    const areSummariesIdentical = detailedContent && shortContent && detailedContent === shortContent;
    
    if (areSummariesIdentical) {
      // Seul le résumé du mode par défaut existe vraiment
      return {
        hasDetailedSummary: summaryMode === 'detailed',
        hasShortSummary: summaryMode === 'short'
      };
    }
    
    // Sinon, vérifier chaque résumé individuellement
    const hasDetailed = Boolean(detailedContent) || (summaryMode === 'detailed' && Boolean(mainContent));
    const hasShort = Boolean(shortContent) || (summaryMode === 'short' && Boolean(mainContent));
    
    return {
      hasDetailedSummary: hasDetailed,
      hasShortSummary: hasShort
    };
  }, [meeting.summary_detailed, meeting.summary_short, meeting.summary, meeting.summary_mode]);

  useEffect(() => {
    setEditedTitle(meeting.title);
    setEditedSummaries(inferSummaryValues(meeting));
    setEditedTranscript(meeting.display_transcript || meeting.transcript || '');
    setEditedNotes(meeting.notes || '');
  }, [
    meeting.id,
    meeting.title,
    meeting.display_transcript,
    meeting.transcript,
    meeting.notes,
    meeting.summary_detailed,
    meeting.summary_short,
    meeting.summary,
  ]);

  useEffect(() => {
    // Priorité : mode par défaut de l'utilisateur > mode du résumé de la réunion > 'detailed'
    setActiveSummaryMode(userDefaultSummaryMode || (meeting.summary_mode as SummaryMode) || 'detailed');
  }, [meeting.id, meeting.summary_mode, userDefaultSummaryMode]);

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
  }, [editedSummaries.detailed, editedSummaries.short, editedTranscript, activeTab]);

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
        invalidateDictionaryCache(); // Invalider le cache pour les prochains résumés
      }
    }

    let updatedText = '';
    if (activeTab === 'summary') {
      const sourceSummaries = isEditing ? editedSummaries : meetingSummaries;
      const baseText = sourceSummaries[activeSummaryMode] || '';
      updatedText = replaceAll
        ? baseText.replace(new RegExp(`\\b${selectedWord}\\b`, 'gi'), newWord)
        : baseText.replace(selectedWord, newWord);

      console.log('📝 Mise à jour du résumé');
      const updatedSummaries =
        activeSummaryMode === 'detailed'
          ? { detailed: updatedText, short: sourceSummaries.short }
          : { detailed: sourceSummaries.detailed, short: updatedText };

      if (isEditing) {
        setEditedSummaries(updatedSummaries);
      }

      await supabase
        .from('meetings')
        .update({
          summary: activeSummaryMode === 'short' ? updatedSummaries.short : updatedSummaries.detailed,
          summary_detailed: updatedSummaries.detailed,
          summary_short: updatedSummaries.short,
          summary_mode: activeSummaryMode,
        })
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

  const handleOpenRegeneration = () => {
    setRegenerationMode(targetRegenerationMode);
    setRegenerationError(null);
    setShowRegenerationModal(true);
  };

  const handleCloseRegenerationModal = () => {
    if (isRegeneratingSummary) return;
    setShowRegenerationModal(false);
    setRegenerationError(null);
  };

  const handleConfirmRegeneration = async () => {
    if (!meeting.transcript || !meeting.transcript.trim()) {
      setRegenerationError('La transcription complète est introuvable pour cette réunion.');
      return;
    }

    try {
      setIsRegeneratingSummary(true);
      const [detailedResult, shortResult] = await Promise.all([
        generateSummary(meeting.transcript, meeting.user_id, 0, 'detailed'),
        generateSummary(meeting.transcript, meeting.user_id, 0, 'short'),
      ]);
      const detailedSummary = detailedResult.summary || '';
      const shortSummary = shortResult.summary || '';
      const finalTitle =
        (regenerationMode === 'detailed' ? detailedResult.title : shortResult.title)?.trim() ||
        detailedResult.title?.trim() ||
        shortResult.title?.trim() ||
        meeting.title;

      const { error } = await supabase
        .from('meetings')
        .update({
          title: finalTitle,
          summary: regenerationMode === 'short' ? shortSummary : detailedSummary,
          summary_detailed: detailedSummary,
          summary_short: shortSummary,
          summary_mode: regenerationMode,
          summary_regenerated: true,
        })
        .eq('id', meeting.id);

      if (error) {
        throw error;
      }

      setEditedTitle(finalTitle);
      setEditedSummaries({ detailed: detailedSummary, short: shortSummary });
      setActiveSummaryMode(regenerationMode);
      setShowRegenerationModal(false);
      setRegenerationError(null);
      onUpdate();
    } catch (err: any) {
      console.error('Erreur lors de la régénération:', err);
      setRegenerationError(err?.message || 'Impossible de régénérer le résumé.');
    } finally {
      setIsRegeneratingSummary(false);
    }
  };

  // Fonction pour générer le résumé pour les réunions où la génération avait échoué
  const handleGenerateFailedSummary = async () => {
    if (!meeting.transcript || !meeting.transcript.trim()) {
      await showAlert({
        title: 'Transcription introuvable',
        message: 'La transcription complète est introuvable pour cette réunion.',
        variant: 'danger',
      });
      return;
    }

    const summaryMode = (meeting.summary_mode as SummaryMode) || 'detailed';

    try {
      setIsGeneratingFailedSummary(true);

      // Générer les deux versions du résumé
      const [detailedResult, shortResult] = await Promise.all([
        generateSummary(meeting.transcript, meeting.user_id, 0, 'detailed'),
        generateSummary(meeting.transcript, meeting.user_id, 0, 'short'),
      ]);

      const detailedSummary = detailedResult.summary || '';
      const shortSummary = shortResult.summary || '';
      const finalTitle =
        (summaryMode === 'detailed' ? detailedResult.title : shortResult.title)?.trim() ||
        detailedResult.title?.trim() ||
        shortResult.title?.trim() ||
        meeting.title;

      // Mettre à jour la réunion avec le résumé
      const { error } = await supabase
        .from('meetings')
        .update({
          title: finalTitle,
          summary: summaryMode === 'short' ? shortSummary : detailedSummary,
          summary_detailed: detailedSummary,
          summary_short: shortSummary,
          summary_mode: summaryMode,
          summary_failed: false, // Réinitialiser le flag
        })
        .eq('id', meeting.id);

      if (error) {
        throw error;
      }

      // Mettre à jour l'UI
      setEditedTitle(finalTitle);
      setEditedSummaries({ detailed: detailedSummary, short: shortSummary });
      setActiveSummaryMode(summaryMode);

      await showAlert({
        title: 'Résumé généré',
        message: 'Le résumé a été généré avec succès.',
        variant: 'success',
      });

      onUpdate();
    } catch (err: any) {
      console.error('Erreur lors de la génération du résumé:', err);
      await showAlert({
        title: 'Erreur',
        message: err?.message || 'Impossible de générer le résumé. Veuillez réessayer.',
        variant: 'danger',
      });
    } finally {
      setIsGeneratingFailedSummary(false);
    }
  };

  // Fonction pour générer un résumé manquant (court ou détaillé)
  const handleGenerateMissingSummary = async (mode: SummaryMode) => {
    if (!meeting.transcript || !meeting.transcript.trim()) {
      await showAlert({
        title: 'Transcription introuvable',
        message: 'La transcription complète est introuvable pour cette réunion.',
        variant: 'danger',
      });
      return;
    }

    try {
      setIsGeneratingMissingSummary(mode);

      // Générer seulement le résumé manquant
      const result = await generateSummary(meeting.transcript, meeting.user_id, 0, mode);
      const newSummary = result.summary || '';

      // Préparer les données de mise à jour
      const updateData: Record<string, any> = {
        summary_regenerated: true, // Marquer comme régénéré
      };

      if (mode === 'detailed') {
        updateData.summary_detailed = newSummary;
        // Mettre à jour le summary principal si c'était le mode par défaut
        if (!meeting.summary || meeting.summary_mode === 'detailed') {
          updateData.summary = newSummary;
        }
      } else {
        updateData.summary_short = newSummary;
        // Mettre à jour le summary principal si c'était le mode par défaut
        if (!meeting.summary || meeting.summary_mode === 'short') {
          updateData.summary = newSummary;
        }
      }

      const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meeting.id);

      if (error) {
        throw error;
      }

      // Mettre à jour l'UI
      setEditedSummaries(prev => ({
        ...prev,
        [mode]: newSummary
      }));
      setActiveSummaryMode(mode);

      onUpdate();
    } catch (err: any) {
      console.error('Erreur lors de la génération du résumé:', err);
      await showAlert({
        title: 'Erreur',
        message: err?.message || 'Impossible de générer le résumé. Veuillez réessayer.',
        variant: 'danger',
      });
    } finally {
      setIsGeneratingMissingSummary(null);
    }
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

    const summaryForEmail = isEditing ? editedSummaries[activeSummaryMode] : meetingSummaries[activeSummaryMode];

    return await generateEmailBody({
      title: meeting.title,
      date: formatDate(meeting.created_at),
      duration: meeting.duration ? formatDuration(meeting.duration) : undefined,
      participantName: meeting.participant_first_name && meeting.participant_last_name
        ? `${meeting.participant_first_name} ${meeting.participant_last_name}`
        : undefined,
      participantEmail: meeting.participant_email || undefined,
      summary: summaryForEmail || '',
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

    // Utiliser la méthode sélectionnée dans le composeur (pas les settings)
    const selectedMethod = emailData.method === 'app' ? 'local' : emailData.method;
    console.log('🔍 [MeetingDetail] Méthode sélectionnée dans EmailComposer:', emailData.method, '→', selectedMethod);

    try {
      // 🎯 NOUVELLE APPROCHE: Envoi individuel pour tracking précis
      const { sendIndividualEmails } = await import('../services/individualEmailSender');

      const result = await sendIndividualEmails(
        emailData,
        selectedMethod as 'smtp' | 'gmail' | 'local',
        meeting?.id,
        meeting.user_id
      );

      if (!result.success && result.failed.length > 0) {
        throw new Error(`Échec d'envoi pour : ${result.failed.join(', ')}`);
      }

      // Afficher le modal de succès
      const totalRecipients = emailData.recipients.length + emailData.ccRecipients.length + emailData.bccRecipients.length;
      setSuccessModalData({ recipientCount: result.totalSent, method: selectedMethod });
      setShowSuccessModal(true);
      setShowEmailComposer(false);
      
      console.log(`✅ ${result.totalSent} emails envoyés individuellement pour tracking précis`);
      return;
      
      /* CODE ANCIEN COMMENTÉ - À SUPPRIMER APRÈS TESTS
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
      */

      /* CODE ANCIEN - REMPLACÉ PAR sendIndividualEmails()
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
      FIN CODE ANCIEN COMMENTÉ */
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
      
      await showAlert({
        title: 'Erreur lors de l\'envoi',
        message: `❌ Erreur lors de l'envoi de l'email:\n${error.message}\n\n${emailMethod === 'smtp' ? 'Vérifiez votre configuration SMTP dans les Paramètres.' : ''}`,
        variant: 'danger',
      });
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
          summary: editedSummaries[activeSummaryMode] || '',
          summary_detailed: editedSummaries.detailed || '',
          summary_short: editedSummaries.short || '',
          summary_mode: activeSummaryMode,
          transcript: cleanTranscript, // Version propre pour le résumé
          display_transcript: editedTranscript, // Version avec séparateurs pour l'affichage
          notes: editedNotes,
        })
        .eq('id', meeting.id);

      if (error) throw error;

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      await showAlert({
        title: 'Erreur lors de la sauvegarde',
        message: 'Erreur lors de la sauvegarde des modifications',
        variant: 'danger',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(meeting.title);
    setEditedSummaries(inferSummaryValues(meeting));
    setEditedTranscript(meeting.display_transcript || meeting.transcript || '');
    setEditedNotes(meeting.notes || '');
    setActiveSummaryMode(userDefaultSummaryMode || (meeting.summary_mode as SummaryMode) || 'detailed');
    setIsEditing(false);
  };


  const handleDownloadPDF = async () => {
    try {
      await generatePDFFromHTML(
        meeting.title,
        currentSummaryText || ''
      );
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      await showAlert({
        title: 'Erreur PDF',
        message: 'Erreur lors de la génération du PDF. Veuillez réessayer.',
        variant: 'danger',
      });
    }
  };

  const handleDownloadAudio = async () => {
    if (!meeting.audio_url) {
      await showAlert({
        title: 'Audio indisponible',
        message: 'Aucun fichier audio disponible pour cette réunion.',
        variant: 'warning',
      });
      return;
    }

    // Avertissement sur la durée de disponibilité (24h)
    const shouldDownload = await showConfirm({
      title: 'Télécharger l\'audio ?',
      message:
        '⚠️ IMPORTANT : Disponibilité limitée\n\n' +
        'L\'audio sera automatiquement supprimé 24 heures après sa création.\n\n' +
        'Téléchargez-le maintenant si vous souhaitez le conserver.\n\n' +
        'Voulez-vous continuer le téléchargement ?',
      confirmLabel: 'Télécharger',
      variant: 'warning',
    });

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
        await showAlert({
          title: 'Audio en cours de préparation',
          message: 'L\'audio n\'est pas encore disponible. Veuillez patienter quelques instants et réessayer.',
          variant: 'info',
        });
        setAudioAvailable(false);
        // Revérifier après quelques secondes
        setTimeout(() => checkAudioAvailability(), 3000);
      } else {
        await showAlert({
          title: 'Erreur de téléchargement',
          message: 'Erreur lors du téléchargement de l\'audio. Veuillez réessayer.',
          variant: 'danger',
        });
      }
    } finally {
      setIsDownloadingAudio(false);
    }
  };



  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border-2 border-orange-100 h-full flex flex-col">
        <div className="bg-gradient-to-r from-coral-500 to-sunset-500 p-4 md:p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Edit2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
            <h2 className="text-xl md:text-2xl font-bold text-white">Modification de la réunion</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-lg md:rounded-xl transition-colors font-semibold text-sm md:text-base"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Annuler</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-white text-coral-600 hover:bg-orange-50 rounded-lg md:rounded-xl transition-colors font-semibold shadow-lg text-sm md:text-base"
            >
              <Save className="w-4 h-4 md:w-5 md:h-5" />
              Enregistrer
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
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

          <div>
            <label className="block text-sm font-bold text-cocoa-800 mb-2">
              <FileText className="w-4 h-4 inline mr-2 text-amber-600" />
              Notes prises pendant l'enregistrement
            </label>
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="Ajoutez vos notes ici..."
              className="w-full min-h-[100px] p-4 border-2 border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-cocoa-800 leading-relaxed bg-gradient-to-br from-amber-50 to-orange-50 resize-y"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-bold text-cocoa-800 mb-2">
              Résumé IA · {activeSummaryMode === 'short' ? 'Version courte' : 'Version détaillée'}
            </label>
            <textarea
              value={editedSummaries[activeSummaryMode] || ''}
              onChange={(e) =>
                setEditedSummaries((prev) => ({
                  ...prev,
                  [activeSummaryMode]: e.target.value,
                }))
              }
              placeholder="Le résumé généré par l'IA apparaîtra ici..."
              className="w-full min-h-[500px] p-6 border-2 border-orange-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-coral-500 text-cocoa-800 text-lg leading-relaxed resize-y"
            />
          </div>
        </div>
      </div>
    );
  }

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
              </div>
            </div>

            <div className="flex items-start gap-3 md:gap-5">
              <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl">
                <FileText className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-4xl font-bold bg-gradient-to-r from-coral-600 to-sunset-600 bg-clip-text text-transparent mb-2 md:mb-4 break-words">
                  {meeting.title}
                </h1>
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

          <div className="flex flex-wrap items-center gap-3 px-4 md:px-8 border-t-2 border-orange-100 bg-gradient-to-r from-orange-50/50 to-red-50/50 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
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
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-coral-500 to-orange-500 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('transcript')}
                className={`px-4 md:px-8 py-3 md:py-4 text-sm md:text-base font-bold transition-all relative rounded-t-xl whitespace-nowrap ${
                  activeTab === 'transcript'
                    ? 'text-amber-600 bg-white'
                    : 'text-cocoa-600 hover:text-amber-500 hover:bg-orange-50/50'
                }`}
              >
                Transcription
                {activeTab === 'transcript' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-red-500 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('suggestions')}
                className={`px-4 md:px-8 py-3 md:py-4 text-sm md:text-base font-bold transition-all relative rounded-t-xl whitespace-nowrap ${
                  activeTab === 'suggestions'
                    ? 'text-purple-600 bg-white'
                    : 'text-cocoa-600 hover:text-purple-500 hover:bg-purple-50/50'
                }`}
              >
                Suggestions
                {activeTab === 'suggestions' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" />
                )}
              </button>
            </div>

            {/* Bouton pour générer le résumé si la génération avait échoué */}
            {needsSummaryGeneration && (
              <button
                onClick={handleGenerateFailedSummary}
                disabled={isGeneratingFailedSummary}
                className="ml-auto inline-flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base font-semibold text-amber-600 border-2 border-amber-200 rounded-2xl bg-white hover:bg-amber-50 hover:text-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingFailedSummary ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Générer le résumé
                  </>
                )}
              </button>
            )}

          </div>
        </div>

        <div className="p-4 md:p-10 flex-1 overflow-auto flex justify-center">
          <div className="w-full max-w-5xl">
          {(meeting.participant_first_name || meeting.participant_last_name || meeting.participant_email || meeting.attachment_name) && (
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
              {/* Avertissement si la génération de résumé avait échoué */}
              {needsSummaryGeneration && (
                <div className="mb-8 bg-gradient-to-br from-amber-50 to-orange-100 rounded-2xl p-6 border-2 border-amber-300">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-lg font-bold text-amber-800 mb-2">Résumé non généré</h4>
                      <p className="text-amber-700 mb-4">
                        La génération du résumé a échoué lors de l'enregistrement, mais votre transcription a été sauvegardée.
                        Cliquez sur le bouton "Générer le résumé" ci-dessus pour créer le résumé maintenant.
                      </p>
                      <button
                        onClick={handleGenerateFailedSummary}
                        disabled={isGeneratingFailedSummary}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold disabled:opacity-50"
                      >
                        {isGeneratingFailedSummary ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin" />
                            Génération en cours...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Générer le résumé maintenant
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Tab Résumé détaillé ou bouton pour le générer */}
                {hasDetailedSummary ? (
                  <button
                    onClick={() => setActiveSummaryMode('detailed')}
                    className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                      activeSummaryMode === 'detailed'
                        ? 'bg-coral-100 text-coral-700 border-coral-300 shadow-sm'
                        : 'text-cocoa-500 border-cocoa-200 hover:border-coral-200 hover:text-coral-600'
                    }`}
                  >
                    Résumé détaillé
                  </button>
                ) : (
                  <button
                    onClick={() => handleGenerateMissingSummary('detailed')}
                    disabled={isGeneratingMissingSummary !== null || !hasTranscript}
                    className="px-4 py-2 rounded-full border text-sm font-semibold transition-all border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGeneratingMissingSummary === 'detailed' ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Générer résumé détaillé
                      </>
                    )}
                  </button>
                )}
                
                {/* Tab Résumé court ou bouton pour le générer */}
                {hasShortSummary ? (
                  <button
                    onClick={() => setActiveSummaryMode('short')}
                    className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                      activeSummaryMode === 'short'
                        ? 'bg-orange-100 text-orange-700 border-orange-300 shadow-sm'
                        : 'text-cocoa-500 border-cocoa-200 hover:border-orange-200 hover:text-orange-600'
                    }`}
                  >
                    Résumé court
                  </button>
                ) : (
                  <button
                    onClick={() => handleGenerateMissingSummary('short')}
                    disabled={isGeneratingMissingSummary !== null || !hasTranscript}
                    className="px-4 py-2 rounded-full border text-sm font-semibold transition-all border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGeneratingMissingSummary === 'short' ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Générer résumé court
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="prose prose-slate max-w-none">
                <div ref={summaryRef} className="text-cocoa-800 whitespace-pre-wrap leading-relaxed text-lg cursor-text">
                  {renderSummaryWithBold(currentSummaryText)}
                </div>
              </div>
            </div>
          ) : activeTab === 'transcript' ? (
            <div>
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

      <SummaryRegenerationModal
        isOpen={showRegenerationModal}
        meetingTitle={meeting.title}
        targetMode={regenerationMode}
        isProcessing={isRegeneratingSummary}
        errorMessage={regenerationError}
        onConfirm={handleConfirmRegeneration}
        onCancel={handleCloseRegenerationModal}
      />

    </>
  );
};
