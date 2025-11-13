import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, History, LogOut, Settings as SettingsIcon, Upload, LayoutDashboard, Mail, BellRing, PauseCircle, StopCircle, PlayCircle, X } from 'lucide-react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useLiveSuggestions } from './hooks/useLiveSuggestions';
import { RecordingControls } from './components/RecordingControls';
import { AudioVisualizer } from './components/AudioVisualizer';
import { FloatingRecordButton } from './components/FloatingRecordButton';
import { FloatingStartButton } from './components/FloatingStartButton';
import { RecordingModeSelector } from './components/RecordingModeSelector';
import { MeetingResult } from './components/MeetingResult';
import { MeetingHistory } from './components/MeetingHistory';
import { MeetingDetail } from './components/MeetingDetail';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { Settings } from './components/Settings';
import { Dashboard } from './components/Dashboard';
import { LiveSuggestions } from './components/LiveSuggestions';
import { AudioUpload } from './components/AudioUpload';
import { GmailCallback } from './components/GmailCallback';
import { SetupReminder } from './components/SetupReminder';
import { EmailHistory } from './components/EmailHistory';
import { ProcessingStatusModal } from './components/ProcessingStatusModal';
import { ProcessingModal } from './components/ProcessingModal';
import { EmailComposer } from './components/EmailComposer';
import { EmailSuccessModal } from './components/EmailSuccessModal';
import { QuotaReachedModal } from './components/QuotaReachedModal';
import { LowQuotaWarningModal } from './components/LowQuotaWarningModal';
import { QuotaFullModal } from './components/QuotaFullModal';
import { MobileVisioTipModal } from './components/MobileVisioTipModal';
import { LongRecordingReminderModal } from './components/LongRecordingReminderModal';
import { RecordingLimitModal } from './components/RecordingLimitModal';
import { ShortRecordingWarningModal } from './components/ShortRecordingWarningModal';
import { ContactSupport } from './components/ContactSupport';
import { supabase, Meeting } from './lib/supabase';
import { useBackgroundProcessing } from './hooks/useBackgroundProcessing';
import { transcribeAudio, generateSummary } from './services/transcription';
import { ensureWhisperCompatible } from './services/audioEncoding';
import { generateEmailBody } from './services/emailTemplates';

// Fonction pour nettoyer la transcription et supprimer les répétitions
const cleanTranscript = (transcript: string): string => {
  if (!transcript) return '';
  
  // Diviser en phrases
  const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const uniqueSentences: string[] = [];
  
  for (const sentence of sentences) {
    const normalizedSentence = sentence.toLowerCase().trim();
    
    // Vérifier si cette phrase n'existe pas déjà (avec une tolérance)
    const isDuplicate = uniqueSentences.some(existing => {
      const normalizedExisting = existing.toLowerCase().trim();
      return normalizedExisting === normalizedSentence ||
             normalizedExisting.includes(normalizedSentence) ||
             normalizedSentence.includes(normalizedExisting);
    });
    
    if (!isDuplicate && sentence.length > 10) { // Ignorer les phrases trop courtes
      uniqueSentences.push(sentence);
    }
  }
  
  return uniqueSentences.join('. ').trim() + (uniqueSentences.length > 0 ? '.' : '');
};

// Fonction pour formater la transcription avec séparateurs entre les chunks
const formatTranscriptWithSeparators = (partialTranscripts: string[]): string => {
  if (!partialTranscripts || partialTranscripts.length === 0) return '';
  
  return partialTranscripts
    .map((chunk, index) => {
      const timestamp = `--- ${(index * 15) + 15}s ---`; // Estimation du temps
      const cleanChunk = chunk.trim();
      if (!cleanChunk) return '';
      
      return `\n\n${timestamp}\n${cleanChunk}`;
    })
    .filter(chunk => chunk.trim())
    .join('');
};

