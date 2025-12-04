import { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, X, Loader } from 'lucide-react';
import { transcribeLongAudio, generateSummary } from '../services/transcription';
import { supabase } from '../lib/supabase';
import { useBackgroundProcessing } from '../hooks/useBackgroundProcessing';
import { UploadQuotaErrorModal } from './UploadQuotaErrorModal';
import { QuotaFullModal } from './QuotaFullModal';
import { LowQuotaUploadWarningModal } from './LowQuotaUploadWarningModal';
import { useDialog } from '../context/DialogContext';

interface AudioUploadProps {
  userId: string;
  onSuccess: (meetingId?: string) => void;
}

export const AudioUpload = ({ userId, onSuccess }: AudioUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [isCalculatingDuration, setIsCalculatingDuration] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showQuotaFullModal, setShowQuotaFullModal] = useState(false);
  const [showUploadQuotaError, setShowUploadQuotaError] = useState(false);
  const [uploadQuotaErrorData, setUploadQuotaErrorData] = useState({ audioDuration: 0, remainingMinutes: 0 });
  const [showLowQuotaUploadWarning, setShowLowQuotaUploadWarning] = useState(false);
  const [lowQuotaUploadData, setLowQuotaUploadData] = useState({ uploadMinutes: 0, remainingAfter: 0 });
  const { showAlert } = useDialog();

  const { addTask, updateTask } = useBackgroundProcessing(userId);

  // Avertissement avant de quitter/rafraîchir la page pendant le traitement d'un upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Vérifier si un traitement d'upload est en cours
      if (isProcessing) {
        e.preventDefault();
        // Message de confirmation (le navigateur affichera son propre message)
        const message = 'Un traitement d\'upload est en cours. Si vous quittez maintenant, vous perdrez votre progression. Voulez-vous vraiment quitter ?';
        e.returnValue = message; // Chrome/Edge
        return message; // Firefox/Safari
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isProcessing]);

  // Fonction pour extraire la durée d'un fichier audio (avec plusieurs tentatives)
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      // Méthode 1: Via l'élément Audio HTML
      const tryAudioElement = () => {
        const audio = new Audio();
        audio.preload = 'metadata';

        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            console.warn('⚠️ Timeout méthode Audio, tentative via Web Audio API...');
            resolved = true;
            window.URL.revokeObjectURL(audio.src);
            tryWebAudioAPI();
          }
        }, 8000); // 8 secondes pour laisser plus de temps

        audio.onloadedmetadata = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            const duration = Math.floor(audio.duration);
            console.log('✅ Durée extraite (Audio):', duration, 'secondes');
            window.URL.revokeObjectURL(audio.src);

            if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
              console.warn('⚠️ Durée invalide, tentative via Web Audio API...');
              tryWebAudioAPI();
            } else {
              resolve(duration);
            }
          }
        };

        audio.onerror = (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            console.error('❌ Erreur Audio, tentative via Web Audio API...');
            window.URL.revokeObjectURL(audio.src);
            tryWebAudioAPI();
          }
        };

        try {
          audio.src = window.URL.createObjectURL(file);
          audio.load();
        } catch (error) {
          console.error('❌ Erreur création URL, tentative via Web Audio API...');
          resolved = true;
          clearTimeout(timeoutId);
          tryWebAudioAPI();
        }
      };

      // Méthode 2: Via Web Audio API (plus fiable pour certains formats)
      const tryWebAudioAPI = async () => {
        try {
          console.log('🔄 Tentative extraction durée via Web Audio API...');
          const arrayBuffer = await file.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const duration = Math.floor(audioBuffer.duration);
          
          console.log('✅ Durée extraite (Web Audio API):', duration, 'secondes');
          audioContext.close();

          if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
            console.warn('⚠️ Durée invalide via Web Audio API aussi');
            estimateFromFileSize();
          } else {
            resolve(duration);
          }
        } catch (error) {
          console.error('❌ Erreur Web Audio API:', error);
          estimateFromFileSize();
        }
      };

      // Méthode 3: Estimation approximative basée sur la taille du fichier
      const estimateFromFileSize = () => {
        // Estimation très approximative: ~1MB ≈ 60 secondes pour MP3 128kbps
        const fileSizeMB = file.size / (1024 * 1024);
        const estimatedMinutes = Math.ceil(fileSizeMB * 1.0); // 1 minute par MB (conservateur)
        const estimatedSeconds = estimatedMinutes * 60;
        
        console.warn(`⚠️ Estimation durée basée sur taille: ${estimatedSeconds}s (${fileSizeMB.toFixed(2)} MB)`);
        resolve(estimatedSeconds);
      };

      // Commencer par la méthode 1
      tryAudioElement();
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Vérifier que c'est un fichier audio ou vidéo (webm peut être video/webm)
      const validTypes = ['audio/', 'video/webm', 'video/mp4', 'video/ogg'];
      const isValid = validTypes.some(type => file.type.startsWith(type)) ||
                      file.name.match(/\.(mp3|wav|m4a|webm|ogg|flac|aac|wma)$/i);

      if (!isValid) {
        await showAlert({
          title: 'Fichier non supporté',
          message: 'Veuillez sélectionner un fichier audio valide (MP3, WAV, M4A, WebM, etc.).',
          variant: 'warning',
        });
        return;
      }
      setSelectedFile(file);
      setAudioDuration(0); // Reset

      // Extraire la durée avec indicateur de chargement
      setIsCalculatingDuration(true);
      console.log('⏳ Calcul de la durée en cours...');
      try {
        const duration = await getAudioDuration(file);
        setAudioDuration(duration);
        console.log('✅ Durée audio détectée:', duration, 'secondes');
      } catch (error) {
        console.error('❌ Erreur lors du calcul de la durée:', error);
        setAudioDuration(0);
      } finally {
        setIsCalculatingDuration(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Si la durée n'a pas été détectée, réessayer une dernière fois
    let finalDuration = audioDuration;
    if (finalDuration === 0) {
      console.log('⚠️ Durée non détectée, nouvelle tentative...');
      setIsCalculatingDuration(true);
      try {
        finalDuration = await getAudioDuration(selectedFile);
        setAudioDuration(finalDuration);
      } finally {
        setIsCalculatingDuration(false);
      }
    }

    // Si toujours pas de durée, bloquer pour le plan Starter
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan_type, minutes_quota, minutes_used_this_month')
      .eq('user_id', userId)
      .maybeSingle();

    if (subscription && subscription.plan_type === 'starter') {
      // Si pas de durée détectée, bloquer pour éviter les abus
      if (finalDuration === 0) {
        await showAlert({
          title: 'Durée inconnue',
          message: '❌ Impossible de détecter la durée du fichier audio.\n\nPour protéger votre quota, nous ne pouvons pas traiter ce fichier. Veuillez essayer avec un autre format (MP3, WAV, M4A recommandés) ou contacter le support.',
          variant: 'warning',
        });
        return;
      }

      const audioMinutes = Math.ceil(finalDuration / 60);
      const remainingMinutes = subscription.minutes_quota - subscription.minutes_used_this_month;

      // Vérifier si l'utilisateur a dépassé le quota
      if (subscription.minutes_used_this_month >= subscription.minutes_quota) {
        setShowQuotaFullModal(true);
        return;
      }

      // Vérifier si l'upload dépasserait le quota
      if (audioMinutes > remainingMinutes) {
        setUploadQuotaErrorData({ audioDuration: audioMinutes, remainingMinutes });
        setShowUploadQuotaError(true);
        return;
      }

      // Avertir si proche du quota après upload
      const usageAfterUpload = subscription.minutes_used_this_month + audioMinutes;
      const usagePercent = (usageAfterUpload / subscription.minutes_quota) * 100;
      if (usagePercent > 90) {
        const remainingAfter = subscription.minutes_quota - usageAfterUpload;
        console.log('🟠 Quota proche après upload (>90%), affichage du modal LowQuotaUploadWarning');
        setLowQuotaUploadData({ uploadMinutes: audioMinutes, remainingAfter });
        setShowLowQuotaUploadWarning(true);
        return;
      }
    }

    // Commencer le traitement (peut être appelé après confirmation du modal)
    proceedWithUpload();
  };

  // Fonction pour procéder à l'upload (appelée après vérifications ou confirmation modal)
  const proceedWithUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    const taskId = await addTask({
      type: 'upload_transcription',
      status: 'processing',
      progress: 'Démarrage du traitement...',
    });

    if (!taskId) {
      await showAlert({
        title: 'Erreur de traitement',
        message: 'Erreur lors de la création de la tâche',
        variant: 'danger',
      });
      setIsProcessing(false);
      return;
    }

    try {
      // 1) Transcrire D'ABORD (avant de créer la réunion)
      const transcribeProgress = 'Envoi au serveur de transcription...';
      setProgress(transcribeProgress);
      await updateTask(taskId, { progress: transcribeProgress, progress_percent: 20 });
      
      console.log('📤 Transcription de l\'audio AVANT création de la réunion');
      const transcriptionResult = await transcribeLongAudio(selectedFile, async (msg) => {
        setProgress(msg);
        await updateTask(taskId, { progress: msg, progress_percent: 60 });
      });

      const fullTranscript = transcriptionResult.transcript;
      const actualDuration = Math.round(transcriptionResult.duration_seconds || audioDuration);
      
      console.log('✅ Transcription réussie, durée:', actualDuration, 'secondes');

      // 2) Générer le résumé
      const summaryProgress = 'Génération des résumés court et détaillé...';
      setProgress(summaryProgress);
      await updateTask(taskId, { progress: summaryProgress, progress_percent: 80 });
      const [detailedResult, shortResult] = await Promise.all([
        generateSummary(fullTranscript, userId, 0, 'detailed'),
        generateSummary(fullTranscript, userId, 0, 'short'),
      ]);

      // 3) Créer la réunion UNIQUEMENT si transcription + résumé ont réussi
      const createProgress = 'Enregistrement de la réunion...';
      setProgress(createProgress);
      await updateTask(taskId, { progress: createProgress, progress_percent: 90 });
      
      const detailedSummary = detailedResult.summary || '';
      const shortSummary = shortResult.summary || '';
      const finalTitle =
        meetingTitle ||
        detailedResult.title ||
        shortResult.title ||
        `Upload du ${new Date().toLocaleDateString('fr-FR')}`;
      console.log('💾 Création de la réunion avec toutes les données (quota sera débité maintenant)');

      const { data: meeting, error: createError } = await supabase
        .from('meetings')
        .insert({
          title: finalTitle,
          transcript: fullTranscript,
          summary: detailedSummary,
          summary_detailed: detailedSummary,
          summary_short: shortSummary,
          summary_mode: 'detailed',
          summary_regenerated: false,
          duration: actualDuration,
          user_id: userId,
          notes: notes || null,
          suggestions: [],
          audio_url: null,
        })
        .select()
        .maybeSingle();

      if (createError || !meeting) {
        console.error('❌ Erreur création réunion:', createError);
        throw new Error('Erreur lors de la création de la réunion');
      }

      console.log('✅ Réunion créée avec succès, ID:', meeting.id, '(quota débité)');

      setProgress('Terminé !');

      // Reset UI immediately
      setSelectedFile(null);
      setMeetingTitle('');
      setNotes('');
      setAudioDuration(0);
      setIsCalculatingDuration(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Mark task as completed - this will trigger the notification
      console.log('✅ Marquage de la tâche comme terminée avec meeting_id:', meeting.id);
      setTimeout(async () => {
        await updateTask(taskId, {
          status: 'completed',
          progress: 'Transcription terminée',
          meeting_id: meeting.id,
          progress_percent: 100
        });
      }, 100);

      // Appeler onSuccess pour rafraîchir la liste des réunions (sans navigation automatique)
      console.log('🔄 Appel de onSuccess pour rafraîchir l\'historique');
      onSuccess(meeting.id);
    } catch (error: any) {
      console.error('Erreur:', error);
      await updateTask(taskId, {
        status: 'error',
        error: error.message || 'Une erreur est survenue'
      });
      await showAlert({
        title: 'Erreur',
        message: `Erreur: ${error.message || 'Une erreur est survenue'}`,
        variant: 'danger',
      });
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  // Handlers pour le modal d'avertissement de quota bas avant upload
  const handleLowQuotaUploadContinue = () => {
    console.log('✅ Utilisateur confirme l\'upload malgré le quota bas');
    setShowLowQuotaUploadWarning(false);
    proceedWithUpload();
  };

  const handleLowQuotaUploadCancel = () => {
    console.log('❌ Utilisateur annule l\'upload à cause du quota bas');
    setShowLowQuotaUploadWarning(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 md:p-12 bg-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-8">
          Importer un fichier audio
        </h2>

        <div className="space-y-6">
          {/* Zone de drop/sélection */}
          <div className="bg-gray-50 rounded-lg p-12 text-center hover:bg-gray-100 transition-all">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/webm,video/mp4,.webm,.mp3,.wav,.m4a,.ogg"
            onChange={handleFileSelect}
            className="hidden"
            id="audio-upload"
            disabled={isProcessing}
          />
          <label
            htmlFor="audio-upload"
            className="cursor-pointer flex flex-col items-center gap-4"
          >
            {selectedFile ? (
              <>
                <FileAudio className="w-12 h-12 text-gray-400" />
                <div className="text-center">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {audioDuration > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Durée: {Math.floor(audioDuration / 60)}:{String(audioDuration % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedFile(null);
                    setAudioDuration(0);
                    setIsCalculatingDuration(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Supprimer
                </button>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 mb-1">
                    Cliquez pour sélectionner un fichier audio
                  </p>
                  <p className="text-sm text-gray-500">
                    MP3, WAV, M4A, WebM, OGG, FLAC, etc.
                  </p>
                </div>
              </>
            )}
          </label>
        </div>

        {/* Titre */}
        <div>
          <label htmlFor="upload-title" className="block text-sm font-medium text-gray-700 mb-2">
            Titre de la réunion (optionnel)
          </label>
          <input
            type="text"
            id="upload-title"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Ex : Rendez-vous client"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 text-gray-900"
            disabled={isProcessing}
          />
        </div>

        {/* Indicateur de calcul de durée */}
        {isCalculatingDuration && selectedFile && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              Calcul de la durée du fichier en cours...
            </p>
          </div>
        )}

        {/* Affichage de la durée détectée */}
        {audioDuration > 0 && !isCalculatingDuration && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 flex items-center gap-2">
              ✅ Durée détectée : {Math.floor(audioDuration / 60)} min {audioDuration % 60} sec
            </p>
          </div>
        )}

        {/* Bouton traiter */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isProcessing || isCalculatingDuration || audioDuration === 0}
          className={`w-auto px-8 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            !selectedFile || isProcessing || isCalculatingDuration || audioDuration === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Traitement en cours...</span>
            </>
          ) : isCalculatingDuration ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Analyse du fichier...</span>
            </>
          ) : (
            <>
              <span>Transcrire et générer le résumé</span>
            </>
          )}
        </button>

        {/* Progression */}
        {progress && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                {progress}
              </p>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs text-orange-800 flex items-center gap-2">
                ⚠️ Ne fermez pas cette page et ne rafraîchissez pas le navigateur pendant le traitement !
              </p>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Modal de quota complètement atteint */}
      <QuotaFullModal
        isOpen={showQuotaFullModal}
        onClose={() => setShowQuotaFullModal(false)}
        onUpgrade={() => {
          setShowQuotaFullModal(false);
          // Rediriger vers Settings (géré par le parent via onSuccess)
          window.location.hash = 'settings';
        }}
      />

      {/* Modal d'erreur d'upload quota dépassé */}
      <UploadQuotaErrorModal
        isOpen={showUploadQuotaError}
        onClose={() => setShowUploadQuotaError(false)}
        onUpgrade={() => {
          setShowUploadQuotaError(false);
          // Rediriger vers Settings
          window.location.hash = 'settings';
        }}
        audioDuration={uploadQuotaErrorData.audioDuration}
        remainingMinutes={uploadQuotaErrorData.remainingMinutes}
      />

      {/* Modal d'avertissement quota bas avant upload */}
      <LowQuotaUploadWarningModal
        isOpen={showLowQuotaUploadWarning}
        onClose={handleLowQuotaUploadCancel}
        onContinue={handleLowQuotaUploadContinue}
        uploadMinutes={lowQuotaUploadData.uploadMinutes}
        remainingAfter={lowQuotaUploadData.remainingAfter}
      />
    </div>
  );
};

