import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, History, LogOut, Settings as SettingsIcon, Upload, LayoutDashboard, Mail, BellRing, PauseCircle, StopCircle, PlayCircle, X, CreditCard, Menu } from 'lucide-react';
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
import { Subscription } from './components/Subscription';
import { Dashboard } from './components/Dashboard';
import { LiveSuggestions } from './components/LiveSuggestions';
import { AudioUpload } from './components/AudioUpload';
import { GmailCallback } from './components/GmailCallback';
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
import { SummaryPreferenceModal } from './components/SummaryPreferenceModal';
import { ContactSupport } from './components/ContactSupport';
import { SubscriptionSelection } from './components/SubscriptionSelection';
import { supabase, Meeting } from './lib/supabase';
import { useBackgroundProcessing } from './hooks/useBackgroundProcessing';
import { transcribeAudio, generateSummary, SummaryMode } from './services/transcription';
import { ensureWhisperCompatible } from './services/audioEncoding';
import { generateEmailBody } from './services/emailTemplates';
import { useDialog } from './context/DialogContext';

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

    // Si le path est /auth (redirection Supabase après confirmation email), rediriger vers record
    if (path === '/auth' || path.startsWith('/auth/')) {
      console.log('🔐 Redirection depuis /auth vers record');
      // Nettoyer l'URL et rediriger vers record
      window.history.replaceState({}, '', '/#record');
      return 'record' as const;
    }

    // Si le hash est 'auth' (redirection Supabase), rediriger vers record
    if (hash === 'auth') {
      console.log('🔐 Redirection depuis #auth vers record');
      window.history.replaceState({}, '', '/#record');
      return 'record' as const;
    }

    // Liste des ancres de navigation (sections de la landing page)
    const navigationAnchors = ['avantages', 'etapes', 'prix'];
    
    // Si c'est une ancre de navigation, rester sur la landing page
    if (navigationAnchors.includes(hash)) {
      return 'landing' as const;
    }

    // Si un hash valide existe, l'utiliser
    if (hash && ['record', 'history', 'detail', 'settings', 'upload', 'dashboard', 'contact', 'subscription'].includes(hash)) {
      return hash as any;
    }

    // Par défaut, landing page
    return 'landing' as const;
  };

  const [view, setView] = useState<'landing' | 'auth' | 'record' | 'history' | 'detail' | 'settings' | 'upload' | 'dashboard' | 'gmail-callback' | 'contact' | 'subscription'>(getInitialView());
  const [historyTab, setHistoryTab] = useState<'meetings' | 'emails'>('meetings'); // Onglet d'historique
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Menu burger mobile
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [result, setResult] = useState<{
    title: string;
    transcript: string;
    summaryDetailed: string;
    summaryShort: string;
    summaryMode: SummaryMode;
    audioUrl?: string | null;
    meetingId?: string;
    summaryFailed?: boolean;
  } | null>(null);
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
  const { showAlert, showConfirm } = useDialog();
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
  const [isMeetingsRefreshing, setIsMeetingsRefreshing] = useState(false);
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
  const [summaryPreference, setSummaryPreference] = useState<SummaryMode | null>(null);
  const [showSummaryPreferenceModal, setShowSummaryPreferenceModal] = useState(false);
  const [recommendedSummaryMode, setRecommendedSummaryMode] = useState<SummaryMode>('detailed');
  const [summaryWordEstimate, setSummaryWordEstimate] = useState(0);
  const [defaultSummaryModeSetting, setDefaultSummaryModeSetting] = useState<SummaryMode | null>(null);
  const [isDefaultSummaryModeLoaded, setIsDefaultSummaryModeLoaded] = useState(false);
  const [showDefaultModeReminder, setShowDefaultModeReminder] = useState(false);
  const [recordingReminderToast, setRecordingReminderToast] = useState<{ message: string } | null>(null);
  const categoryColorSupportedRef = useRef<boolean | null>(null);
  const [subscription, setSubscription] = useState<{ plan_type: 'starter' | 'unlimited'; is_active: boolean } | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionUpgradeOnly, setSubscriptionUpgradeOnly] = useState(false);

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
  const loadMeetingsRequestRef = useRef(0);
  const isHistoryInitialLoading = !meetingsLoaded && isMeetingsLoading;
  const isHistoryRefreshing = meetingsLoaded && isMeetingsRefreshing;
  const isRecentLoading = !meetingsLoaded && isMeetingsLoading;
  const isRecentRefreshing = meetingsLoaded && (isMeetingsRefreshing || isMeetingsLoading);

  const determineSummaryRecommendation = useCallback((): { recommendation: SummaryMode; wordEstimate: number } => {
    const transcriptText = (liveTranscriptRef.current || '').trim();
    const wordEstimate = transcriptText ? transcriptText.split(/\s+/).filter(Boolean).length : 0;

    if (recordingTime < 5 * 60) {
      return { recommendation: 'short', wordEstimate };
    }

    if (wordEstimate > 0 && wordEstimate < 600) {
      return { recommendation: 'short', wordEstimate };
    }

    return { recommendation: 'detailed', wordEstimate };
  }, [recordingTime]);

  const startPartialAnalysisTimer = useCallback(() => {
    if (partialAnalysisTimerRef.current) {
      console.log('[Transcription] ⏭️ Timer déjà démarré, skip');
      return;
    }

    console.log('[Transcription] 🎬 Démarrage du timer d\'analyse toutes les 15s');
    partialAnalysisTimerRef.current = window.setInterval(async () => {
      try {
        console.log('[Transcription] ⏰ Tick du timer - récupération fenêtre audio 15s...');
        const wav = await getLast15sWav();

        if (!wav || wav.size < 5000) {
          console.warn('[Transcription] ⚠️ Audio trop petit ou absent:', {
            hasWav: !!wav,
            size: wav?.size || 0
          });
          return;
        }

        console.log(`[Transcription] 📝 Envoi à Whisper: ${(wav.size / 1024).toFixed(0)} KB`);
        const text = await transcribeAudio(wav, 0, `window15s_${Date.now()}.wav`);

        console.log('[Transcription] 📨 Réponse de Whisper:', {
          texte: text,
          longueur: text?.length || 0,
          valide: !!(text && text.trim().length > 5)
        });

        if (text && text.trim().length > 5) {
          console.log('[Transcription] ✅ Texte reçu:', text);

          setPartialTranscripts(prev => {
            const normalizedText = text.trim().toLowerCase();
            const isDuplicate = prev.some(existing =>
              existing.trim().toLowerCase() === normalizedText ||
              existing.trim().toLowerCase().includes(normalizedText) ||
              normalizedText.includes(existing.trim().toLowerCase())
            );

            if (isDuplicate) {
              console.log('[Transcription] 🔄 Texte dupliqué, ignoré');
              return prev;
            }

            console.log('[Transcription] ➕ Ajout du texte au state partialTranscripts');
            return [...prev, text];
          });

          liveTranscriptRef.current = `${(liveTranscriptRef.current || '').trim()} ${text}`.trim();
          console.log('[Transcription] 📝 Mise à jour liveTranscriptRef:', {
            longueurTotale: liveTranscriptRef.current.length,
            extrait: liveTranscriptRef.current.substring(0, 100) + '...'
          });

          recentChunksRef.current.push(text);
          if (recentChunksRef.current.length > 2) recentChunksRef.current.shift();
          const twoChunkWindow = recentChunksRef.current.join(' ').trim();

          console.log('[Transcription] 🔍 Analyse partielle en cours...');
          await analyzePartialTranscript(twoChunkWindow);
          console.log('[Transcription] ✅ Analyse partielle terminée');
        } else {
          console.log('[Transcription] ⚠️ Texte vide ou trop court, ignoré');
        }
      } catch (e) {
        console.error('[Transcription] ❌ Erreur transcription 15s:', e);
      }
    }, 15000);

    console.log('[Transcription] ✅ Timer configuré, première exécution dans 15s');
  }, [getLast15sWav, analyzePartialTranscript]);

  const loadDefaultSummaryMode = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('default_summary_mode')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const mode = (data?.default_summary_mode as SummaryMode | null) || null;
      setDefaultSummaryModeSetting(mode);
      setIsDefaultSummaryModeLoaded(true);
      if (mode) {
        setShowDefaultModeReminder(false);
      }
    } catch (error) {
      console.error('Erreur chargement mode résumé par défaut:', error);
      setDefaultSummaryModeSetting(null);
      setIsDefaultSummaryModeLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadDefaultSummaryMode(user.id);
    } else {
      setDefaultSummaryModeSetting(null);
      setIsDefaultSummaryModeLoaded(false);
    }
  }, [user?.id, loadDefaultSummaryMode]);

  useEffect(() => {
    if (isPaused) {
      if (partialAnalysisTimerRef.current) {
        console.log('⏸️ Pause: arrêt du timer d\'analyse partielle');
        clearInterval(partialAnalysisTimerRef.current);
        partialAnalysisTimerRef.current = null;
      }
    } else if (isRecording && !partialAnalysisTimerRef.current) {
      console.log('▶️ Reprise: relance du timer d\'analyse partielle');
      startPartialAnalysisTimer();
    }
  }, [isPaused, isRecording, startPartialAnalysisTimer]);

  const promptSummaryPreference = useCallback(() => {
    const { recommendation, wordEstimate } = determineSummaryRecommendation();
    setRecommendedSummaryMode(recommendation);
    setSummaryWordEstimate(wordEstimate);
    setShowDefaultModeReminder(!defaultSummaryModeSetting);
    setShowSummaryPreferenceModal(true);
  }, [determineSummaryRecommendation, defaultSummaryModeSetting]);


  useEffect(() => {
    // Si on est sur le callback Gmail, ne pas exécuter la logique normale
    if (window.location.pathname === '/gmail-callback') {
      console.log('🔄 Page de callback Gmail détectée, skip initialisation normale');
      return;
    }

    checkUser();

    // Restaurer la vue depuis l'URL (hash) au chargement
    let hash = window.location.hash.replace('#', '');

    // Extraire juste la vue (avant # ou ? ou &)
    const hashView = hash.split(/[#?&]/)[0];

    if (hashView && ['record', 'history', 'upload', 'settings', 'dashboard', 'contact', 'subscription'].includes(hashView)) {
      console.log('🔄 Restauration de la vue depuis l\'URL:', hashView);
      setView(hashView as any);
    } else if (hashView === 'detail') {
      // Si on est sur detail sans réunion, rediriger vers history
      console.log('⚠️ Vue detail sans réunion, redirection vers history');
      setView('history');
      window.history.replaceState({ view: 'history' }, '', '#history');
    } else if (hash && hash !== '') {
      // Vérifier si c'est une ancre de navigation (sections de la landing page)
      const navigationAnchors = ['avantages', 'etapes', 'prix'];
      if (navigationAnchors.includes(hashView)) {
        // C'est une ancre de navigation, rester sur la landing page
        console.log('📍 Ancre de navigation détectée:', hashView);
        setView('landing');
      } else {
        // Hash invalide, rediriger vers record
        console.log('⚠️ Hash invalide:', hash, 'redirection vers record');
        setView('record');
        window.history.replaceState({ view: 'record' }, '', '#record');
      }
    }

    // Vérifier la session initiale
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔍 Session initiale:', !!session?.user);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          loadMeetings();
        }
      } catch (error) {
        console.error('❌ Erreur lors de la vérification de la session:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkInitialSession();

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event, 'User:', !!session?.user);
      setUser(session?.user ?? null);

      // Arrêter le chargement si ce n'est pas déjà fait
      setIsAuthLoading(false);

      // Ne changer la vue que lors de la connexion initiale, pas à chaque changement d'état
      if (session?.user && event === 'SIGNED_IN') {
        // Si on a déjà une vue depuis l'URL, ne pas la changer
        const currentHash = window.location.hash.replace('#', '');
        const navigationAnchors = ['avantages', 'etapes', 'prix'];
        const validViews = ['record', 'history', 'upload', 'settings', 'dashboard', 'contact', 'subscription'];

        // Ne pas rediriger si on est sur une ancre de navigation ou une vue valide
        if (!currentHash || (!validViews.includes(currentHash) && !navigationAnchors.includes(currentHash))) {
          setView('record');
          window.history.replaceState({ view: 'record' }, '', '#record');
        }
        loadMeetings();
        checkSubscription(session.user.id);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  // Charger les réunions et vérifier l'abonnement quand l'utilisateur change
  useEffect(() => {
    if (user) {
      loadMeetings();
      checkSubscription(user.id);
    } else {
      // Réinitialiser l'état d'abonnement quand l'utilisateur se déconnecte
      setSubscription(null);
      setIsSubscriptionLoading(false);
    }
  }, [user]);

  // Recharger les réunions quand on navigue vers certaines vues
  useEffect(() => {
    if (user && (view === 'record' || view === 'history' || view === 'dashboard')) {
      console.log('🔄 Vue changée vers', view, '- rechargement des réunions');
      // Forcer le rechargement pour la vue history afin de garantir la synchronisation avec la sidebar
      const forceReload = view === 'history';
      loadMeetings(forceReload);
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
        let hash = window.location.hash.replace('#', '');

        // Extraire juste la vue (avant # ou ? ou &)
        const hashView = hash.split(/[#?&]/)[0];

        if (hashView && ['record', 'history', 'upload', 'settings', 'dashboard', 'contact', 'subscription'].includes(hashView)) {
          console.log('🔄 Restauration depuis hash:', hashView);
          setView(hashView as any);
        } else if (hashView === 'detail') {
          // Rediriger vers history si on est sur detail sans réunion
          console.log('⚠️ Vue detail sans réunion, redirection vers history');
          setView('history');
          window.history.replaceState({ view: 'history' }, '', '#history');
        } else if (hash && hash !== '') {
          // Vérifier si c'est une ancre de navigation
          const navigationAnchors = ['avantages', 'etapes', 'prix'];
          if (navigationAnchors.includes(hashView)) {
            console.log('📍 Ancre de navigation détectée:', hashView);
            setView('landing');
          } else {
            // Hash invalide
            console.log('⚠️ Hash invalide:', hash, 'redirection vers record');
            setView('record');
            window.history.replaceState({ view: 'record' }, '', '#record');
          }
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
      const path = window.location.pathname;
      let hash = window.location.hash.replace('#', '');

      // Gérer la redirection depuis /auth
      if (path === '/auth' || path.startsWith('/auth/')) {
        console.log('🔐 Redirection depuis /auth détectée');
        window.history.replaceState({}, '', '/#record');
        setView('record');
        return;
      }

      // Liste des ancres de navigation (sections de la landing page) à ignorer
      const navigationAnchors = ['avantages', 'etapes', 'prix'];
      
      // Si c'est une ancre de navigation, ne rien faire et laisser le navigateur gérer le scroll
      if (navigationAnchors.includes(hash)) {
        console.log('📍 Ancre de navigation détectée:', hash, '- scroll automatique');
        // S'assurer qu'on reste sur la landing page
        if (view !== 'landing') {
          setView('landing');
        }
        return;
      }

      // Si on est sur la landing page et que le hash n'est pas une vue valide, ne rien faire
      if (view === 'landing' && hash && !['record', 'history', 'upload', 'settings', 'dashboard', 'contact', 'subscription', 'detail'].includes(hash)) {
        console.log('📍 Sur landing page avec hash non-vue:', hash, '- on ignore');
        return;
      }

      // Extraire juste la vue (avant # ou ? ou &)
      const hashView = hash.split(/[#?&]/)[0];

      if (hashView && ['record', 'history', 'upload', 'settings', 'dashboard', 'contact', 'subscription'].includes(hashView)) {
        console.log('🔄 Hash changé:', hashView, '(hash complet:', hash, ')');
        setView(hashView as any);
      } else if (hashView === 'detail') {
        // Ne rien faire - laisser le useEffect gérer la redirection si nécessaire
        console.log('🔄 Hash detail détecté, conservation de la vue actuelle');
      } else if (hash && hash !== '' && view !== 'landing') {
        // Hash invalide - seulement si on n'est pas sur la landing page
        console.log('⚠️ Hash invalide:', hash, 'redirection vers record');
        setView('record');
        window.history.replaceState({ view: 'record' }, '', '#record');
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
      
      if (!summaryPreference) {
        console.log('🔍 Pas de préférence de résumé définie', {
          isDefaultSummaryModeLoaded,
          defaultSummaryModeSetting,
          showSummaryPreferenceModal
        });
        
        if (isDefaultSummaryModeLoaded) {
          if (defaultSummaryModeSetting) {
            console.log('✅ Utilisation du mode par défaut:', defaultSummaryModeSetting);
            setSummaryPreference(defaultSummaryModeSetting);
          } else if (!showSummaryPreferenceModal) {
            console.log('📋 Affichage du modal de choix (pas de mode par défaut)');
            setShowDefaultModeReminder(true);
            promptSummaryPreference();
          }
        } else {
          console.log('⏳ Attente du chargement du mode de résumé par défaut');
        }
        return;
      }

      if (isProcessing) {
        console.log('⏳ Traitement déjà en cours, attente...');
        return;
      }
      
      console.log('🎬 Appel de processRecording depuis useEffect avec mode:', summaryPreference);
      processRecording(summaryPreference);
    }
  }, [
    audioBlob,
    isRecording,
    recordingTime,
    resetRecording,
    summaryPreference,
    defaultSummaryModeSetting,
    isDefaultSummaryModeLoaded,
    showSummaryPreferenceModal,
    promptSummaryPreference,
    isProcessing,
  ]);

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
      // IMPORTANT: Réinitialiser les transcriptions partielles au démarrage d'un nouvel enregistrement
      // pour éviter que des segments d'anciens enregistrements ne se mélangent avec les nouveaux
      console.log('🧹 Nettoyage des transcriptions partielles pour nouvel enregistrement');
      liveTranscriptRef.current = '';
      setPartialTranscripts([]);
      recentChunksRef.current = [];
      lastProcessedSizeRef.current = 0;
      
      setSummaryPreference(null);
      setShowSummaryPreferenceModal(false);
      setSummaryWordEstimate(0);
      
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

      if (session?.user) {
        await checkSubscription(session.user.id);
      }
    } catch (error) {

    } finally {
      setIsAuthLoading(false);
    }
  };

  const checkSubscription = async (userId: string) => {
    setIsSubscriptionLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('plan_type, is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      setSubscription(data);

      // Si pas d'abonnement actif, afficher le modal de sélection
      if (!data || !data.is_active) {
        setShowSubscriptionModal(true);
        setSubscriptionUpgradeOnly(false);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setIsSubscriptionLoading(false);
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

    const requestId = ++loadMeetingsRequestRef.current;
    if (meetingsLoaded && !forceReload) {
      console.log('📋 Réunions déjà en cache, skip reload');
      return;
    }

    if (!meetingsLoaded) {
    setIsMeetingsLoading(true);
    } else {
      setIsMeetingsRefreshing(true);
    }
    setMeetingsError(null);
    
    try {
      console.log('📋 Chargement des réunions pour user:', user.id);

      const baseSelect = `
        id,
        user_id,
        title,
        created_at,
        duration,
        summary,
        summary_short,
        summary_detailed,
        participant_first_name,
        participant_last_name,
        participant_email,
        summary_mode,
        summary_regenerated,
        category_id,
        meeting_categories ( id, name, created_at, color )
      `;

      const fallbackSelect = `
        id,
        user_id,
        title,
        created_at,
        duration,
        summary,
        summary_short,
        summary_detailed,
        participant_first_name,
        participant_last_name,
        participant_email,
        summary_mode,
        summary_regenerated,
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
          summary_mode: (rest.summary_mode as SummaryMode) || 'detailed',
          summary_regenerated: !!rest.summary_regenerated,
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

      if (loadMeetingsRequestRef.current === requestId) {
      setMeetings(normalizedMeetings);
      setMeetingsLoaded(true);
      } else {
        console.log('⏭️ Réponse loadMeetings ignorée (stale)');
      }
      
    } catch (e) {
      console.error('❌ Exception chargement réunions:', e);
      setMeetingsError('Erreur lors du chargement des réunions: ' + (e as Error).message);
      setMeetingsLoaded(false);
    } finally {
      if (loadMeetingsRequestRef.current === requestId) {
      setIsMeetingsLoading(false);
        setIsMeetingsRefreshing(false);
      }
    }
  };

  const processRecording = async (summaryMode: SummaryMode) => {
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

      // Timeout de 5 secondes pour la finalisation de la transcription
      const finalizationPromise = new Promise<{ final: string; display: string }>(async (resolve) => {
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
          resolve({ final: finalTranscript, display: displayTranscript });
        } else {
          const transcript = await transcribeAudio(audioBlob); // Fallback si, pour une raison, on n'a rien accumulé
          resolve({ final: transcript, display: transcript });
        }
      });

      const timeoutPromise = new Promise<{ final: string; display: string }>((resolve) => {
        setTimeout(() => {
          console.log('⏱️ Timeout finalisation transcription - continuation avec données actuelles');
          const fallbackText = liveTranscriptRef.current?.trim() || partialTranscripts.join(' ').trim() || '';
          resolve({ final: fallbackText, display: fallbackText });
        }, 5000); // 5 secondes max
      });

      const result = await Promise.race([finalizationPromise, timeoutPromise]);
      finalTranscript = result.final;
      displayTranscript = result.display;

      // 2) PRIORITÉ: Créer la réunion avec la transcription D'ABORD (avant le résumé)
      // Cela garantit qu'on ne perd jamais la transcription même si le résumé échoue
      setProcessingStatus('Enregistrement de la réunion...');

      const provisionalTitle = meetingTitle || `Réunion du ${new Date().toLocaleDateString('fr-FR')}`;

      console.log('💾 Création de la réunion avec transcription EN PREMIER (protection contre perte de données)');

      const { data: created, error: createErr } = await supabase
        .from('meetings')
        .insert({
          title: provisionalTitle,
          transcript: finalTranscript, // Version propre pour le résumé
          display_transcript: displayTranscript, // Version avec séparateurs pour l'affichage
          summary: null, // Pas encore de résumé
          summary_short: null,
          summary_detailed: null,
          summary_mode: summaryMode,
          summary_regenerated: false,
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

      console.log('✅ Réunion créée avec transcription, ID:', created?.id);

      // 3) Maintenant, tenter de générer le résumé (peut échouer sans perdre la réunion)
      setProcessingStatus(summaryMode === 'short' ? 'Génération du résumé court...' : 'Génération du résumé détaillé...');

      let summaryResult: { summary?: string; title?: string } = {};
      let summaryFailed = false;

      try {
        summaryResult = await generateSummary(finalTranscript, user?.id, 0, summaryMode);

        console.log('✅ Résumé généré:', {
          mode: summaryMode,
          summaryLength: summaryResult.summary?.length,
        });

        // Mettre à jour la réunion avec le résumé
        const finalTitle = meetingTitle || summaryResult.title || provisionalTitle;

        const { error: updateErr } = await supabase
          .from('meetings')
          .update({
            title: finalTitle,
            summary: summaryResult.summary,
            summary_short: summaryMode === 'short' ? summaryResult.summary : null,
            summary_detailed: summaryMode === 'detailed' ? summaryResult.summary : null,
          })
          .eq('id', created.id);

        if (updateErr) {
          console.error('❌ Erreur mise à jour résumé:', updateErr);
          summaryFailed = true;
        }

        // Mettre à jour summary_failed si la colonne existe (non bloquant)
        try {
          await supabase
            .from('meetings')
            .update({ summary_failed: false })
            .eq('id', created.id);
        } catch {
          // La colonne n'existe pas encore, ignorer
        }
      } catch (summaryError) {
        console.error('❌ Échec génération résumé (réunion sauvegardée quand même):', summaryError);
        summaryFailed = true;

        // Marquer la réunion comme ayant échoué la génération de résumé (non bloquant)
        try {
          await supabase
            .from('meetings')
            .update({ summary_failed: true })
            .eq('id', created.id);
        } catch {
          // La colonne n'existe pas encore, ignorer
        }
      }

      const finalTitle = meetingTitle || summaryResult.title || provisionalTitle;
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
        setSummaryPreference(null); // Réinitialiser pour le prochain enregistrement
        liveTranscriptRef.current = '';
        setPartialTranscripts([]);
        setCurrentMeetingId(null);
        lastProcessedSizeRef.current = 0;
        
        // Afficher le résumé immédiatement (sans audio pour l'instant)
        console.log('🎯 Définition du résultat:', {
          title: finalTitle,
          mode: summaryMode,
          summaryLength: summaryResult.summary?.length,
          summaryFailed,
        });
        setResult({
          title: finalTitle,
          transcript: displayTranscript,
          summaryDetailed: summaryMode === 'detailed' ? summaryResult.summary || '' : '',
          summaryShort: summaryMode === 'short' ? summaryResult.summary || '' : '',
          summaryMode,
          audioUrl: null,
          meetingId: created?.id,
          summaryFailed, // Pour afficher le bouton de régénération si nécessaire
        });

        // Si le résumé a échoué, informer l'utilisateur mais ne pas perdre la réunion
        if (summaryFailed) {
          await showAlert({
            title: 'Réunion sauvegardée',
            message: 'Votre réunion a été sauvegardée avec la transcription, mais la génération du résumé a échoué. Vous pouvez régénérer le résumé depuis les détails de la réunion.',
            variant: 'warning',
          });
        }
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
      await showAlert({
        title: 'Erreur de traitement',
        message: 'Une erreur est survenue lors du traitement.',
        variant: 'danger',
      });
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
    startPartialAnalysisTimer();
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
        await showAlert({
          title: 'Réunion introuvable',
          message: '❌ Réunion introuvable',
          variant: 'warning',
        });
        return;
      }

      setSelectedMeeting(detailedMeeting);
      setSelectedMeetingId(meeting.id);
      setView('detail');
    } catch (error) {
      console.error('Erreur chargement réunion:', error);
      await showAlert({
        title: 'Erreur de chargement',
        message: '❌ Erreur lors du chargement de la réunion',
        variant: 'danger',
      });
    } finally {
      setIsMeetingDetailLoading(false);
    }
  };

  const handleViewMeetingById = async (meetingId: string) => {
    setIsMeetingDetailLoading(true);

    try {
      const detailedMeeting = await fetchMeetingDetails(meetingId);

      if (!detailedMeeting) {
        await showAlert({
          title: 'Réunion introuvable',
          message: '❌ Réunion introuvable',
          variant: 'warning',
        });
        return;
      }

      setSelectedMeeting(detailedMeeting);
      setSelectedMeetingId(meetingId);
      setView('detail');
    } catch (error) {
      console.error('Erreur chargement réunion:', error);
      await showAlert({
        title: 'Erreur de chargement',
        message: '❌ Erreur lors du chargement de la réunion',
        variant: 'danger',
      });
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
    console.log('👑 Upgrade demandé, affichage modal paiement');
    setShowQuotaReachedModal(false);

    // Arrêter l'enregistrement et générer le résumé
    stopRecording();

    // Afficher le modal d'abonnement en mode upgrade
    setTimeout(() => {
      setSubscriptionUpgradeOnly(true);
      setShowSubscriptionModal(true);
    }, 500);
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

    // Ne demander le mode que si l'utilisateur n'a pas configuré de mode par défaut
    if (!showSummaryPreferenceModal && !defaultSummaryModeSetting) {
      promptSummaryPreference();
    }

    skipProcessingRef.current = false;
    stopRecording();
  }, [isRecording, recordingTime, stopRecording, showSummaryPreferenceModal, promptSummaryPreference, defaultSummaryModeSetting]);

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

  const handleSummaryPreferenceSelect = useCallback((mode: SummaryMode) => {
    console.log('📝 Mode de résumé sélectionné:', mode);
    setSummaryPreference(mode);
    setShowSummaryPreferenceModal(false);
    setShowDefaultModeReminder(false);
  }, []);

  const handleSetDefaultModeFromModal = useCallback(async (mode: SummaryMode) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        default_summary_mode: mode,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });
    
    if (error) {
      console.error('Erreur lors de la sauvegarde du mode par défaut:', error);
      throw error;
    }
    
    setDefaultSummaryModeSetting(mode);
    console.log('✅ Mode par défaut sauvegardé:', mode);
  }, [user]);

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
    setSubscriptionUpgradeOnly(true);
    setShowSubscriptionModal(true);
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
    return <Login onSuccess={async () => {
      console.log('✅ Login réussi, initialisation...');
      try {
        setIsAuthLoading(false);
        // Respecter le hash de l'URL s'il existe
        const hash = window.location.hash.replace('#', '');
        if (hash && ['record', 'history', 'upload', 'settings', 'dashboard', 'contact', 'subscription'].includes(hash)) {
          console.log('📍 setView depuis hash:', hash);
          setView(hash as any);
        } else {
          console.log('📍 setView(record)');
          setView('record');
          window.location.hash = 'record';
        }
        console.log('✅ Vue changée avec succès');
      } catch (error) {
        console.error('❌ Erreur après login:', error);
        await showAlert({
          title: 'Erreur de connexion',
          message: `Erreur après connexion: ${error}`,
          variant: 'danger',
        });
      }
    }} />;
  }

  // Guard contre les erreurs de rendu
  try {
    console.log('🎨 Render principal, view:', view, 'user:', !!user, 'subscription:', subscription, 'isSubscriptionLoading:', isSubscriptionLoading);
  } catch (e) {
    console.error('❌ Erreur dans render:', e);
  }

  // Afficher un écran de chargement pendant la vérification de l'abonnement
  if (user && isSubscriptionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-coral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cocoa-600 text-lg">Vérification de votre abonnement...</p>
        </div>
      </div>
    );
  }

  // Bloquer l'accès si pas d'abonnement actif (sauf pour la page subscription)
  if (user && (!subscription || !subscription.is_active) && view !== 'subscription') {
    return (
      <div className="h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 flex items-center justify-center p-4">
        {showSubscriptionModal && (
          <SubscriptionSelection
            onClose={async () => {
              await checkSubscription(user.id);
              if (subscription && subscription.is_active) {
                setShowSubscriptionModal(false);
                setView('record');
                window.location.hash = 'record';
              }
            }}
            currentPlan={subscription?.plan_type}
            upgradeOnly={false}
            canClose={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 flex flex-col overflow-hidden">

      {/* Header Navigation - Barre horizontale en haut */}
      <header className="bg-white border-b-2 border-orange-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {/* Ligne principale */}
          <div className="flex items-center justify-between h-16">
            {/* Menu burger - Mobile uniquement (à gauche) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
              aria-label="Menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Logo et nom - Centré sur mobile, à gauche sur desktop */}
            <div className="flex items-center gap-2.5 flex-shrink-0 min-w-fit xl:flex-1">
              <img src="/logohallia.png" alt="Logo Hallia" className="w-9 h-9 object-contain" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl md:text-2xl font-thunder font-bold tracking-tight text-gray-900">HALL RECORDER</span>
              </div>
            </div>

            {/* Navigation centrale - Desktop */}
            <nav className="hidden xl:flex items-center gap-0.5 flex-1 justify-center px-4">
              <button
                onClick={() => {
                  setView('record');
                  window.location.hash = 'record';
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  view === 'record'
                    ? 'text-coral-600 bg-coral-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Enregistrement</span>
              </button>
              <button
                onClick={() => {
                  setView('dashboard');
                  window.location.hash = 'dashboard';
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  view === 'dashboard'
                    ? 'text-coral-600 bg-coral-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Tableau de bord</span>
              </button>
              <button
                onClick={() => {
                  setView('history');
                  window.location.hash = 'history';
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  view === 'history'
                    ? 'text-coral-600 bg-coral-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Historique</span>
              </button>
              <button
                onClick={() => {
                  setView('upload');
                  window.location.hash = 'upload';
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  view === 'upload'
                    ? 'text-coral-600 bg-coral-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer</span>
              </button>
              <button
                onClick={() => {
                  setView('settings');
                  window.location.hash = 'settings';
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  view === 'settings'
                    ? 'text-coral-600 bg-coral-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Paramètres</span>
              </button>
              <button
                onClick={() => {
                  setView('subscription');
                  window.location.hash = 'subscription';
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  view === 'subscription'
                    ? 'text-coral-600 bg-coral-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Abonnement</span>
              </button>
              <button
                onClick={() => {
                  setView('contact');
                  window.location.hash = 'contact';
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  view === 'contact'
                    ? 'text-coral-600 bg-coral-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Support</span>
              </button>
            </nav>

            {/* Bouton déconnexion - Caché sur mobile (dans le menu burger) */}
            <button
              onClick={handleLogout}
              className="hidden xl:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
              title="Déconnexion"
            >
              <span>Déconnexion</span>
              <LogOut className="w-4 h-4" />
            </button>

            {/* Placeholder pour équilibrer le layout sur mobile */}
            <div className="xl:hidden w-10"></div>
          </div>
        </div>

        {/* Menu burger mobile - Panneau slide-in */}
        {isMobileMenuOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/50 z-[55] xl:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>

            {/* Menu slide-in */}
            <nav className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-[60] xl:hidden overflow-y-auto ${isRecording ? 'pt-[124px]' : ''}`}>
              {/* Header du menu */}
              <div className={`flex items-center justify-between p-4 border-b border-gray-200 ${isRecording ? 'fixed top-[124px] left-0 w-80 max-w-[85vw] bg-white z-10' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <img src="/logohallia.png" alt="Logo Hallia" className="w-8 h-8 object-contain" />
                  <span className="text-lg font-thunder font-bold text-gray-900">HALL RECORDER</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items du menu */}
              <div className="py-4">
                <div className="flex flex-col gap-1 px-3">
                <button
                  onClick={() => {
                    setView('record');
                    window.location.hash = 'record';
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'record'
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                  <span>Enregistrement</span>
                </button>
                <button
                  onClick={() => {
                    setView('dashboard');
                    window.location.hash = 'dashboard';
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'dashboard'
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span>Tableau de bord</span>
                </button>
                <button
                  onClick={() => {
                    setView('history');
                    window.location.hash = 'history';
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'history'
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <History className="w-5 h-5" />
                  <span>Historique</span>
                </button>
                <button
                  onClick={() => {
                    setView('upload');
                    window.location.hash = 'upload';
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'upload'
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Upload className="w-5 h-5" />
                  <span>Importer</span>
                </button>
                <button
                  onClick={() => {
                    setView('settings');
                    window.location.hash = 'settings';
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'settings'
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <SettingsIcon className="w-5 h-5" />
                  <span>Paramètres</span>
                </button>
                <button
                  onClick={() => {
                    setView('subscription');
                    window.location.hash = 'subscription';
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'subscription'
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Abonnement</span>
                </button>
                <button
                  onClick={() => {
                    setView('contact');
                    window.location.hash = 'contact';
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'contact'
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  <span>Support</span>
                </button>

                {/* Séparateur */}
                <div className="border-t border-gray-200 my-2"></div>

                {/* Bouton déconnexion */}
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Déconnexion</span>
                </button>
                </div>
              </div>
            </nav>
          </>
        )}
      </header>

      <main className="flex-1 overflow-auto">
        <div className={view === 'record' ? 'flex flex-col h-full' : 'max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-8 h-full'}>
          {view === 'record' ? (
            <>
              {/* Contenu principal de l'enregistrement */}
              <div className="flex-1 px-4 md:px-8 py-4 md:py-6 overflow-y-auto min-h-0">
              {!isRecording ? (
                /* === AVANT L'ENREGISTREMENT === */
                <div className="max-w-5xl mx-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Panneau gauche - Démarrer un enregistrement */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-6">Démarrer un enregistrement</h2>

                      {/* Nom de la réunion */}
                      <div className="mb-6">
                        <label htmlFor="meetingTitle" className="block text-sm font-medium text-gray-700 mb-2">
                          Nom de la réunion
                        </label>
                        <input
                          type="text"
                          id="meetingTitle"
                          value={meetingTitle}
                          onChange={(e) => setMeetingTitle(e.target.value)}
                          placeholder="Ex: Réunion d'équipe - Planning Q4"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 text-sm text-gray-800 placeholder-gray-400 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">
                          Optionnel - l'IA générera un titre si vide
                        </p>
                      </div>

                      {/* Mode selector minimaliste */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Mode d'enregistrement</label>
                        <div className="space-y-2">
                          <button
                            onClick={() => setSelectedRecordingMode('microphone')}
                            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                              selectedRecordingMode === 'microphone'
                                ? 'border-gray-900 bg-gray-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              selectedRecordingMode === 'microphone' ? 'bg-gray-900' : 'bg-gray-100'
                            }`}>
                              <Mic className={`w-5 h-5 ${selectedRecordingMode === 'microphone' ? 'text-white' : 'text-gray-600'}`} />
                            </div>
                            <div className="text-left flex-1">
                              <p className={`font-medium ${selectedRecordingMode === 'microphone' ? 'text-gray-900' : 'text-gray-700'}`}>
                                Mode Présentiel
                              </p>
                              <p className="text-xs text-gray-500">Réunion en personne via microphone</p>
                            </div>
                            {selectedRecordingMode === 'microphone' && (
                              <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>

                          <button
                            onClick={() => setSelectedRecordingMode('visio')}
                            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                              selectedRecordingMode === 'visio'
                                ? 'border-gray-900 bg-gray-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              selectedRecordingMode === 'visio' ? 'bg-gray-900' : 'bg-gray-100'
                            }`}>
                              <svg className={`w-5 h-5 ${selectedRecordingMode === 'visio' ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="text-left flex-1">
                              <p className={`font-medium ${selectedRecordingMode === 'visio' ? 'text-gray-900' : 'text-gray-700'}`}>
                                Mode Visio
                              </p>
                              <p className="text-xs text-gray-500">Réunion en ligne (Zoom, Meet, Teams...)</p>
                            </div>
                            {selectedRecordingMode === 'visio' && (
                              <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Panneau droit - Bouton microphone circulaire */}
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center min-h-[300px]">
                      {/* Grand bouton microphone circulaire avec animation */}
                      <div className="relative">
                        {/* Cercles d'animation pulsants - dégradé rose-corail vers orange */}
                        {!isStartingRecording && (
                          <>
                            <div className="absolute inset-0 w-40 h-40 rounded-full opacity-75 animate-ping" style={{
                              background: 'linear-gradient(135deg, #FF9999 0%, #FFB366 100%)'
                            }}></div>
                            <div className="absolute inset-0 w-40 h-40 rounded-full opacity-50 animate-pulse" style={{
                              background: 'linear-gradient(135deg, #FF6B6B 0%, #FFA64D 100%)'
                            }}></div>
                          </>
                        )}

                        {/* Bouton principal - même dégradé rose-corail vers orange */}
                        <button
                          onClick={() => {
                            console.log('🔴 CLIC sur bouton Enregistrer');
                            handleStartRecording();
                          }}
                          disabled={isStartingRecording}
                          className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${
                            isStartingRecording
                              ? 'bg-gray-300 cursor-not-allowed'
                              : 'hover:scale-110 active:scale-95 cursor-pointer'
                          }`}
                          style={!isStartingRecording ? {
                            background: 'linear-gradient(135deg, #FF6B6B 0%, #FFA64D 100%)'
                          } : undefined}
                          onMouseEnter={(e) => {
                            if (!isStartingRecording) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #FF5252 0%, #FF9933 100%)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isStartingRecording) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #FF6B6B 0%, #FFA64D 100%)';
                            }
                          }}
                        >
                          {isStartingRecording ? (
                            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Mic className="w-16 h-16 text-white mb-2" />
                              <span className="text-white font-semibold text-lg">Démarrer</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Timer format digital sous le bouton */}
                      <div className="mt-8 flex items-center gap-2">
                        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
                          <span className="text-3xl font-bold text-gray-400 tabular-nums">00</span>
                        </div>
                        <span className="text-2xl text-gray-400">:</span>
                        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
                          <span className="text-3xl font-bold text-gray-400 tabular-nums">00</span>
                        </div>
                        <span className="text-2xl text-gray-400">:</span>
                        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
                          <span className="text-3xl font-bold text-gray-400 tabular-nums">00</span>
                        </div>
                      </div>

                      <p className="text-gray-400 text-sm mt-4 text-center">
                        Cliquez sur "Enregistrer" pour démarrer
                      </p>
                      <p className="text-gray-400 text-xs mt-2 text-center">
                        La visualisation audio apparaîtra ici
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* === PENDANT L'ENREGISTREMENT === */
                <div className="max-w-5xl mx-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Panneau gauche - Infos uniquement (les contrôles sont dans le bouton flottant) */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="relative">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700">Enregistrement en cours</span>
                      </div>

                      {/* Timer */}
                      <div className="text-center mb-8">
                        <p className="text-5xl font-bold text-gray-900 tabular-nums">
                          {String(Math.floor(recordingTime / 3600)).padStart(2, '0')}:
                          {String(Math.floor((recordingTime % 3600) / 60)).padStart(2, '0')}:
                          {String(recordingTime % 60).padStart(2, '0')}
                        </p>
                      </div>

                      {/* Boutons de contrôle */}
                      <div className="flex items-center justify-center gap-4 mb-6">
                        {isPaused ? (
                          <button
                            onClick={resumeRecording}
                            className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all"
                          >
                            <PlayCircle className="w-5 h-5" />
                            Reprendre
                          </button>
                        ) : (
                          <button
                            onClick={pauseRecording}
                            className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
                          >
                            <PauseCircle className="w-5 h-5" />
                            Pause
                          </button>
                        )}
                        <button
                          onClick={handleStopRecordingRequest}
                          className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all"
                        >
                          <StopCircle className="w-5 h-5" />
                          Arrêter
                        </button>
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                          Notes complémentaires
                        </label>
                        <textarea
                          id="notes"
                          value={recordingNotes}
                          onChange={(e) => setRecordingNotes(e.target.value)}
                          placeholder="Ajoutez vos notes ici..."
                          className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 resize-none text-sm text-gray-800 placeholder-gray-400 transition-all"
                        />
                      </div>
                    </div>

                    {/* Panneau droit - Visualisation audio */}
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 flex flex-col">
                      <div className="flex-1 flex items-center justify-center">
                        <AudioVisualizer
                          stream={audioStream}
                          isActive={isRecording && !isPaused && !showQuotaReachedModal}
                          barColor="#FF6B4A"
                          bgColor="transparent"
                        />
                      </div>

                      {isPaused && (
                        <div className="text-center mt-4">
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                            <PauseCircle className="w-4 h-4" />
                            En pause
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Suggestions pendant l'enregistrement */}
                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Points à clarifier */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h4 className="font-medium text-gray-900">Points à clarifier</h4>
                      </div>

                      {suggestions.some(s => s.suggestions && s.suggestions.length > 0) ? (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {suggestions.filter(s => s.suggestions && s.suggestions.length > 0).slice(-3).reverse().map((suggestion, index) => (
                            <div key={index} className="text-sm text-gray-600">
                              {suggestion.suggestions.map((q, qIndex) => (
                                <p key={qIndex} className="py-1">• {q}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Analyse en cours...</p>
                      )}
                    </div>

                    {/* Sujets à explorer */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                        <h4 className="font-medium text-gray-900">Sujets à explorer</h4>
                      </div>

                      {suggestions.some(s => s.topics_to_explore && s.topics_to_explore.length > 0) ? (
                        <div className="flex flex-wrap gap-2">
                          {suggestions.filter(s => s.topics_to_explore && s.topics_to_explore.length > 0).slice(-2).reverse().flatMap((suggestion, index) =>
                            suggestion.topics_to_explore.map((topic, topicIndex) => (
                              <span key={`${index}-${topicIndex}`} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                {topic}
                              </span>
                            ))
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Analyse en cours...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>

              {/* Section Historique en bas - minimaliste avec 3 réunions - masquée pendant l'enregistrement */}
              {!isRecording && (
              <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 md:px-8 py-4">
                <div className="max-w-5xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Historique</h3>
                    <button
                      onClick={() => setView('history')}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Modifier
                    </button>
                  </div>

                  {isRecentLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, idx) => (
                        <div key={`skeleton-${idx}`} className="animate-pulse flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                          <div className="w-16 h-4 bg-gray-100 rounded" />
                          <div className="flex-1 h-4 bg-gray-100 rounded" />
                          <div className="w-12 h-4 bg-gray-100 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : meetings.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Aucune réunion enregistrée</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {meetings.slice(0, 3).map((meeting) => {
                        const durationMins = Math.floor(meeting.duration / 60);
                        const durationSecs = meeting.duration % 60;

                        return (
                          <div
                            key={meeting.id}
                            onClick={() => handleViewMeeting(meeting)}
                            className="flex items-center gap-4 py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                          >
                            {/* Date */}
                            <span className="text-sm text-gray-500 w-20 flex-shrink-0">
                              {new Date(meeting.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>

                            {/* Titre */}
                            <span className="flex-1 text-sm text-gray-900 truncate font-medium">
                              {meeting.title}
                            </span>

                            {/* Catégorie/Badge */}
                            {meeting.category && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
                                {meeting.category.name}
                              </span>
                            )}

                            {/* Durée */}
                            <span className="text-sm text-gray-500 w-14 text-right flex-shrink-0">
                              {durationMins}:{durationSecs.toString().padStart(2, '0')}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewMeeting(meeting);
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                title="Voir"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              )}
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
                  key={`meeting-history-${meetings.length}-${meetings[0]?.id || 'empty'}`}
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

                    const summaryForEmail =
                      ((meeting.summary_mode as SummaryMode) || 'detailed') === 'short'
                        ? meeting.summary_short ?? meeting.summary ?? ''
                        : meeting.summary_detailed ?? meeting.summary ?? '';

                    const body = await generateEmailBody({
                      title: meeting.title,
                      date: formatDate(meeting.created_at),
                      duration: meeting.duration ? formatDuration(meeting.duration) : undefined,
                      participantName: meeting.participant_first_name && meeting.participant_last_name
                        ? `${meeting.participant_first_name} ${meeting.participant_last_name}`
                        : undefined,
                      participantEmail: meeting.participant_email || undefined,
                      summary: summaryForEmail,
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
                  isLoading={isHistoryInitialLoading}
                  isRefreshing={isHistoryRefreshing}
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
            <Settings
              userId={user?.id || ''}
              onDefaultSummaryModeChange={(mode) => {
                setDefaultSummaryModeSetting(mode);
                setIsDefaultSummaryModeLoaded(true);
              }}
            />
          ) : view === 'subscription' ? (
            <Subscription userId={user?.id || ''} />
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
            <MeetingDetail meeting={selectedMeeting} onBack={handleBackToHistory} onUpdate={handleMeetingUpdate} userDefaultSummaryMode={defaultSummaryModeSetting} />
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
                await showAlert({
                  title: 'Erreur de chargement',
                  message: '❌ Erreur lors du chargement de la réunion',
                  variant: 'danger',
                });
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
                await showAlert({
                  title: 'Réunion introuvable',
                  message: '❌ Réunion introuvable',
                  variant: 'warning',
                });
              }
            } catch (error: any) {
              console.error('❌ Erreur:', error);
              await showAlert({
                title: 'Erreur de chargement',
                message: '❌ Erreur lors du chargement de la réunion',
                variant: 'danger',
              });
            }
          }}
        />
      )}

      {/* Modal de traitement pendant la génération du résumé */}
      <ProcessingModal
        isOpen={isProcessing}
        status={processingStatus || 'Traitement en cours...'}
      />

      {result && result.title && (result.summaryDetailed || result.summaryShort || result.summaryFailed) && (
        <>
          {console.log('🎯 Rendu MeetingResult:', { title: result.title, hasDetailed: !!result.summaryDetailed, hasShort: !!result.summaryShort, summaryFailed: result.summaryFailed })}
        <div className="fixed inset-0 z-[100]">
          <MeetingResult
            title={result.title}
            transcript={result.transcript}
            summaryDetailed={result.summaryDetailed}
            summaryShort={result.summaryShort}
            defaultSummaryMode={result.summaryMode}
            suggestions={suggestions}
            userId={user?.id || ''}
            meetingId={result.meetingId}
            summaryFailed={result.summaryFailed}
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

              // Utiliser la méthode sélectionnée dans le composeur (pas les settings)
              const selectedMethod = emailData.method === 'app' ? 'local' : emailData.method;
              console.log('🔍 Méthode sélectionnée dans EmailComposer:', emailData.method, '→', selectedMethod);

              // 🎯 NOUVELLE APPROCHE: Envoi individuel pour tracking précis
              const { sendIndividualEmails } = await import('./services/individualEmailSender');

              const result = await sendIndividualEmails(
                emailData,
                selectedMethod as 'smtp' | 'gmail' | 'local',
                meetingToEmail?.id,
                user.id
              );

              if (!result.success && result.failed.length > 0) {
                throw new Error(`Échec d'envoi pour : ${result.failed.join(', ')}`);
              }

              setEmailSuccessData({ recipientCount: result.totalSent, method: emailData.method === 'app' ? 'local' : emailData.method });
              setShowEmailSuccessModal(true);
              setMeetingToEmail(null);
              setEmailBody('');
              
              console.log(`✅ ${result.totalSent} emails envoyés individuellement pour tracking précis`);
              return;

              /* CODE ANCIEN - REMPLACÉ PAR sendIndividualEmails()
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
              FIN CODE ANCIEN COMMENTÉ */
            } catch (error: any) {
              console.error('❌ Erreur envoi email:', error);
              await showAlert({
                title: 'Erreur d\'envoi',
                message: `❌ Erreur lors de l'envoi: ${error.message}`,
                variant: 'danger',
              });
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

      <SummaryPreferenceModal
        isOpen={showSummaryPreferenceModal}
        recommendedMode={recommendedSummaryMode}
        estimatedWordCount={summaryWordEstimate}
        recordingDuration={recordingTime}
        showDefaultReminder={showDefaultModeReminder}
        onSetDefaultMode={handleSetDefaultModeFromModal}
        onSelect={handleSummaryPreferenceSelect}
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

      {/* Modal de sélection d'abonnement */}
      {showSubscriptionModal && (
        <SubscriptionSelection
          onClose={async () => {
            await checkSubscription(user.id);
            if (subscription && subscription.is_active) {
              setShowSubscriptionModal(false);
            }
          }}
          currentPlan={subscription?.plan_type}
          upgradeOnly={subscriptionUpgradeOnly}
          canClose={!!(subscription && subscription.is_active)}
        />
      )}
    </div>
  );
}

export default App;
