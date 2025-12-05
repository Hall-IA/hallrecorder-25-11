import { useState, useEffect, useRef } from 'react';

export const useLiveTranscription = (isRecording: boolean, isPaused: boolean) => {
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('[Transcription] API de reconnaissance vocale non disponible');
      return;
    }

    console.log('[Transcription] Initialisation de la reconnaissance vocale');
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';

    recognition.onstart = () => {
      console.log('[Transcription] ✅ Reconnaissance vocale démarrée');
    };

    recognition.onresult = (event: any) => {
      console.log('[Transcription] 📝 Résultat reçu:', event);

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        const isFinal = event.results[i].isFinal;

        console.log(`[Transcription] Segment ${i}:`, {
          texte: transcriptPiece,
          final: isFinal,
          confiance: confidence,
        });

        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      if (finalTranscript) {
        console.log('[Transcription] ✅ Texte final:', finalTranscript);
      }
      if (interimTranscript) {
        console.log('[Transcription] ⏳ Texte interim:', interimTranscript);
      }

      setTranscript((prev) => {
        if (finalTranscript) {
          return prev + finalTranscript;
        }
        const lastFinalIndex = prev.lastIndexOf(' ');
        return prev.substring(0, lastFinalIndex + 1) + interimTranscript;
      });
    };

    recognition.onerror = (event: any) => {
      console.error('[Transcription] ❌ Erreur:', {
        type: event.error,
        message: event.message,
        event: event,
      });

      if (event.error === 'no-speech') {
        console.warn('[Transcription] Aucune parole détectée');
        return;
      }
    };

    recognition.onend = () => {
      console.log('[Transcription] ⏹️ Reconnaissance vocale arrêtée', {
        isRecording,
        isPaused,
        willRestart: isRecording && !isPaused,
      });

      if (isRecording && !isPaused) {
        try {
          console.log('[Transcription] 🔄 Redémarrage de la reconnaissance...');
          recognition.start();
        } catch (error) {
          console.error('[Transcription] ❌ Erreur lors du redémarrage:', error);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      console.log('[Transcription] 🧹 Nettoyage du composant - arrêt de la reconnaissance');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('[Transcription] ❌ Erreur lors du nettoyage:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) {
      console.warn('[Transcription] recognitionRef.current est null');
      return;
    }

    if (isRecording && !isPaused) {
      try {
        console.log('[Transcription] 🎙️ Démarrage de la reconnaissance (isRecording && !isPaused)');
        recognitionRef.current.start();
      } catch (error) {
        console.error('[Transcription] ❌ Erreur lors du démarrage:', error);
      }
    } else {
      try {
        console.log('[Transcription] ⏸️ Arrêt de la reconnaissance', {
          isRecording,
          isPaused,
        });
        recognitionRef.current.stop();
      } catch (error) {
        console.error('[Transcription] ❌ Erreur lors de l\'arrêt:', error);
      }
    }
  }, [isRecording, isPaused]);

  const resetTranscript = () => {
    console.log('[Transcription] 🔄 Réinitialisation de la transcription');
    setTranscript('');
  };

  return { transcript, resetTranscript };
};
