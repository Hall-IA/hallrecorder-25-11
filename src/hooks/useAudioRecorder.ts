import { useState, useRef, useCallback, useEffect } from 'react';
import { buildWavFromFloat } from '../services/audioEncoding';
import { useDialog } from '../context/DialogContext';

const isUserMediaCancel = (error: unknown) => {
  if (!error) return false;

  const domError = error as DOMException & { message?: string };
  const name = typeof domError?.name === 'string' ? domError.name : '';
  if (name === 'NotAllowedError' || name === 'AbortError' || name === 'SecurityError') {
    return true;
  }

  const message = typeof domError?.message === 'string' ? domError.message : '';
  if (!message) return false;

  const normalized = message.toLowerCase();
  return normalized.includes('permission denied') || normalized.includes('denied permission') || normalized.includes('user cancelled') || normalized.includes('user canceled');
};

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingMode, setRecordingMode] = useState<'microphone' | 'system' | 'visio'>('microphone');
  const [partialAudioChunks, setPartialAudioChunks] = useState<Blob[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const partialChunksRef = useRef<Blob[]>([]);
  const segmentQueueRef = useRef<Blob[]>([]); // File FIFO de segments MediaRecorder valides
  const lastPartialIndexRef = useRef<number>(0); // Index du dernier chunk traité
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  // WebAudio pipeline pour capture continue
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sampleRateRef = useRef<number>(16000);
  const ringBuffersRef = useRef<Float32Array[]>([]); // accumulation de frames mono
  const { showAlert } = useDialog();
  const alertRef = useRef(showAlert);

  useEffect(() => {
    alertRef.current = showAlert;
  }, [showAlert]);

  const startRecording = useCallback(async (mode: 'microphone' | 'system' | 'visio' = 'microphone') => {
    try {
      let combinedStream: MediaStream;
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
      
      // Détecter si on est sur mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('📱 Appareil mobile détecté:', isMobile);

      if (mode === 'microphone') {
        // Mode microphone uniquement (comportement actuel - peut bloquer Discord/Zoom)
        combinedStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000
          }
        });
      } else if (mode === 'visio') {
        // Mode Visio: capturer simultanément microphone + audio système
        
        if (isMobile) {
          // 🚨 SUR MOBILE: getDisplayMedia n'est pas supporté
          // Solution: utiliser le microphone avec des paramètres optimisés pour capturer
          // l'audio du haut-parleur (la réunion Teams/Meet/WhatsApp)
          console.log('📱 Mode visio sur mobile: utilisation du microphone optimisé');
          console.log('💡 Conseil: Activez le haut-parleur de votre téléphone pendant la réunion');
          
          combinedStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // Désactiver echo cancellation pour mieux capter l'audio du haut-parleur
              echoCancellation: false,
              // Désactiver noise suppression pour ne pas filtrer l'audio de la réunion
              noiseSuppression: false,
              // Activer auto gain pour amplifier l'audio capté
              autoGainControl: true,
              channelCount: 1,
              sampleRate: 48000
            }
          });
          
          // Afficher un message à l'utilisateur
          if (typeof window !== 'undefined' && (window as any).showMobileVisioTip) {
            (window as any).showMobileVisioTip();
          }
          
        } else {
          // 💻 SUR DESKTOP: Mixer microphone + audio système
          try {
            // 1. Capturer l'audio système (écran/onglet)
            let systemStream: MediaStream;
            try {
              // @ts-ignore - getDisplayMedia existe mais TypeScript ne le connaît pas toujours
              systemStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                // @ts-ignore - systemAudio est supporté sur Chromium
                audio: { 
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                  systemAudio: 'include' as any 
                }
              } as any);
            } catch (initialError) {
              if (isUserMediaCancel(initialError)) {
                throw initialError;
              }
              try {
                // Fallback: simple booléen (Firefox/anciennes versions)
                // @ts-ignore
                systemStream = await navigator.mediaDevices.getDisplayMedia({
                  video: { cursor: 'always' },
                  audio: true
                });
              } catch (fallbackError) {
                if (isUserMediaCancel(fallbackError)) {
                  throw fallbackError;
                }
                throw fallbackError;
              }
            }
            
            // Couper la piste vidéo immédiatement
            systemStream.getVideoTracks().forEach(track => track.stop());
            
            // 2. Capturer le microphone
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000
              }
            });
            
            // 3. Mixer les deux streams audio
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // Créer un gain node pour mixer
            const mixer = audioContext.createGain();
            mixer.gain.value = 1.0;
            
            // Connecter les deux sources au mixer
            const systemSource = audioContext.createMediaStreamSource(systemStream);
            const micSource = audioContext.createMediaStreamSource(micStream);
            
            systemSource.connect(mixer);
            micSource.connect(mixer);
            
            // Créer un stream de destination pour l'enregistrement
            const destination = audioContext.createMediaStreamDestination();
            mixer.connect(destination);
            
            combinedStream = destination.stream;
            
            // Stocker les streams pour cleanup
            streamRef.current = systemStream;
            
          } catch (error) {
            console.error('Erreur mode visio desktop:', error);
            if (isUserMediaCancel(error)) {
              throw error;
            }
            // Fallback: microphone uniquement
            combinedStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000
              }
            });
          }
        }
      } else if (mode === 'system') {
        // Mode audio système uniquement (capture l'onglet ou l'écran avec audio)
        try {
          // @ts-ignore - getDisplayMedia existe mais TypeScript ne le connaît pas toujours
          combinedStream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (error) {
          if (isUserMediaCancel(error)) {
            throw error;
          }
          throw error;
        }
      } else {
        // Mode par défaut: microphone uniquement
        combinedStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000
          }
        });
      }

      // Sécurité: ne pas continuer si aucune piste audio
      if (!combinedStream || combinedStream.getAudioTracks().length === 0) {
        throw new Error('NO_AUDIO_TRACKS');
      }
      // Choisir un mimeType supporté pour des segments autonomes
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg'
      ];
      let selectedType: string | undefined;
      for (const t of preferredTypes) {
        // @ts-ignore
        if ((window as any).MediaRecorder && (window as any).MediaRecorder.isTypeSupported && (window as any).MediaRecorder.isTypeSupported(t)) {
          selectedType = t; break;
        }
      }
      const options: MediaRecorderOptions = selectedType ? { mimeType: selectedType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 };
      const mediaRecorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // IMPORTANT: Réinitialiser TOUS les buffers au démarrage pour éviter les mélanges avec d'anciens enregistrements
      chunksRef.current = [];
      partialChunksRef.current = [];
      segmentQueueRef.current = [];
      lastPartialIndexRef.current = 0;
      ringBuffersRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Chaque event.data est un segment WEBM autonome (avec headers)
          chunksRef.current.push(event.data);
          partialChunksRef.current.push(event.data);
          segmentQueueRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Arrêter tous les flux
        combinedStream.getTracks().forEach(track => track.stop());
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      // Mettre à jour l'état immédiatement
      
      recordingStartedRef.current = true;
      setIsRecording(true);
      setRecordingMode(mode);
      setAudioStream(combinedStream);
      startTimeRef.current = Date.now();
      
      
      // Forcer un re-render en utilisant une fonction de callback
      setTimeout(() => {
        
        setIsRecording(prev => {
          
          return true;
        });
      }, 100);

      // WebAudio: capturer en continu en Float32 pour extraire des fenêtres glissantes
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ac: AudioContext = new AC();
      audioContextRef.current = ac;
      sampleRateRef.current = ac.sampleRate;
      const src = ac.createMediaStreamSource(combinedStream);
      sourceNodeRef.current = src;
      const sp = ac.createScriptProcessor(4096, 1, 1);
      processorRef.current = sp;
      src.connect(sp);
      sp.connect(ac.destination);
      sp.onaudioprocess = (e: AudioProcessingEvent) => {
        const mono = e.inputBuffer.getChannelData(0);
        ringBuffersRef.current.push(new Float32Array(mono));
        // Prune mémoire: garder ~10 minutes max
        const sr = sampleRateRef.current;
        let total = 0;
        for (let i = ringBuffersRef.current.length - 1; i >= 0 && total < sr * 600; i--) {
          total += ringBuffersRef.current[i].length;
        }
        // si plus que 10 min, retirer ancien début
        while (ringBuffersRef.current.length > 0 && total > sr * 600) {
          const first = ringBuffersRef.current.shift();
          if (first) total -= first.length;
        }
      };

      // MediaRecorder pour l'archive finale uniquement
      mediaRecorder.start();

      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        setRecordingTime(elapsed);

        // Arrêter automatiquement après 4h (14400 secondes)
        if (elapsed >= 14400) {
          stopRecording();
          alertRef.current?.({
            title: 'Limite atteinte',
            message: 'Enregistrement automatiquement arrêté après 4 heures (limite maximale)',
            variant: 'warning',
          });
        }
      }, 1000);
    } catch (error) {
      throw error;
    }
  }, []);

  const pauseRecording = useCallback(() => {
    console.log('⏸️ pauseRecording appelé', {
      hasMediaRecorder: !!mediaRecorderRef.current,
      isRecording,
      isPaused
    });
    
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      console.log('✅ Mise en pause de l\'enregistrement confirmée');
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      console.log('✅ État isPaused devrait maintenant être true');
    } else {
      console.warn('⚠️ Conditions non remplies pour pause:', {
        hasMediaRecorder: !!mediaRecorderRef.current,
        isRecording,
        isPaused
      });
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      const pauseDuration = Date.now() - (startTimeRef.current + recordingTime * 1000);
      pausedTimeRef.current += pauseDuration;

      mediaRecorderRef.current.resume();
      setIsPaused(false);

      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        setRecordingTime(elapsed);

        // Arrêter automatiquement après 4h (14400 secondes)
        if (elapsed >= 14400) {
          stopRecording();
          alertRef.current?.({
            title: 'Limite atteinte',
            message: 'Enregistrement automatiquement arrêté après 4 heures (limite maximale)',
            variant: 'warning',
          });
        }
      }, 1000);
    }
  }, [isRecording, isPaused, recordingTime]);

  const stopRecording = useCallback(() => {
    console.log('🛑 stopRecording appelé', {
      hasMediaRecorder: !!mediaRecorderRef.current,
      isRecording,
      recordingStarted: recordingStartedRef.current
    });
    
    if (mediaRecorderRef.current && isRecording && recordingStartedRef.current) {
      console.log('✅ Arrêt de l\'enregistrement...');
      
      // Demander un flush immédiat du dernier chunk avant d'arrêter
      try {
        mediaRecorderRef.current.requestData();
      } catch (_e) {}
      mediaRecorderRef.current.stop();
      recordingStartedRef.current = false;
      setIsRecording(false);
      setIsPaused(false);
      setAudioStream(null);

      if (timerRef.current) {
        console.log('⏹️ Arrêt du timer d\'enregistrement');
        clearInterval(timerRef.current);
        timerRef.current = null;
      } else {
        console.warn('⚠️ Timer déjà arrêté ou non initialisé');
      }
      // Cleanup WebAudio
      try { processorRef.current?.disconnect(); } catch {}
      try { sourceNodeRef.current?.disconnect(); } catch {}
      try { audioContextRef.current?.close(); } catch {}
      processorRef.current = null;
      sourceNodeRef.current = null;
      audioContextRef.current = null;
      
      console.log('✅ Enregistrement arrêté avec succès');
    } else {
      console.warn('⚠️ stopRecording: conditions non remplies', {
        hasMediaRecorder: !!mediaRecorderRef.current,
        isRecording,
        recordingStarted: recordingStartedRef.current
      });
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    
    setRecordingTime(0);
    setAudioBlob(null);
    chunksRef.current = [];
    partialChunksRef.current = [];
    lastPartialIndexRef.current = 0; // Reset l'index
    pausedTimeRef.current = 0;
    setPartialAudioChunks([]);
    recordingStartedRef.current = false;
  }, []);

  const getPartialAudio = useCallback(() => {
    // Retourner TOUS les chunks accumulés depuis le dernier traitement réussi
    // (pas seulement les nouveaux, car on a besoin d'un fichier WebM valide avec headers)
    const chunksToProcess = partialChunksRef.current.slice(lastPartialIndexRef.current);
    
    if (chunksToProcess.length === 0) {
      return null;
    }
    
    // Créer un blob avec TOUS les chunks depuis le début pour avoir un fichier valide
    const blob = new Blob(partialChunksRef.current, { type: 'audio/webm' });
    
    return blob;
  }, []);

  // Extrait les 15 dernières secondes et renvoie un WAV 16k mono prêt à envoyer
  const getLast15sWav = useCallback(async (): Promise<Blob | null> => {
    const sr = sampleRateRef.current;
    const targetSamples = Math.floor(15 * sr);
    // concaténer depuis la fin
    if (ringBuffersRef.current.length === 0) return null;
    let needed = targetSamples;
    const chunks: Float32Array[] = [];
    for (let i = ringBuffersRef.current.length - 1; i >= 0 && needed > 0; i--) {
      const buf = ringBuffersRef.current[i];
      if (buf.length <= needed) {
        chunks.unshift(buf);
        needed -= buf.length;
      } else {
        // prendre la fin du buffer
        chunks.unshift(buf.subarray(buf.length - needed));
        needed = 0;
      }
    }
    if (chunks.length === 0) return null;
    let total = 0; for (const c of chunks) total += c.length;
    const merged = new Float32Array(total);
    let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
    return await buildWavFromFloat(merged, sr);
  }, []);
  
  // Récupère le prochain segment autonome prêt à la transcription (FIFO)
  const getNextSegmentAudio = useCallback(() => {
    if (segmentQueueRef.current.length === 0) return null;
    const blob = segmentQueueRef.current.shift() || null;
    return blob ?? null;
  }, []);
  
  const markPartialAsProcessed = useCallback(() => {
    // Marquer les chunks actuels comme traités
    lastPartialIndexRef.current = partialChunksRef.current.length;
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    recordingMode,
    partialAudioChunks,
    audioStream,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    setRecordingMode,
    getPartialAudio,
    getNextSegmentAudio,
    getLast15sWav,
    markPartialAsProcessed,
  };
};