function App() {
  // Détection immédiate du callback Gmail
  const getInitialView = () => {
    const path = window.location.pathname;
    const hash = window.location.hash.replace('#', '');

    // Callback Gmail a la priorité
    if (path === '/gmail-callback') {
      return 'gmail-callback' as const;
    }

    // Si un hash valide existe, l'utiliser
    if (hash && ['record', 'history', 'detail', 'settings', 'upload', 'dashboard', 'contact'].includes(hash)) {
      return hash as any;
    }

    // Par défaut, landing page
    return 'landing' as const;
  };

  const [view, setView] = useState<'landing' | 'auth' | 'record' | 'history' | 'detail' | 'settings' | 'upload' | 'dashboard' | 'gmail-callback' | 'contact'>(getInitialView());
  const [historyTab, setHistoryTab] = useState<'meetings' | 'emails'>('meetings'); // Onglet d'historique
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [result, setResult] = useState<{ title: string; transcript: string; summary: string; audioUrl?: string | null; meetingId?: string } | null>(null);
  const [partialTranscripts, setPartialTranscripts] = useState<string[]>([]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isMeetingDetailLoading, setIsMeetingDetailLoading] = useState(false);
  const [meetingToEmail, setMeetingToEmail] = useState<Meeting | null>(null);
  const [emailBody, setEmailBody] = useState<string>('');
  const [showEmailSuccessModal, setShowEmailSuccessModal] = useState(false);
  const [emailSuccessData, setEmailSuccessData] = useState<{ recipientCount: number; method: 'gmail' | 'smtp' }>({ recipientCount: 0, method: 'smtp' });
  const [user, setUser] = useState<any>(null);
  // Pas de loading si on est sur le callback Gmail
  const [isAuthLoading, setIsAuthLoading] = useState(window.location.pathname !== '/gmail-callback');
  const [historyScrollPosition, setHistoryScrollPosition] = useState<number>(0);
  const [historyCurrentPage, setHistoryCurrentPage] = useState<number>(() => {
    const saved = localStorage.getItem('meetingHistoryPage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [isMeetingsLoading, setIsMeetingsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [meetingsLoaded, setMeetingsLoaded] = useState(false); // Cache flag
  const [recordingNotes, setRecordingNotes] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const lastProcessedSizeRef = useRef<number>(0);
  const [activeSuggestionsTab, setActiveSuggestionsTab] = useState<'clarify' | 'explore'>('clarify');
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [selectedRecordingMode, setSelectedRecordingMode] = useState<'microphone' | 'system' | 'visio'>('microphone');
  const [showQuotaReachedModal, setShowQuotaReachedModal] = useState(false);
  const [quotaModalData, setQuotaModalData] = useState<{ minutesUsed: number; quota: number }>({ minutesUsed: 0, quota: 600 });
  const [showLowQuotaWarning, setShowLowQuotaWarning] = useState(false);
  const [lowQuotaRemainingMinutes, setLowQuotaRemainingMinutes] = useState(0);
  const [showQuotaFullModal, setShowQuotaFullModal] = useState(false);
  const [showMobileVisioTip, setShowMobileVisioTip] = useState(false);
  const [pendingVisioRecording, setPendingVisioRecording] = useState(false);
  const [contactReloadTrigger, setContactReloadTrigger] = useState(0);
  const [showLongRecordingReminder, setShowLongRecordingReminder] = useState(false);
  const [showRecordingLimitModal, setShowRecordingLimitModal] = useState(false);
  const [showShortRecordingModal, setShowShortRecordingModal] = useState(false);
  const [shortRecordingSeconds, setShortRecordingSeconds] = useState(0);
  const [recordingReminderToast, setRecordingReminderToast] = useState<{ message: string } | null>(null);
  const categoryColorSupportedRef = useRef<boolean | null>(null);

  const {
    tasks: backgroundTasks,
    removeTask,
    clearCompletedTasks,
    hasActiveTasks,
  } = useBackgroundProcessing(user?.id);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    recordingMode,
    audioStream,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    setRecordingMode,
    getLast15sWav,
  } = useAudioRecorder();

  const {
    suggestions,
    isAnalyzing,
    analyzePartialTranscript,
    clearSuggestions,
    getLatestSuggestion,
  } = useLiveSuggestions();

  const sendRecordingNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const showNotification = () => {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch (error) {
        console.warn('Notification non envoyée:', error);
      }
    };

    try {
      if (Notification.permission === 'granted') {
        showNotification();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission()
          .then((permission) => {
            if (permission === 'granted') {
              showNotification();
            }
          })
          .catch((error) => console.warn('Permission notification refusée:', error));
      }
    } catch (error) {
      console.warn('Notification non supportée:', error);
    }
  }, []);

  const playReminderSound = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          /* noop */
        });
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 1);
    } catch (error) {
      console.warn('Impossible de jouer le son de rappel:', error);
    }
  }, []);

  const partialAnalysisTimerRef = useRef<number | null>(null);
  const liveTranscriptRef = useRef<string>('');
  const recentChunksRef = useRef<string[]>([]);
  const longRecordingReminderRef = useRef(false);
  const recordingLimitRef = useRef(false);
  const skipProcessingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  // ⚠️ Valeurs réduites pour les tests (2 minutes & 4 minutes). Remettre 2*60*60 et 4*60*60 en prod.
  const TWO_HOURS_IN_SECONDS = 1 * 60 * 60; // 2 heures
  const FOUR_HOURS_IN_SECONDS = 2 * 60 * 60; // 4 heures
  const MIN_RECORDING_SECONDS = 60;


  useEffect(() => {
    // Si on est sur le callback Gmail, ne pas exécuter la logique normale
    if (window.location.pathname === '/gmail-callback') {
      console.log('🔄 Page de callback Gmail détectée, skip initialisation normale');
      return;
    }

    checkUser();

    // Restaurer la vue depuis l'URL (hash) au chargement
    const hash = window.location.hash.replace('#', '');
    if (hash && ['record', 'history', 'upload', 'settings', 'dashboard', 'contact'].includes(hash)) {
      console.log('🔄 Restauration de la vue depuis l\'URL:', hash);
      setView(hash as any);
    } else if (hash === 'detail') {
      // Si on est sur detail sans réunion, rediriger vers history
      console.log('⚠️ Vue detail sans réunion, redirection vers history');
      setView('history');
      window.history.replaceState({ view: 'history' }, '', '#history');
    } else if (hash && hash !== '') {
      // Hash invalide, rediriger vers record
      console.log('⚠️ Hash invalide:', hash, 'redirection vers record');
      setView('record');
      window.history.replaceState({ view: 'record' }, '', '#record');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Ne changer la vue que lors de la connexion initiale, pas à chaque changement d'état
      if (session?.user && event === 'SIGNED_IN') {
        // Si on a déjà une vue depuis l'URL, ne pas la changer
        const currentHash = window.location.hash.replace('#', '');
        if (!currentHash || !['record', 'history', 'upload', 'settings', 'dashboard', 'contact'].includes(currentHash)) {
          setView('record');
          window.history.replaceState({ view: 'record' }, '', '#record');
        }
        loadMeetings();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Charger les réunions quand l'utilisateur change
  useEffect(() => {
    if (user) {
      loadMeetings();
    }
  }, [user]);

  // Recharger les réunions quand on navigue vers certaines vues
  useEffect(() => {
    if (user && (view === 'record' || view === 'history' || view === 'dashboard')) {
      console.log('🔄 Vue changée vers', view, '- rechargement des réunions si nécessaire');
      loadMeetings(); // Ceci ne fera rien si déjà chargé (sauf si forceReload=true)
    }
    // Forcer le rechargement de la config email quand on navigue vers Contact
    if (view === 'contact') {
      console.log('🔄 Navigation vers Contact, trigger de rechargement de la config');
      setContactReloadTrigger(prev => prev + 1);
    }
  }, [view, user]);

  // Gestion de la navigation avec le bouton retour du navigateur et changement de hash
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      // Ignorer si pas d'état ou si on est déjà sur la bonne vue
      if (!state || !state.view) {
        // Essayer de lire depuis le hash si pas d'état
        const hash = window.location.hash.replace('#', '');
        if (hash && ['record', 'history', 'upload', 'settings', 'dashboard', 'contact'].includes(hash)) {
          console.log('🔄 Restauration depuis hash:', hash);
          setView(hash as any);
        } else if (hash === 'detail') {
          // Rediriger vers history si on est sur detail sans réunion
          console.log('⚠️ Vue detail sans réunion, redirection vers history');
          setView('history');
          window.history.replaceState({ view: 'history' }, '', '#history');
        } else if (hash && hash !== '') {
          // Hash invalide
          console.log('⚠️ Hash invalide:', hash, 'redirection vers record');
          setView('record');
          window.history.replaceState({ view: 'record' }, '', '#record');
        }
        return;
      }
      
      console.log('🔙 Navigation arrière vers:', state.view);
      setView(state.view);
      if (state.selectedMeetingId) {
        setSelectedMeetingId(state.selectedMeetingId);
      } else {
        setSelectedMeetingId(null);
      }
    };

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['record', 'history', 'upload', 'settings', 'dashboard', 'contact'].includes(hash)) {
        console.log('🔄 Hash changé:', hash);
        setView(hash as any);
      } else if (hash === 'detail') {
        // Ne rien faire - laisser le useEffect gérer la redirection si nécessaire
        console.log('🔄 Hash detail détecté, conservation de la vue actuelle');
      } else if (hash && hash !== '') {
        // Hash invalide
        console.log('⚠️ Hash invalide:', hash);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [view, selectedMeeting]);

  // Rediriger automatiquement si on est sur detail sans réunion
  useEffect(() => {
    if (view === 'detail' && !selectedMeeting && !isAuthLoading && user) {
      console.log('⚠️ Vue detail sans réunion sélectionnée, redirection vers history');
      setView('history');
      window.history.replaceState({ view: 'history' }, '', '#history');
    }
  }, [view, selectedMeeting, isAuthLoading, user]);

  // Mettre à jour l'historique du navigateur quand la vue change
  useEffect(() => {
    if (!view || isAuthLoading || !user) {
      return;
    }
    
    const state = { view, selectedMeetingId };
    const currentState = window.history.state;
    
    // Si pas d'état, initialiser avec replaceState
    if (!currentState) {
      window.history.replaceState(state, '', `#${view}`);
      return;
    }
    
    // Sinon, vérifier si l'état est différent avant de pousser
    if (currentState.view !== view || currentState.selectedMeetingId !== selectedMeetingId) {
      console.log('📝 Mise à jour historique:', view);
      window.history.pushState(state, '', `#${view}`);
    }
  }, [view, selectedMeetingId, isAuthLoading, user]);

  useEffect(() => {
    console.log('🔍 useEffect audioBlob/isRecording:', { 
      hasAudioBlob: !!audioBlob, 
      isRecording,
      audioBlobSize: audioBlob?.size 
    });
    
    if (audioBlob && !isRecording) {
      console.log('✅ Conditions remplies pour processRecording');
      
      // Arrêter le timer d'analyse partielle
      if (partialAnalysisTimerRef.current) {
        console.log('⏹️ Arrêt du timer d\'analyse partielle');
        clearInterval(partialAnalysisTimerRef.current);
        partialAnalysisTimerRef.current = null;
      }
      
      // Arrêter le timer de vérification du quota
      if ((window as any).quotaCheckInterval) {
        console.log('⏹️ Arrêt du timer de vérification du quota');
        clearInterval((window as any).quotaCheckInterval);
        (window as any).quotaCheckInterval = null;
      }

      if (skipProcessingRef.current || recordingTime < MIN_RECORDING_SECONDS) {
        console.log('⏭️ Enregistrement ignoré (durée insuffisante)', {
          recordingTime,
          minimum: MIN_RECORDING_SECONDS,
          skipFlag: skipProcessingRef.current,
        });
        skipProcessingRef.current = false;
        setShowShortRecordingModal(false);
        setShortRecordingSeconds(0);
        resetRecording();
        liveTranscriptRef.current = '';
        setPartialTranscripts([]);
        lastProcessedSizeRef.current = 0;
        return;
      }
      
      console.log('🎬 Appel de processRecording depuis useEffect');
      processRecording();
    }
  }, [audioBlob, isRecording, recordingTime, resetRecording]);

  // Debug: tracker les états des modaux
  useEffect(() => {
    console.log('🔔 États modaux:', {
      showQuotaFullModal,
      showLowQuotaWarning,
      showQuotaReachedModal
    });
  }, [showQuotaFullModal, showLowQuotaWarning, showQuotaReachedModal]);

  useEffect(() => {
  if (!isRecording) {
    if (!showRecordingLimitModal) {
      recordingLimitRef.current = false;
    }
    if (!showLongRecordingReminder) {
      longRecordingReminderRef.current = false;
    }
    setRecordingReminderToast(null);
    return;
  }

  if (isPaused) {
    return;
  }

  if (!longRecordingReminderRef.current && recordingTime >= TWO_HOURS_IN_SECONDS) {
    longRecordingReminderRef.current = true;
    setRecordingReminderToast({
      message: 'Vous enregistrez depuis plus de 2 heures. Besoin d\'une pause ?'
    });
    playReminderSound();
    sendRecordingNotification('Rappel Hallia', 'Vous enregistrez depuis plus de 2 heures. Besoin d\'une pause ?');
  }

  if (!recordingLimitRef.current && recordingTime >= FOUR_HOURS_IN_SECONDS) {
      recordingLimitRef.current = true;
    setShowLongRecordingReminder(false);
    setRecordingReminderToast(null);
      setShowRecordingLimitModal(true);

      if ((window as any).quotaCheckInterval) {
        clearInterval((window as any).quotaCheckInterval);
        (window as any).quotaCheckInterval = null;
      }

      if (partialAnalysisTimerRef.current) {
        clearInterval(partialAnalysisTimerRef.current);
        partialAnalysisTimerRef.current = null;
    }

    playReminderSound();
    sendRecordingNotification('Hallia – limite atteinte', 'Votre enregistrement de 4h est terminé. Nous générons le résumé.');
    stopRecording();
  }
}, [
    isRecording,
    isPaused,
    recordingTime,
    showRecordingLimitModal,
    showLongRecordingReminder,
    playReminderSound,
    sendRecordingNotification,
    stopRecording,
  ]);

  // Avertissement avant de quitter/rafraîchir la page pendant un enregistrement ou traitement
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Vérifier si un enregistrement est en cours OU si un traitement est actif
      if (isRecording || isProcessing || hasActiveTasks()) {
        e.preventDefault();
        // Message de confirmation (le navigateur affichera son propre message)
        const message = 'Un traitement est en cours. Si vous quittez maintenant, vous perdrez votre progression. Voulez-vous vraiment quitter ?';
        e.returnValue = message; // Chrome/Edge
        return message; // Firefox/Safari
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording, isProcessing, hasActiveTasks]);

  // Forcer le rafraîchissement quand l'enregistrement démarre
  useEffect(() => {
    
    if (isRecording) {
      
      // Arrêter l'état de chargement
      setIsStartingRecording(false);
      // Forcer un re-render avec un délai plus long
      setTimeout(() => {
        setForceUpdate(prev => prev + 1);
        
      }, 500);
    } else {
      // Quand l'enregistrement s'arrête, remettre seulement le timer à zéro
      
      // Ne pas appeler resetRecording() ici car cela remet result à null
      // Le resetRecording() sera appelé après l'affichage du popup dans processRecording()
      
    }
  }, [isRecording]);

  // Nettoyer le timer si le composant est démonté
  useEffect(() => {
    return () => {
      if (partialAnalysisTimerRef.current) {
        clearInterval(partialAnalysisTimerRef.current);
      }
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    } catch (error) {
      
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMeetings([]);
    setView('landing');
  };

  const loadMeetings = async (forceReload = false) => {
    
    if (!user) {
      console.log('⚠️ loadMeetings: Pas d\'utilisateur connecté');
      setMeetings([]);
      setMeetingsLoaded(false);
      return;
    }

    // Si déjà chargé et pas de force reload, skip
    if (meetingsLoaded && !forceReload) {
      console.log('📋 Réunions déjà en cache, skip reload');
      return;
    }

    setIsMeetingsLoading(true);
    setMeetingsError(null);
    
    try {
      console.log('📋 Chargement des réunions pour user:', user.id);

      const baseSelect = `
        id,
        user_id,
        title,
        created_at,
        duration,
        audio_url,
        summary,
        participant_first_name,
        participant_last_name,
        participant_email,
        notes,
        attachment_url,
        attachment_name,
        email_attachments,
        category_id,
        meeting_categories ( id, name, created_at, color )
      `;

      const fallbackSelect = `
        id,
        user_id,
        title,
        created_at,
        duration,
        audio_url,
        summary,
        participant_first_name,
        participant_last_name,
        participant_email,
        notes,
        attachment_url,
        attachment_name,
        email_attachments,
        category_id,
        meeting_categories ( id, name, created_at )
      `;

      let data: any = null;
      let error: any = null;

      if (categoryColorSupportedRef.current === false) {
        ({ data, error } = await supabase
          .from('meetings')
          .select(fallbackSelect)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100));
      } else {
        ({ data, error } = await supabase
          .from('meetings')
          .select(baseSelect)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100));

        if (error && error.message?.toLowerCase().includes('color')) {
          console.warn('⚠️ Colonne color absente, fallback sans couleur');
          categoryColorSupportedRef.current = false;
          ({ data, error } = await supabase
            .from('meetings')
            .select(fallbackSelect)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100));
        } else if (!error) {
          categoryColorSupportedRef.current = true;
        }
      }

      if (error) {
        console.error('❌ Erreur chargement réunions:', error);
        setMeetingsError('Erreur lors du chargement des réunions: ' + error.message);
        setMeetingsLoaded(false);
        return;
      }

      console.log(`✅ ${data?.length || 0} réunions chargées`);
      const normalizedMeetings = (data || []).map((item: any) => {
        const { meeting_categories, ...rest } = item;
        return {
          ...rest,
          transcript: null,
          display_transcript: null,
          suggestions: [],
          category: meeting_categories
            ? {
                id: meeting_categories.id,
                name: meeting_categories.name,
                created_at: meeting_categories.created_at,
                color: (meeting_categories as any).color || '#F97316',
              }
            : null,
        } as Meeting;
      });

      setMeetings(normalizedMeetings);
      setMeetingsLoaded(true);
      
    } catch (e) {
      console.error('❌ Exception chargement réunions:', e);
      setMeetingsError('Erreur lors du chargement des réunions: ' + (e as Error).message);
      setMeetingsLoaded(false);
    } finally {
      setIsMeetingsLoading(false);
    }
  };

  const processRecording = async () => {
    if (!audioBlob || !user) {
      console.log('⚠️ processRecording: pas d\'audio ou pas d\'utilisateur', { 
        hasAudioBlob: !!audioBlob, 
        hasUser: !!user 
      });
      return;
    }

    // Protection contre le double traitement
    if (isProcessing) {
      console.log('⚠️ Traitement déjà en cours, ignorer l\'appel');
      return;
    }

    console.log('🚀 Début du traitement de l\'enregistrement');
    setIsProcessing(true);

    try {
      // 1) Finaliser la transcription D'ABORD (avant de créer la réunion)
      setProcessingStatus('Finalisation de la transcription...');
      const hasLive = (liveTranscriptRef.current || '').trim().length > 50;
      
      let finalTranscript = '';
      let displayTranscript = '';
      
      if (hasLive) {
        // Version pour l'affichage (avec séparateurs visuels)
        const formattedTranscript = formatTranscriptWithSeparators(partialTranscripts);
        if (formattedTranscript.trim()) {
          displayTranscript = formattedTranscript;
          console.log('📝 Transcription formatée avec séparateurs:', displayTranscript.substring(0, 100) + '...');
        } else {
          // Fallback: nettoyer la transcription cumulée
          displayTranscript = cleanTranscript(liveTranscriptRef.current.trim());
          console.log('🧹 Transcription nettoyée (fallback):', displayTranscript.substring(0, 100) + '...');
        }
        
        // Version pour le résumé (sans séparateurs, texte propre)
        const cleanForSummary = partialTranscripts.join(' ').trim();
        finalTranscript = cleanTranscript(cleanForSummary);
        console.log('📄 Transcription pour résumé (propre):', finalTranscript.substring(0, 100) + '...');
      } else {
        finalTranscript = await transcribeAudio(audioBlob); // Fallback si, pour une raison, on n'a rien accumulé
        displayTranscript = finalTranscript; // Même version pour l'affichage
      }

      // 2) Générer le résumé
      setProcessingStatus('Génération du résumé IA...');

      const result = await generateSummary(finalTranscript, userId);
      console.log('✅ Résumé généré:', { title: result.title, summaryLength: result.summary?.length });
      
      const { title, summary } = result;
      const provisionalTitle = meetingTitle || `Réunion du ${new Date().toLocaleDateString('fr-FR')}`;
      const finalTitle = meetingTitle || title || provisionalTitle;

      // 3) Créer la réunion UNIQUEMENT si transcription + résumé ont réussi
      setProcessingStatus('Enregistrement de la réunion...');
      console.log('💾 Création de la réunion avec toutes les données (quota sera débité maintenant)');
      
      const { data: created, error: createErr } = await supabase
        .from('meetings')
        .insert({
          title: finalTitle,
          transcript: finalTranscript, // Version propre pour le résumé
          display_transcript: displayTranscript, // Version avec séparateurs pour l'affichage
          summary,
          duration: recordingTime,
          user_id: user.id,
          notes: recordingNotes || null,
          suggestions: [],
          audio_url: null,
        })
        .select()
        .maybeSingle();
      
      if (createErr) {
        console.error('❌ Erreur création réunion:', createErr);
        throw createErr;
      }
      
      console.log('✅ Réunion créée avec succès, ID:', created?.id, '(quota débité)');
      setCurrentMeetingId(created?.id || null);

      if (created) {
        // Helpers déduplication sémantique (fr)
        const removeDiacritics = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const boilerplatePatterns = [
          /^pourriez[-\s]vous\s+/i,
          /^est[-\s]ce\s+que\s+/i,
          /^est[-\s]il\s+possible\s+de\s+/i,
          /^pourrait[-\s]on\s+/i,
          /^peut[-\s]on\s+/i,
          /^serait[-\s]il\s+utile\s+de\s+/i,
          /^pouvez[-\s]vous\s+/i,
        ];
        const stopwords = new Set([
          'le','la','les','de','des','du','un','une','et','ou','dans','au','aux','pour','sur','avec','chez','par','que','qui','quoi','dont','leur','leurs','vos','nos','ses','son','sa','ce','cette','ces','il','elle','ils','elles','on','nous','vous','est','sont','sera','etre','été','etre','devoir','falloir','faire','peut','possible','utile'
        ]);
        const canonical = (raw: string) => {
          let t = String(raw).trim().toLowerCase();
          t = removeDiacritics(t).replace(/[\?\.!]+$/,'');
          boilerplatePatterns.forEach(r => { t = t.replace(r, ''); });
          t = t.replace(/\b(clarifier|preciser|definir|discuter|etablir|cacher)\b/g, (m) => m); // garder verbes utiles
          const tokens = t.split(/[^a-z0-9]+/).filter(w => w && !stopwords.has(w));
          return tokens.join(' ');
        };
        const jaccard = (a: string, b: string) => {
          const A = new Set(a.split(' '));
          const B = new Set(b.split(' '));
          const inter = new Set([...A].filter(x => B.has(x))).size;
          const uni = new Set([...A, ...B]).size || 1;
          return inter / uni;
        };

        // Insérer en base les suggestions dans les tables normalisées
        try {
          // Déduplication sémantique des clarifications
          const clarifRows: Array<{meeting_id:string;content:string;segment_number:number;user_id:string; _canon?: string}> = [];
          (suggestions || []).forEach((s) => {
            (s.suggestions || []).forEach((raw) => {
              const canon = canonical(raw);
              if (!canon) return;
              const isDup = clarifRows.some(r => jaccard(r._canon || '', canon) >= 0.8);
              if (!isDup) {
                clarifRows.push({
                  meeting_id: created.id,
                  content: String(raw).trim(),
                  segment_number: s.segment_number,
                  user_id: user.id,
                  _canon: canon,
                });
              }
            });
          });

          if (clarifRows.length > 0) {
            await supabase.from('meeting_clarifications').insert(clarifRows.map(({_canon, ...r}) => r));
          }

          // Déduplication sémantique des topics
          const topicRows: Array<{meeting_id:string;topic:string;segment_number:number;user_id:string; _canon?: string}> = [];
          (suggestions || []).forEach((s) => {
            (s.topics_to_explore || []).forEach((raw) => {
              const canon = canonical(raw);
              if (!canon) return;
              const isDup = topicRows.some(r => jaccard(r._canon || '', canon) >= 0.8);
              if (!isDup) {
                topicRows.push({
                  meeting_id: created.id,
                  topic: String(raw).trim(),
                  segment_number: s.segment_number,
                  user_id: user.id,
                  _canon: canon,
                });
              }
            });
          });

          if (topicRows.length > 0) {
            await supabase.from('meeting_topics').insert(topicRows.map(({_canon, ...r}) => r));
          }
        } catch (_e) {
          // silencieux côté client
        }

        // Reset des états d'enregistrement AVANT d'afficher le résultat
        resetRecording();
        setRecordingNotes('');
        setMeetingTitle('');
        liveTranscriptRef.current = '';
        setPartialTranscripts([]);
        setCurrentMeetingId(null);
        lastProcessedSizeRef.current = 0;
        
        // Afficher le résumé immédiatement (sans audio pour l'instant)
        console.log('🎯 Définition du résultat:', { title: finalTitle, summaryLength: summary?.length });
        setResult({ title: finalTitle, transcript: displayTranscript, summary, audioUrl: null, meetingId: created?.id });
        loadMeetings(true); // Force reload après création
        
        // Upload audio en arrière-plan (non-bloquant)
        const now = new Date();
        const datePart = now.toISOString().slice(0,10);
        const timePart = `${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
        const rawTitle = meetingTitle && meetingTitle.trim().length > 0 ? meetingTitle : 'reunion';
        const safeTitle = rawTitle
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 50) || 'reunion';
        const filePath = `${user.id}/${datePart}/${safeTitle}_${timePart}.webm`;
        
        // Upload asynchrone
        (async () => {
          try {
            console.log('📤 Upload audio en arrière-plan vers:', filePath);
            const { error: upErr } = await supabase.storage
              .from('Compte-rendu')
              .upload(filePath, audioBlob);
            
            if (!upErr) {
              const { data: pub } = supabase.storage
                .from('Compte-rendu')
                .getPublicUrl(filePath);
              const audioUrl = pub.publicUrl || null;
              
              // Mettre à jour la réunion avec l'audio
              await supabase
                .from('meetings')
                .update({ audio_url: audioUrl })
                .eq('id', created.id);
              
              console.log('✅ Audio uploadé et lié à la réunion');
              
              // Mettre à jour le résultat affiché
              setResult(prev => prev ? { ...prev, audioUrl } : null);
            } else {
              console.error('❌ Erreur upload arrière-plan:', upErr);
            }
          } catch (e) {
            console.error('❌ Erreur upload async:', e);
          }
        })();
        
      } else {
        throw new Error('Aucune donnée retournée lors de l\'insertion');
      }
    } catch (error) {
      console.error('Erreur processRecording:', error);
      alert('Une erreur est survenue lors du traitement.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id);

    if (!error) {
      // Ne pas recharger immédiatement, laisser l'animation se terminer
      // Le rechargement se fera automatiquement via l'état
      setMeetings(prevMeetings => prevMeetings.filter(m => m.id !== id));
    }
  };

  const handleStartRecording = async (bypassQuotaCheck = false) => {
    console.log('🎬 handleStartRecording appelé', { bypassQuotaCheck, mode: selectedRecordingMode });
    longRecordingReminderRef.current = false;
    recordingLimitRef.current = false;
    setShowLongRecordingReminder(false);
    setShowRecordingLimitModal(false);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {
            /* silence */
          });
        }
      } catch (error) {
        console.warn('Impossible de demander la permission Notification:', error);
      }
    }
    
    // Détecter si on est sur mobile + mode visio
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && selectedRecordingMode === 'visio' && !pendingVisioRecording) {
      console.log('📱 Mobile + Mode Visio détecté, affichage du modal d\'information');
      setShowMobileVisioTip(true);
      setPendingVisioRecording(true);
      return; // Attendre la confirmation de l'utilisateur
    }
    
    // Vérifier le quota avant de démarrer (sauf si bypass activé)
    if (!bypassQuotaCheck) {
      try {
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('plan_type, minutes_quota, minutes_used_this_month')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('📊 Quota récupéré:', subscription);

        if (subscription && subscription.plan_type === 'starter') {
          // Vérifier si l'utilisateur a dépassé le quota
          if (subscription.minutes_used_this_month >= subscription.minutes_quota) {
            console.log('🔴 Quota COMPLÈTEMENT atteint, affichage du modal QuotaFull');
            setShowQuotaFullModal(true);
            return;
          }

          // Avertir si proche du quota (>90%)
          const usagePercent = (subscription.minutes_used_this_month / subscription.minutes_quota) * 100;
          console.log('📈 Usage:', usagePercent.toFixed(2) + '%');
          
          if (usagePercent > 90) {
            const remaining = subscription.minutes_quota - subscription.minutes_used_this_month;
            console.log('🟠 Quota proche (>90%), affichage du modal LowQuotaWarning', { remaining });
            // Afficher le modal au lieu du confirm()
            setLowQuotaRemainingMinutes(remaining);
            setShowLowQuotaWarning(true);
            return; // Arrêter ici, l'utilisateur décidera via le modal
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du quota:', error);
        // Continuer quand même si erreur de vérification
      }
    }

    setIsStartingRecording(true);
    let didStartRecording = false;
    try {
      await startRecording(selectedRecordingMode);
      didStartRecording = true;
      clearSuggestions();
      lastProcessedSizeRef.current = 0; // Réinitialiser le compteur
      setPendingVisioRecording(false); // Reset après démarrage réussi
    } catch (error) {
      console.warn('❌ Démarrage enregistrement annulé ou échoué:', error);
      setPendingVisioRecording(false); // Reset même en cas d'erreur
    } finally {
      setIsStartingRecording(false);
    }

    if (!didStartRecording) {
      return;
    }
    
    // Fonction de vérification du quota pendant l'enregistrement
    const recordingStartTime = Date.now();

    const checkQuotaDuringRecording = async () => {
      try {
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('plan_type, minutes_quota, minutes_used_this_month')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subscription && subscription.plan_type === 'starter') {
          // Calculer le temps écoulé depuis le début de l'enregistrement
          const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
          const currentRecordingMinutes = Math.ceil(elapsedSeconds / 60);
          const totalUsage = subscription.minutes_used_this_month + currentRecordingMinutes;

          console.log('🔍 Vérification quota pendant enregistrement:', {
            minutesUsedThisMonth: subscription.minutes_used_this_month,
            elapsedSeconds,
            currentRecordingMinutes,
            totalUsage,
            quota: subscription.minutes_quota,
            wouldExceed: totalUsage >= subscription.minutes_quota
          });

          // Si le quota est dépassé ou sera dépassé, METTRE EN PAUSE l'enregistrement
          if (totalUsage >= subscription.minutes_quota) {
            console.warn('🚫 Quota atteint pendant l\'enregistrement, mise en pause automatique');
            
            // Arrêter le timer de vérification du quota
            if ((window as any).quotaCheckInterval) {
              clearInterval((window as any).quotaCheckInterval);
              (window as any).quotaCheckInterval = null;
            }
            
            // Arrêter le timer de transcription partielle (analyse en temps réel)
            if (partialAnalysisTimerRef.current) {
              console.log('⏹️ Arrêt du timer d\'analyse partielle');
              clearInterval(partialAnalysisTimerRef.current);
              partialAnalysisTimerRef.current = null;
            }
            
            // PAUSE de l'enregistrement (comme le bouton Pause)
            pauseRecording();
            
            // Afficher le modal de quota atteint
            setQuotaModalData({
              minutesUsed: subscription.minutes_used_this_month,
              quota: subscription.minutes_quota
            });
            setShowQuotaReachedModal(true);
            
            return true; // Quota dépassé
          }
        }
        return false; // Quota OK
      } catch (error) {
        console.error('❌ Erreur lors de la vérification du quota:', error);
        return false;
      }
    };

    // Vérifier immédiatement au démarrage
    checkQuotaDuringRecording();

    // Timer pour vérifier le quota toutes les 5 secondes pendant l'enregistrement
    const quotaCheckInterval = window.setInterval(checkQuotaDuringRecording, 5000);
    
    // Stocker l'interval ID pour pouvoir le nettoyer plus tard
    (window as any).quotaCheckInterval = quotaCheckInterval;
    
    // Timer 15s: construire une fenêtre glissante 15s via WebAudio et l'envoyer
    partialAnalysisTimerRef.current = window.setInterval(async () => {
      try {
        const wav = await getLast15sWav();
        if (!wav || wav.size < 5000) return;
        console.log(`📝 Transcription fenêtre 15s ${(wav.size/1024).toFixed(0)} KB`);
        const text = await transcribeAudio(wav, 0, `window15s_${Date.now()}.wav`);
        if (text && text.trim().length > 5) {
          // Déduplication: vérifier si ce texte n'existe pas déjà
          setPartialTranscripts(prev => {
            const normalizedText = text.trim().toLowerCase();
            const isDuplicate = prev.some(existing => 
              existing.trim().toLowerCase() === normalizedText ||
              existing.trim().toLowerCase().includes(normalizedText) ||
              normalizedText.includes(existing.trim().toLowerCase())
            );
            
            if (isDuplicate) {
              console.log('🔄 Transcription dupliquée ignorée:', text.substring(0, 50) + '...');
              return prev; // Ne pas ajouter le doublon
            }
            
            console.log('✅ Nouvelle transcription ajoutée:', text.substring(0, 50) + '...');
            return [...prev, text];
          });
          
          // Construire un transcript cumulatif robuste (évite le stale state)
          liveTranscriptRef.current = `${(liveTranscriptRef.current || '').trim()} ${text}`.trim();
          // Fenêtre glissante: 2 derniers chunks pour suggestions plus contextuelles
          recentChunksRef.current.push(text);
          if (recentChunksRef.current.length > 2) recentChunksRef.current.shift();
          const twoChunkWindow = recentChunksRef.current.join(' ').trim();
          await analyzePartialTranscript(twoChunkWindow);
        }
      } catch (e) {
        console.error('❌ Erreur transcription 15s:', e);
      }
    }, 15000);
  };

  const fetchMeetingDetails = useCallback(async (meetingId: string) => {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Meeting | null;
  }, []);

  const handleViewMeeting = async (meeting: Meeting) => {
    // Sauvegarder la position de scroll ET la page courante avant de naviguer
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    setHistoryScrollPosition(scrollPosition);

    // Sauvegarder la page courante depuis localStorage
    const savedPage = localStorage.getItem('meetingHistoryPage');
    if (savedPage) {
      const pageNum = parseInt(savedPage, 10);
      console.log('💾 Sauvegarde de la page courante:', pageNum);
      setHistoryCurrentPage(pageNum);
    }

    setIsMeetingDetailLoading(true);

    try {
      const detailedMeeting = await fetchMeetingDetails(meeting.id);

      if (!detailedMeeting) {
        alert('❌ Réunion introuvable');
        return;
      }

      setSelectedMeeting(detailedMeeting);
      setSelectedMeetingId(meeting.id);
      setView('detail');
    } catch (error) {
      console.error('Erreur chargement réunion:', error);
      alert('❌ Erreur lors du chargement de la réunion');
    } finally {
      setIsMeetingDetailLoading(false);
    }
  };

  const handleViewMeetingById = async (meetingId: string) => {
    setIsMeetingDetailLoading(true);

    try {
      const detailedMeeting = await fetchMeetingDetails(meetingId);

      if (!detailedMeeting) {
        alert('❌ Réunion introuvable');
        return;
      }

      setSelectedMeeting(detailedMeeting);
      setSelectedMeetingId(meetingId);
      setView('detail');
    } catch (error) {
      console.error('Erreur chargement réunion:', error);
      alert('❌ Erreur lors du chargement de la réunion');
    } finally {
      setIsMeetingDetailLoading(false);
    }
  };

  // Handlers pour le modal de quota atteint
  const handleQuotaModalClose = () => {
    console.log('❌ Modal fermé, génération du résumé');
    setShowQuotaReachedModal(false);
    // Arrêter l'enregistrement et générer le résumé (comme le bouton Stop)
    stopRecording();
  };

  const handleUpgradeToUnlimited = () => {
    console.log('👑 Upgrade demandé, génération du résumé puis redirection');
    setShowQuotaReachedModal(false);
    
    // Arrêter l'enregistrement et générer le résumé
    stopRecording();
    
    // Rediriger vers Settings après un court délai pour laisser le traitement commencer
    setTimeout(() => {
      setView('settings');
    }, 1000);
  };

  const handleContinueWithSummary = () => {
    console.log('✅ Génération du résumé demandée');
    setShowQuotaReachedModal(false);
    
    // Arrêter l'enregistrement (comme le bouton Stop)
    // Cela déclenchera automatiquement processRecording() via le useEffect
    stopRecording();
  };

  const handleLongRecordingContinue = () => {
    setShowLongRecordingReminder(false);
    setRecordingReminderToast(null);
  };

  const handleLongRecordingPause = () => {
    setShowLongRecordingReminder(false);
    setRecordingReminderToast(null);
    if (isRecording && !isPaused) {
      pauseRecording();
    }
  };

  const handleLongRecordingStop = () => {
    setShowLongRecordingReminder(false);
    setRecordingReminderToast(null);
    stopRecording();
  };

  const handleNavigateToRecord = useCallback(() => {
    setView('record');
    if (typeof window !== 'undefined') {
      window.location.hash = 'record';
    }
  }, []);

  const handleStopRecordingRequest = useCallback(() => {
    if (!isRecording) {
      stopRecording();
      return;
    }

    if (recordingTime < MIN_RECORDING_SECONDS) {
      setShortRecordingSeconds(recordingTime);
      setShowShortRecordingModal(true);
      return;
    }

    skipProcessingRef.current = false;
    stopRecording();
  }, [isRecording, recordingTime, stopRecording]);

  const handleShortRecordingContinue = useCallback(() => {
    setShowShortRecordingModal(false);
    setShortRecordingSeconds(0);
  }, []);

  const handleShortRecordingDiscard = useCallback(() => {
    skipProcessingRef.current = true;
    setShowShortRecordingModal(false);
    setShortRecordingSeconds(0);
    stopRecording();
  }, [stopRecording]);

  const handleOpenLongRecordingReminder = () => {
    setRecordingReminderToast(null);
    setShowLongRecordingReminder(true);
  };

  const handleDismissRecordingReminder = () => {
    setShowLongRecordingReminder(false);
    setRecordingReminderToast(null);
  };

  const handleRecordingLimitModalClose = () => {
    setShowRecordingLimitModal(false);
    recordingLimitRef.current = false;
  };

  // Handlers pour le modal d'avertissement de quota bas
  const handleLowQuotaContinue = () => {
    console.log('✅ LowQuota: Utilisateur a cliqué sur Continuer');
    setShowLowQuotaWarning(false);
    // Continuer l'enregistrement en bypassant la vérification du quota
    handleStartRecording(true);
  };

  const handleLowQuotaCancel = () => {
    console.log('❌ LowQuota: Utilisateur a annulé');
    setShowLowQuotaWarning(false);
    // Ne rien faire, l'utilisateur a annulé
  };

  // Handlers pour le modal de quota complètement atteint
  const handleQuotaFullUpgrade = () => {
    console.log('👑 QuotaFull: Utilisateur veut upgrade');
    setShowQuotaFullModal(false);
    setView('settings');
  };

  const handleQuotaFullClose = () => {
    console.log('❌ QuotaFull: Utilisateur a fermé');
    setShowQuotaFullModal(false);
  };

  // Handlers pour le modal mobile visio tip
  const handleMobileVisioTipContinue = () => {
    console.log('✅ Mobile Visio: Utilisateur a compris les instructions');
    setShowMobileVisioTip(false);
    // Continuer l'enregistrement (pendingVisioRecording est déjà à true, donc le modal ne s'affichera pas à nouveau)
    handleStartRecording(false); // Ne pas bypasser le quota check
  };

  const handleMobileVisioTipCancel = () => {
    console.log('❌ Mobile Visio: Utilisateur a annulé');
    setShowMobileVisioTip(false);
    setPendingVisioRecording(false);
  };

  const handleBackToHistory = () => {
    console.log('🔙 Retour à l\'historique, page sauvegardée:', historyCurrentPage);
    setSelectedMeeting(null);
    setSelectedMeetingId(null);
    setView('history');
    
    // Ne pas recharger les réunions, elles sont déjà en mémoire
    // Restaurer la position de scroll après un court délai pour laisser le rendu se faire
    setTimeout(() => {
      window.scrollTo(0, historyScrollPosition);
    }, 100);
  };

  const handleMeetingUpdate = async () => {
    await loadMeetings(true); // Force reload après update
    if (selectedMeeting) {
      const updatedMeetings = await supabase
        .from('meetings')
        .select('*')
        .eq('id', selectedMeeting.id)
        .single();

      if (updatedMeetings.data) {
        setSelectedMeeting(updatedMeetings.data);
      }
    }
  };


  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-coral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cocoa-600 text-lg">Chargement...</p>
        </div>
      </div>
    );
  }

  if (view === 'gmail-callback') {
    return <GmailCallback />;
  }

  if (view === 'landing') {
    return <LandingPage onGetStarted={() => setView('auth')} />;
  }

  if (!user) {
    return <Login onSuccess={() => {
      console.log('✅ Login réussi, initialisation...');
      try {
        setIsAuthLoading(false);
        console.log('📍 setView(record)');
        setView('record');
        console.log('✅ Vue changée avec succès');
      } catch (error) {
        console.error('❌ Erreur après login:', error);
        alert('Erreur après connexion: ' + error);
      }
    }} />;
  }

  // Guard contre les erreurs de rendu
  try {
    console.log('🎨 Render principal, view:', view, 'user:', !!user);
  } catch (e) {
    console.error('❌ Erreur dans render:', e);
  }

  return (
    <div className="h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 flex flex-col md:flex-row overflow-hidden">
      {/* Setup Reminder Banner */}
      {user && (
        <SetupReminder 
          userId={user.id} 
          onNavigateToSettings={() => setView('settings')} 
        />
      )}
      
      {/* Sidebar - Responsive */}
      <aside className="w-full md:w-72 bg-white border-b-2 md:border-b-0 md:border-r-2 border-orange-100 shadow-xl flex flex-col md:h-screen sticky top-0 z-10">
        <div className="p-4 md:p-6 border-b-2 border-orange-100">
          <div className="flex items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <img src="/logohallia.png" alt="Logo Hallia" className="w-32 h-10 md:w-40 md:h-12 object-contain" />
              <div>
                <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-coral-500 to-sunset-500 bg-clip-text text-transparent">Meeting recorder</h1>
              </div>
            </div>
            {/* Bouton déconnexion mobile uniquement */}
            <button
              onClick={handleLogout}
              className="md:hidden p-2 rounded-lg text-cocoa-700 hover:bg-orange-50 transition-all"
              title="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-2 md:p-4">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide">
            <button
              onClick={() => {
                setView('record');
                window.location.hash = 'record';
              }}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
                view === 'record'
                  ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30'
                  : 'text-cocoa-700 hover:bg-orange-50'
              }`}
            >
              <Mic className="w-4 h-4 md:w-5 md:h-5" />
              <span>Enregistrer</span>
            </button>
            <button
              onClick={() => {
                setView('dashboard');
                window.location.hash = 'dashboard';
              }}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
                view === 'dashboard'
                  ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30'
                  : 'text-cocoa-700 hover:bg-orange-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5" />
              <span>Tableau de bord</span>
            </button>
            <button
              onClick={() => {
                setView('history');
                window.location.hash = 'history';
              }}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
                view === 'history'
                  ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30'
                  : 'text-cocoa-700 hover:bg-orange-50'
              }`}
            >
              <History className="w-4 h-4 md:w-5 md:h-5" />
              <span>Historique</span>
            </button>
            <button
              onClick={() => {
                setView('upload');
                window.location.hash = 'upload';
              }}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
                view === 'upload'
                  ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30'
                  : 'text-cocoa-700 hover:bg-orange-50'
              }`}
            >
              <Upload className="w-4 h-4 md:w-5 md:h-5" />
              <span>Importer</span>
            </button>
            <button
              onClick={() => {
                setView('settings');
                window.location.hash = 'settings';
              }}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
                view === 'settings'
                  ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30'
                  : 'text-cocoa-700 hover:bg-orange-50'
              }`}
            >
              <SettingsIcon className="w-4 h-4 md:w-5 md:h-5" />
              <span>Paramètres</span>
            </button>
            <button
              onClick={() => {
                setView('contact');
                window.location.hash = 'contact';
              }}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
                view === 'contact'
                  ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30'
                  : 'text-cocoa-700 hover:bg-orange-50'
              }`}
            >
              <Mail className="w-4 h-4 md:w-5 md:h-5" />
              <span>Support</span>
            </button>
          </div>
        </nav>

        {/* Bouton rectangulaire pour démarrer l'enregistrement - MOBILE uniquement, juste après la navigation */}
        <div className="md:hidden p-3 border-t-2 border-orange-100">
          {view !== 'record' && !isRecording && (
            <button
              onClick={() => {
                setView('record');
                window.location.hash = 'record';
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl font-semibold transition-all bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg active:scale-95"
            >
              <Mic className="w-5 h-5" />
              <span>Démarrer un enregistrement</span>
            </button>
          )}
        </div>

        {/* Bouton déconnexion - DESKTOP uniquement */}
        <div className="hidden md:block p-2 md:p-4 border-t-2 border-orange-100 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold transition-all text-sm md:text-base text-cocoa-700 hover:bg-orange-50"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto h-full">
        <div className={view === 'record' ? 'flex gap-6 h-full' : 'max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-8 h-full'}>
          {view === 'record' ? (
            <>
              {/* Contenu principal de l'enregistrement */}
              <div className="flex-1 px-4 md:px-8 py-4 md:py-8 overflow-auto flex items-center justify-center">
              {!isRecording ? (
                <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-12 border-2 border-orange-100 overflow-hidden w-full max-w-5xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-coral-50/30 via-transparent to-sunset-50/30 pointer-events-none"></div>
                  <div className="relative flex flex-col items-center justify-center py-8">
                    <div className="mb-12">
                    <RecordingControls
                      isRecording={isRecording}
                      isPaused={isPaused}
                      recordingTime={recordingTime}
                      onStart={handleStartRecording}
                      onPause={pauseRecording}
                      onResume={resumeRecording}
                      onStop={handleStopRecordingRequest}
                  isStarting={isStartingRecording}
                />
                    </div>

                    

                    <div className="relative mb-8 w-full max-w-2xl px-4">
                      <label htmlFor="meetingTitle" className="block text-xs md:text-sm font-semibold text-cocoa-800 mb-3 text-center">
                        Nom de la réunion (optionnel)
                      </label>
                      <input
                        type="text"
                        id="meetingTitle"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        placeholder="Ex: Réunion d'équipe - Planning Q4"
                        className="w-full px-4 md:px-6 py-3 md:py-4 border-2 border-orange-200 rounded-xl md:rounded-2xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 text-sm md:text-base text-cocoa-800 placeholder-cocoa-400 transition-all duration-300 text-center hover:border-coral-300 hover:shadow-lg"
                      />
                      <p className="text-xs text-cocoa-500 mt-2 text-center">
                        Si vide, l'IA générera un titre automatiquement
                      </p>
                    </div>

                    <div className="mb-8 w-full max-w-4xl px-4">
                      <RecordingModeSelector
                        selectedMode={selectedRecordingMode}
                        onModeChange={setSelectedRecordingMode}
                        disabled={isRecording}
                      />
                    </div>

                    <div className="mt-12 max-w-2xl text-center text-cocoa-600">
                      <p className="text-base mb-4">
                        {recordingMode === 'microphone' && "Mode Présentiel : enregistre votre voix pour les réunions en personne. Simple et efficace."}
                        {recordingMode === 'system' && "Mode Visio : capture l'audio de votre écran pour enregistrer les réunions Discord, Zoom, Meet, etc."}
                      </p>
                      <p className="text-sm text-cocoa-500">
                        La transcription sera générée automatiquement à la fin.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-12 border-2 border-orange-100 overflow-auto w-full max-w-7xl h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-coral-50/20 via-transparent to-sunset-50/20 pointer-events-none"></div>
                  <div className="relative flex flex-col items-center py-4 md:py-8 h-full">
                    <button
                      onClick={handleStopRecordingRequest}
                      className="mb-6 md:mb-8 group transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                      title="Cliquez pour arrêter l'enregistrement"
                    >
                      <div className="relative w-20 h-20 md:w-24 md:h-24">
                        <div className="absolute inset-0 bg-coral-400 rounded-full animate-ping opacity-75"></div>
                        <div className="absolute inset-0 bg-coral-400 rounded-full opacity-20 blur-xl"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-coral-500 via-coral-600 to-sunset-500 rounded-full flex items-center justify-center shadow-glow-coral group-hover:shadow-glow-coral-strong">
                          <Mic className="w-10 h-10 md:w-12 md:h-12 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    </button>
                    <h3 className="text-xl md:text-2xl font-bold text-cocoa-800 mb-2">Enregistrement en cours...</h3>
                    <p className="text-sm md:text-base text-cocoa-600 text-center max-w-md mb-6 md:mb-8 px-4">
                      L'audio est en cours d'enregistrement. Le résumé se génère progressivement.
                    </p>

                    {/* Visualisation audio en direct */}
                    <div className="w-full max-w-3xl px-2 md:px-4 mb-6 md:mb-10">
                      <AudioVisualizer
                        stream={audioStream}
                        isActive={isRecording && !isPaused && !showQuotaReachedModal}
                        barColor="#FF6B4A"
                        bgColor="linear-gradient(180deg, rgba(255,237,231,0.6) 0%, rgba(255,250,247,0.6) 100%)"
                      />
                    </div>

                    {/* Suggestions pendant l'enregistrement */}
                    <div className="w-full max-w-6xl xl:max-w-7xl mt-4 md:mt-6 px-4">
                      {/* Onglets */}
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={() => setActiveSuggestionsTab('clarify')}
                          className={`px-4 py-2 rounded-full text-sm md:text-base font-semibold transition-all duration-300 border-2 ${
                            activeSuggestionsTab === 'clarify'
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-400 text-white shadow-lg scale-105'
                              : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 hover:scale-105'
                          }`}
                        >
                          Points à clarifier
                        </button>
                        <button
                          onClick={() => setActiveSuggestionsTab('explore')}
                          className={`px-4 py-2 rounded-full text-sm md:text-base font-semibold transition-all duration-300 border-2 ${
                            activeSuggestionsTab === 'explore'
                              ? 'bg-gradient-to-r from-coral-500 to-sunset-500 border-coral-400 text-white shadow-lg scale-105'
                              : 'bg-white border-orange-200 text-coral-700 hover:bg-coral-50 hover:border-coral-300 hover:scale-105'
                          }`}
                        >
                          Sujets à explorer
                        </button>
                      </div>

                      {activeSuggestionsTab === 'clarify' ? (
                      <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-blue-200 shadow-lg overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
                        <div className="relative flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                            {/* Icône ampoule avec animation */}
                            <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <h4 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">Points à clarifier</h4>
                        </div>

                        {suggestions.some(s => s.suggestions && s.suggestions.length > 0) ? (
                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {suggestions.filter(s => s.suggestions && s.suggestions.length > 0).slice(-5).reverse().map((suggestion, index) => (
                              <div key={index} className="bg-white rounded-lg p-4 border border-purple-100 animate-slide-in-right">
                                {suggestion.suggestions.map((q, qIndex) => (
                                  <div key={qIndex} className="flex items-start gap-2 py-1">
                                    <span className="text-purple-500 mt-1">•</span>
                                    <p className="text-sm md:text-base text-cocoa-800">{q}</p>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="flex flex-col items-center gap-4">
                              {/* Animation ampoule qui bouge */}
                              <div className="relative">
                                <svg className="w-16 h-16 text-purple-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                {/* Ondes autour de l'ampoule */}
                                <div className="absolute inset-0 -m-2 border-2 border-purple-300 rounded-full animate-ping opacity-50"></div>
                              </div>
                              <p className="text-sm md:text-base text-purple-700 font-medium">
                                Analyse en cours...
                              </p>
                              <p className="text-xs text-purple-600">
                                Les suggestions apparaîtront automatiquement
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      ) : (
                      <div className="relative bg-gradient-to-br from-coral-50 via-orange-50 to-sunset-50 rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-coral-200 shadow-lg overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
                        <div className="relative flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-coral-500 to-sunset-600 rounded-full flex items-center justify-center shadow-lg">
                            {/* Icône boussole avec animation */}
                            <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          </div>
                          <h4 className="text-lg md:text-xl font-bold text-coral-900">Sujets à explorer</h4>
                        </div>

                        {suggestions.some(s => s.topics_to_explore && s.topics_to_explore.length > 0) ? (
                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {suggestions.filter(s => s.topics_to_explore && s.topics_to_explore.length > 0).slice(-5).reverse().map((suggestion, index) => (
                              <div key={index} className="bg-white rounded-lg p-4 border border-orange-100 animate-slide-in-right">
                                <div className="flex flex-wrap gap-2">
                                  {suggestion.topics_to_explore.map((topic, topicIndex) => (
                                    <span key={topicIndex} className="px-3 py-1 bg-coral-100 text-coral-700 rounded-full text-xs md:text-sm font-medium">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="flex flex-col items-center gap-4">
                              {/* Animation boussole qui bouge */}
                              <div className="relative">
                                <svg className="w-16 h-16 text-coral-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                {/* Ondes autour de la boussole */}
                                <div className="absolute inset-0 -m-2 border-2 border-coral-300 rounded-full animate-ping opacity-50"></div>
                              </div>
                              <p className="text-sm md:text-base text-coral-700 font-medium">
                                Analyse en cours...
                              </p>
                              <p className="text-xs text-coral-600">
                                Les sujets apparaîtront automatiquement
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      )}

                      <div className="relative bg-gradient-to-br from-peach-50 to-coral-50 rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-coral-200 mt-6 shadow-lg overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                        <label htmlFor="notes" className="block text-xs md:text-sm font-semibold text-cocoa-800 mb-3">
                          Notes complémentaires
                      </label>
                      <textarea
                        id="notes"
                        value={recordingNotes}
                        onChange={(e) => setRecordingNotes(e.target.value)}
                          placeholder="Ajoutez vos propres notes ici..."
                          className="relative w-full h-32 md:h-40 px-4 md:px-6 py-3 md:py-4 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 resize-none text-sm md:text-base text-cocoa-800 placeholder-cocoa-400 transition-all duration-300 bg-white hover:border-coral-300 hover:shadow-lg"
                      />
                        <p className="text-xs text-cocoa-500 mt-2">
                          Ces notes seront ajoutées au résumé final
                      </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>

              {/* Barre latérale droite avec la liste des réunions */}
              <aside className="hidden xl:block w-80 bg-white border-l-2 border-orange-100 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-coral-500 to-sunset-500 bg-clip-text text-transparent">
                    Réunions récentes
                  </h3>
                  <button
                    onClick={() => {
                      console.log('🔄 Rechargement manuel des réunions');
                      loadMeetings(true);
                    }}
                    className="p-2 hover:bg-coral-50 rounded-lg transition-colors group"
                    title="Rafraîchir"
                  >
                    <svg 
                      className={`w-5 h-5 text-coral-600 transition-transform ${isMeetingsLoading ? 'animate-spin' : 'group-hover:rotate-180'}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-3">
                  {meetings.slice(0, 10).map((meeting) => (
                    <div
                      key={meeting.id}
                      onClick={() => {
                        handleViewMeeting(meeting);
                      }}
                      className="relative bg-gradient-to-br from-peach-50 to-coral-50 rounded-xl p-4 border-2 border-orange-100 hover:border-coral-300 hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-coral-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      <h4 className="relative font-bold text-cocoa-800 text-sm truncate mb-2 group-hover:text-coral-600 transition-colors duration-300">
                        {meeting.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-cocoa-600">
                        <span className="truncate">
                          {new Date(meeting.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          {Math.floor(meeting.duration / 60)}:{(meeting.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {meetings.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-cocoa-500 text-sm">Aucune réunion enregistrée</p>
                    </div>
                  )}

                  {meetings.length > 5 && (
                    <button
                      onClick={() => {
                        setView('history');
                      }}
                      className="w-full mt-4 px-4 py-2 text-sm font-semibold text-coral-600 hover:text-coral-700 hover:bg-coral-50 rounded-lg transition-colors"
                    >
                      Voir tout l'historique →
                    </button>
                  )}
                </div>
              </aside>
            </>
          ) : view === 'history' ? (
            <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 border border-orange-100 w-full">
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-coral-500 to-sunset-500 bg-clip-text text-transparent mb-6">
                Historique
              </h2>

              {/* Onglets */}
              <div className="flex gap-2 mb-6 border-b-2 border-coral-100">
                <button
                  onClick={() => setHistoryTab('meetings')}
                  className={`px-4 md:px-6 py-3 font-semibold transition-all border-b-2 -mb-0.5 ${
                    historyTab === 'meetings'
                      ? 'border-coral-500 text-coral-600'
                      : 'border-transparent text-cocoa-600 hover:text-coral-600'
                  }`}
                >
                  Réunions
                </button>
                <button
                  onClick={() => setHistoryTab('emails')}
                  className={`px-4 md:px-6 py-3 font-semibold transition-all border-b-2 -mb-0.5 ${
                    historyTab === 'emails'
                      ? 'border-coral-500 text-coral-600'
                      : 'border-transparent text-cocoa-600 hover:text-coral-600'
                  }`}
                >
                  Emails envoyés
                </button>
              </div>

              {meetingsError && historyTab === 'meetings' && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                  <span>{meetingsError}</span>
                  <button
                    onClick={() => {
                      setMeetingsError(null);
                      loadMeetings(true); // Force reload sur retry
                    }}
                    className="ml-4 text-sm font-semibold text-red-600 hover:text-red-800 underline"
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {/* Contenu des onglets - Garder les deux montés pour préserver l'état */}
              <div style={{ display: historyTab === 'meetings' ? 'block' : 'none' }}>
                <MeetingHistory
                  key="meeting-history-persistent"
                  meetings={meetings}
                  onDelete={handleDelete}
                  onView={handleViewMeeting}
                  onSendEmail={async (meeting) => {
                    // Préparer le corps de l'email avec signature
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

                    // Charger les paramètres utilisateur (signature)
                    const { data: settings } = await supabase
                      .from('user_settings')
                      .select('signature_text, signature_logo_url')
                      .eq('user_id', user.id)
                      .maybeSingle();

                    const body = await generateEmailBody({
                      title: meeting.title,
                      date: formatDate(meeting.created_at),
                      duration: meeting.duration ? formatDuration(meeting.duration) : undefined,
                      participantName: meeting.participant_first_name && meeting.participant_last_name
                        ? `${meeting.participant_first_name} ${meeting.participant_last_name}`
                        : undefined,
                      participantEmail: meeting.participant_email || undefined,
                      summary: meeting.summary || '',
                      attachments: [],
                      senderName: '',
                      signatureText: settings?.signature_text || '',
                      signatureLogoUrl: settings?.signature_logo_url || '',
                      deliveryMethod: 'app',
                    });

                    setEmailBody(body);
                    setMeetingToEmail(meeting);
                  }}
                  onUpdateMeetings={() => loadMeetings(true)}
                  isLoading={isMeetingsLoading}
                userId={user?.id}
                />
              </div>
              <div style={{ display: historyTab === 'emails' ? 'block' : 'none' }}>
                <EmailHistory
                  userId={user?.id || ''}
                  onViewMeeting={handleViewMeetingById}
                />
              </div>
            </div>
          ) : view === 'upload' ? (
            <AudioUpload
              userId={user?.id || ''}
              onSuccess={async (meetingId) => {
                console.log('🔄 AudioUpload: onSuccess appelé, rechargement des réunions...');
                // Force reload après upload (await pour attendre la fin)
                await loadMeetings(true);
                
                // Ne pas naviguer automatiquement, l'utilisateur peut cliquer sur la notification
                // pour voir le résultat quand il le souhaite
                console.log('✅ Historique rechargé après upload');
              }}
            />
          ) : view === 'settings' ? (
            <Settings userId={user?.id || ''} />
          ) : view === 'contact' ? (
            <div className="max-w-4xl mx-auto h-full flex items-start py-4">
              <ContactSupport
                userId={user?.id || ''}
                userEmail={user?.email || ''}
                reloadTrigger={contactReloadTrigger}
              />
            </div>
          ) : view === 'dashboard' ? (
            <Dashboard />
          ) : view === 'detail' && isMeetingDetailLoading ? (
            <div className="bg-white rounded-3xl shadow-2xl p-10 border border-orange-100 w-full flex flex-col items-center justify-center min-h-[60vh]">
              <div className="w-16 h-16 border-4 border-coral-400 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-cocoa-600 text-lg font-semibold">Chargement de la réunion...</p>
            </div>
          ) : view === 'detail' && selectedMeeting ? (
            <>
            <MeetingDetail meeting={selectedMeeting} onBack={handleBackToHistory} onUpdate={handleMeetingUpdate} />
            </>
          ) : (
            <div className="bg-white rounded-3xl shadow-2xl p-10 border border-orange-100 w-full">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-coral-500 to-sunset-500 bg-clip-text text-transparent mb-8">
                Page non trouvée
              </h2>
              <p className="text-cocoa-600">View actuelle: {view}</p>
              <button 
                onClick={() => {
                  setView('record');
                  window.location.hash = 'record';
                }}
                className="mt-4 px-6 py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Retour à l'accueil
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Bouton flottant pendant l'enregistrement - Visible sur mobile et desktop */}
      <FloatingRecordButton
        isRecording={isRecording}
        isPaused={isPaused}
        recordingTime={recordingTime}
        onPause={pauseRecording}
        onResume={resumeRecording}
        onStop={handleStopRecordingRequest}
      />

      {/* Bouton flottant "Démarrer" visible sur DESKTOP uniquement, sur toutes les pages sauf la page d'enregistrement */}
      <div className="hidden md:block">
        <FloatingStartButton
          onStartRecording={handleNavigateToRecord}
          isVisible={!isRecording && view !== 'record'}
        />
      </div>

      {/* LiveSuggestions désactivé */}

    {/* Alerte longue durée directement dans l'onglet */}
    {recordingReminderToast && (
      <div className="fixed bottom-6 right-6 z-[1200] max-w-sm w-full bg-white border-2 border-amber-200 shadow-2xl rounded-2xl p-5 space-y-4 animate-slideUp">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/40">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Rappel Hallia</p>
            <p className="text-xs text-amber-800/80 mt-1">
              {recordingReminderToast.message}
            </p>
          </div>
          <button
            onClick={handleDismissRecordingReminder}
            className="p-1.5 rounded-lg text-amber-800/70 hover:text-amber-900 hover:bg-amber-100 transition-colors"
            title="Fermer le rappel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLongRecordingPause}
            className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-coral-200 text-coral-700 font-semibold text-xs uppercase tracking-wide hover:bg-coral-50 transition-colors"
          >
            <PauseCircle className="w-4 h-4" />
            Pause
          </button>
          <button
            onClick={handleLongRecordingStop}
            className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-coral-500 to-sunset-500 text-white font-semibold text-xs uppercase tracking-wide shadow-md hover:shadow-lg transition-all"
          >
            <StopCircle className="w-4 h-4" />
            Arrêter
          </button>
          <button
            onClick={handleLongRecordingContinue}
            className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-amber-200 text-amber-800 font-semibold text-xs uppercase tracking-wide hover:bg-amber-50 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Continuer
          </button>
          <button
            onClick={handleOpenLongRecordingReminder}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-100 text-amber-900 font-semibold text-xs uppercase tracking-wide hover:bg-amber-200 transition-colors"
          >
            Voir les options
          </button>
        </div>
      </div>
    )}

      {/* Modal de statut persistante (synchronisée avec le backend) */}
      {user && (
        <ProcessingStatusModal
          userId={user.id}
          onOpenReport={async (meetingId) => {
            console.log('📖 Ouverture du rapport pour meeting:', meetingId);
            
            // Toujours charger depuis la DB pour avoir les dernières données
            try {
              const { data: meeting, error } = await supabase
                .from('meetings')
                .select('*')
                .eq('id', meetingId)
                .maybeSingle();
              
              if (error) {
                console.error('❌ Erreur chargement réunion:', error);
                alert('❌ Erreur lors du chargement de la réunion');
                return;
              }
              
              if (meeting) {
                console.log('✅ Réunion chargée:', meeting.title);
                // Recharger la liste des réunions pour mettre à jour l'historique
                await loadMeetings(true);
                // Ouvrir la réunion
                handleViewMeeting(meeting as Meeting);
              } else {
                console.warn('⚠️ Réunion introuvable:', meetingId);
                alert('❌ Réunion introuvable');
              }
            } catch (error: any) {
              console.error('❌ Erreur:', error);
              alert('❌ Erreur lors du chargement de la réunion');
            }
          }}
        />
      )}

      {/* Modal de traitement pendant la génération du résumé */}
      <ProcessingModal
        isOpen={isProcessing}
        status={processingStatus || 'Traitement en cours...'}
      />

      {result && result.title && result.summary && (
        <>
          {console.log('🎯 Rendu MeetingResult:', { title: result.title, hasSummary: !!result.summary })}
        <div className="fixed inset-0 z-[100]">
          <MeetingResult
            title={result.title}
            transcript={result.transcript}
            summary={result.summary}
            suggestions={suggestions}
            userId={user?.id || ''}
            meetingId={result.meetingId}
            onClose={() => setResult(null)}
            onUpdate={() => loadMeetings(true)}
          />
        </div>
        </>
      )}

      {/* Modal Email Composer depuis l'historique */}
      {meetingToEmail && (
        <EmailComposer
          subject={meetingToEmail.title}
          initialBody={emailBody}
          recipients={[{ email: '' }]}
          ccRecipients={[]}
          bccRecipients={[]}
          attachments={[]}
          onSend={async (emailData) => {
            try {
              console.log('📧 Envoi email depuis historique...');
              
              // Charger la méthode d'envoi de l'utilisateur
              const { data: settings } = await supabase
                .from('user_settings')
                .select('email_method, gmail_connected, smtp_host')
                .eq('user_id', user.id)
                .maybeSingle();

              const emailMethod = settings?.email_method === 'gmail' && settings?.gmail_connected
                ? 'gmail'
                : settings?.email_method === 'smtp' && settings?.smtp_host
                ? 'smtp'
                : 'local';

              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('Non authentifié');

              const trackingId = crypto.randomUUID();
              const allRecipientsRaw = [
                ...emailData.recipients.map(r => r.email),
                ...emailData.ccRecipients.map(r => r.email),
                ...emailData.bccRecipients.map(r => r.email),
              ].filter(Boolean) as string[];
              const uniqueRecipients = Array.from(new Set(allRecipientsRaw.map(email => email.trim())));
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
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
                const response = await fetch(`${supabaseUrl}/functions/v1/send-email-smtp`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId: user.id,
                    to: emailData.recipients.map(r => r.email),
                    cc: emailData.ccRecipients.map(r => r.email),
                    subject: emailData.subject,
                    htmlBody: htmlWithTracking,
                    textBody: emailData.textBody,
                    attachments: [],
                  }),
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                  throw new Error(result.error || 'Erreur lors de l\'envoi');
                }

                // Enregistrer dans l'historique
                await supabase.from('email_history').insert({
                  user_id: session.user.id,
                  meeting_id: meetingToEmail?.id || null,
                  recipients: emailData.recipients.map(r => r.email).join(', '),
                  cc_recipients: emailData.ccRecipients.length > 0 
                    ? emailData.ccRecipients.map(r => r.email).join(', ') 
                    : null,
                  subject: emailData.subject,
                  html_body: htmlWithTracking,
                  method: 'smtp',
                  attachments_count: 0,
                  status: 'sent',
                  tracking_id: trackingId,
                });

                const totalRecipients = emailData.recipients.length + emailData.ccRecipients.length + emailData.bccRecipients.length;
                setEmailSuccessData({ recipientCount: totalRecipients, method: 'smtp' });
                setShowEmailSuccessModal(true);

              } else if (emailMethod === 'gmail') {
                // Envoi via Gmail
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
                    attachments: [],
                  }),
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                  throw new Error(result.error || 'Erreur lors de l\'envoi via Gmail');
                }

                // Enregistrer dans l'historique
                await supabase.from('email_history').insert({
                  user_id: session.user.id,
                  meeting_id: meetingToEmail?.id || null,
                  recipients: emailData.recipients.map(r => r.email).join(', '),
                  cc_recipients: emailData.ccRecipients.length > 0 
                    ? emailData.ccRecipients.map(r => r.email).join(', ') 
                    : null,
                  subject: emailData.subject,
                  html_body: htmlWithTracking,
                  method: 'gmail',
                  attachments_count: 0,
                  status: 'sent',
                  message_id: result.messageId || null,
                  thread_id: result.threadId || null,
                  tracking_id: trackingId,
                });

                const totalRecipients = emailData.recipients.length + emailData.ccRecipients.length + emailData.bccRecipients.length;
                setEmailSuccessData({ recipientCount: totalRecipients, method: 'gmail' });
                setShowEmailSuccessModal(true);
              }

              setMeetingToEmail(null);
              setEmailBody('');
            } catch (error: any) {
              console.error('❌ Erreur envoi email:', error);
              alert('❌ Erreur lors de l\'envoi: ' + error.message);
            }
          }}
          onClose={() => {
            setMeetingToEmail(null);
            setEmailBody('');
          }}
          isSending={false}
        />
      )}

      {/* Modal de succès */}
      <EmailSuccessModal
        isOpen={showEmailSuccessModal}
        onClose={() => setShowEmailSuccessModal(false)}
        recipientCount={emailSuccessData.recipientCount}
        method={emailSuccessData.method}
      />

      <ShortRecordingWarningModal
        isOpen={showShortRecordingModal}
        recordedSeconds={shortRecordingSeconds}
        minimumSeconds={MIN_RECORDING_SECONDS}
        onContinueRecording={handleShortRecordingContinue}
        onDiscardRecording={handleShortRecordingDiscard}
      />

      {/* Modal de quota atteint */}
      <QuotaReachedModal
        isOpen={showQuotaReachedModal}
        onClose={handleQuotaModalClose}
        onUpgrade={handleUpgradeToUnlimited}
        onContinueWithSummary={handleContinueWithSummary}
        minutesUsed={quotaModalData.minutesUsed}
        quota={quotaModalData.quota}
      />

      {/* Modal d'avertissement de quota bas */}
      <LowQuotaWarningModal
        isOpen={showLowQuotaWarning}
        onClose={handleLowQuotaCancel}
        onContinue={handleLowQuotaContinue}
        remainingMinutes={lowQuotaRemainingMinutes}
      />

      {/* Modal de quota complètement atteint */}
      <QuotaFullModal
        isOpen={showQuotaFullModal}
        onClose={handleQuotaFullClose}
        onUpgrade={handleQuotaFullUpgrade}
      />

      {/* Rappel longue durée d'enregistrement */}
      <LongRecordingReminderModal
        isOpen={showLongRecordingReminder}
        elapsedHours={recordingTime / 3600}
        onContinue={handleLongRecordingContinue}
        onPause={handleLongRecordingPause}
        onStop={handleLongRecordingStop}
      />

      {/* Limite maximale de 4h */}
      <RecordingLimitModal
        isOpen={showRecordingLimitModal}
        onClose={handleRecordingLimitModalClose}
      />

      {/* Modal d'information pour mobile + mode visio */}
      <MobileVisioTipModal
        isOpen={showMobileVisioTip}
        onClose={handleMobileVisioTipCancel}
        onContinue={handleMobileVisioTipContinue}
      />
    </div>
  );
}

export default App;
