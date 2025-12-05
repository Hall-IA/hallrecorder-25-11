import { applyDictionaryCorrections } from './dictionaryCorrection';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TRANSCRIBE_URL = import.meta.env.VITE_TRANSCRIBE_URL;
const TRANSCRIBE_LONG_URL = import.meta.env.VITE_TRANSCRIBE_LONG_URL;

export type SummaryMode = 'short' | 'detailed';

export const transcribeAudio = async (audioBlob: Blob, retryCount = 0, filename?: string): Promise<string> => {
  const formData = new FormData();
  const ext = audioBlob.type.includes('wav') ? 'wav' : audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3') ? 'mp3' : 'm4a';
  const name = filename || `segment.${ext}`;
  formData.append('audio', audioBlob, name);

  try {
    // Choisir la cible: FastAPI si disponible, sinon Supabase Edge
    const isFastAPI = typeof TRANSCRIBE_URL === 'string' && TRANSCRIBE_URL.length > 0;
    const endpoint = isFastAPI ? TRANSCRIBE_URL : `${SUPABASE_URL}/functions/v1/test-transcribe`;
    const headers: Record<string,string> = {};
    if (!isFastAPI) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    console.log('[API Transcription] 📤 Envoi vers:', {
      endpoint,
      isFastAPI,
      fileName: name,
      audioSize: `${(audioBlob.size / 1024).toFixed(1)} KB`,
      audioType: audioBlob.type,
      retryCount
    });

    const startTime = Date.now();
    const response = await fetch(endpoint, { method: 'POST', headers, body: formData });
    const duration = Date.now() - startTime;

    console.log('[API Transcription] 📥 Réponse reçue:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      duration: `${duration}ms`,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[API Transcription] ❌ Erreur HTTP:', {
        status: response.status,
        error
      });

      // Si erreur 429 (rate limit) et qu'on n'a pas encore fait 3 tentatives
      if (response.status === 429 && retryCount < 3) {
        const delays = [2000, 4000, 8000]; // 2s, 4s, 8s
        const delay = delays[retryCount];
        console.warn(`[API Transcription] ⏳ Rate limit, retry ${retryCount + 1}/3 dans ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return transcribeAudio(audioBlob, retryCount + 1);
      }

      // Message spécifique pour erreur 429 finale
      if (response.status === 429) {
        throw new Error('Limite API atteinte. Réessayez dans 1 minute.');
      }

      throw new Error(error.error || `Transcription failed (${response.status})`);
    }

    const data = await response.json();
    console.log('[API Transcription] ✅ Transcription réussie:', {
      transcript: data.transcript,
      transcriptLength: data.transcript?.length || 0,
      duration: `${duration}ms`,
      fullResponse: data
    });

    // FastAPI renvoie { transcript: ... }, Edge aussi → compatible
    return data.transcript;
  } catch (error) {
    console.error('[API Transcription] ❌ Exception:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      retryCount
    });

    if (retryCount < 3 && error instanceof Error && error.message.includes('429')) {
      const delays = [2000, 4000, 8000];
      const delay = delays[retryCount];
      console.warn(`[API Transcription] ⏳ Exception 429, retry ${retryCount + 1}/3 dans ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return transcribeAudio(audioBlob, retryCount + 1);
    }
    throw error;
  }
};

export const transcribeLongAudio = async (
  audioFile: File,
  onProgress?: (message: string) => void
): Promise<{ transcript: string; duration_seconds?: number }> => {
  const baseUrl = TRANSCRIBE_LONG_URL || TRANSCRIBE_URL?.replace('/transcribe', '/transcribe_long');

  if (!baseUrl) {
    console.error('[API Transcription Longue] ❌ URL non configurée');
    throw new Error('URL de transcription non configurée');
  }

  const formData = new FormData();
  formData.append('audio', audioFile, audioFile.name);

  console.log('[API Transcription Longue] 📤 Envoi fichier:', {
    url: baseUrl,
    fileName: audioFile.name,
    fileSize: `${(audioFile.size / 1024 / 1024).toFixed(2)} MB`,
    fileType: audioFile.type
  });

  try {
    if (onProgress) {
      onProgress('Envoi du fichier au serveur...');
    }

    const startTime = Date.now();
    const response = await fetch(baseUrl, {
      method: 'POST',
      body: formData,
    });
    const duration = Date.now() - startTime;

    console.log('[API Transcription Longue] 📥 Réponse reçue:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      duration: `${duration}ms`
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[API Transcription Longue] ❌ Erreur HTTP:', {
        status: response.status,
        error
      });
      throw new Error(error.detail || `Transcription failed (${response.status})`);
    }

    if (onProgress) {
      onProgress('Traitement et transcription en cours...');
    }

    const data = await response.json();

    console.log('[API Transcription Longue] ✅ Transcription réussie:', {
      transcriptLength: data.transcript?.length || 0,
      segmentsCount: data.segments_count,
      durationSeconds: data.duration_seconds,
      totalDuration: `${duration}ms`,
      fullResponse: data
    });

    if (onProgress) {
      onProgress(`Transcription terminée (${data.segments_count} segments traités)`);
    }

    return {
      transcript: data.transcript || '',
      duration_seconds: data.duration_seconds
    };
  } catch (error) {
    console.error('[API Transcription Longue] ❌ Exception:', {
      error,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

export const generateSummary = async (
  transcript: string,
  userId?: string,
  retryCount = 0,
  summaryMode: SummaryMode = 'detailed'
): Promise<{ title: string; summary: string }> => {
  console.log('🔄 generateSummary appelé - Transcript length:', transcript.length, 'Retry:', retryCount, 'Mode:', summaryMode);

  try {
    // Appliquer les corrections du dictionnaire à la transcription AVANT de générer le résumé
    let correctedTranscript = transcript;
    if (userId) {
      try {
        correctedTranscript = await applyDictionaryCorrections(transcript, userId);
        if (correctedTranscript !== transcript) {
          console.log('📚 Dictionnaire appliqué à la transcription');
        }
      } catch (dictError) {
        console.warn('⚠️ Erreur dictionnaire (transcription):', dictError);
        // Continuer avec la transcription originale
      }
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-summary`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: correctedTranscript, userId, summaryMode }),
      }
    );

    console.log('📊 generateSummary response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ generateSummary error:', error);
      
      // Si erreur 429 (rate limit) et qu'on n'a pas encore fait 3 tentatives
      if (response.status === 429 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // Délai exponentiel: 1s, 2s, 4s
        console.log(`⏳ Rate limit détecté, retry dans ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return generateSummary(transcript, userId, retryCount + 1, summaryMode);
      }
      
      throw new Error(error.error || `Summary generation failed (${response.status})`);
    }

    const data = await response.json();
    
    // Appliquer les corrections du dictionnaire au résumé ET au titre générés
    let correctedTitle = data.title || '';
    let correctedSummary = data.summary || '';
    
    if (userId) {
      try {
        const [titleCorrected, summaryCorrected] = await Promise.all([
          applyDictionaryCorrections(correctedTitle, userId),
          applyDictionaryCorrections(correctedSummary, userId)
        ]);
        
        if (titleCorrected !== correctedTitle || summaryCorrected !== correctedSummary) {
          console.log('📚 Dictionnaire appliqué au résumé généré');
        }
        
        correctedTitle = titleCorrected;
        correctedSummary = summaryCorrected;
      } catch (dictError) {
        console.warn('⚠️ Erreur dictionnaire (résumé):', dictError);
        // Continuer avec le résumé original
      }
    }
    
    console.log('✅ generateSummary success:', { title: correctedTitle, summaryLength: correctedSummary?.length });
    return { title: correctedTitle, summary: correctedSummary };
  } catch (error) {
    console.error('❌ generateSummary exception:', error);
    if (retryCount < 3 && error instanceof Error && error.message.includes('429')) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`⏳ Retry dans ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return generateSummary(transcript, userId, retryCount + 1, summaryMode);
    }
    throw error;
  }
};
