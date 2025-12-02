import { Mic, Square, Pause, Play, Radio } from 'lucide-react';

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  isStarting?: boolean;
}

export const RecordingControls = ({
  isRecording,
  isPaused,
  recordingTime,
  onStart,
  onPause,
  onResume,
  onStop,
  isStarting = false,
}: RecordingControlsProps) => {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return { hrs, mins, secs };
  };

  const time = formatTime(recordingTime);

  // Composant pour une unité de temps stylée
  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className={`
          w-20 h-24 rounded-2xl flex items-center justify-center
          ${isRecording 
            ? 'bg-gradient-to-br from-coral-500/10 to-sunset-500/10 border-2 border-coral-200' 
            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200'
          }
          transition-all duration-500
        `}>
          <span className={`
            text-5xl font-bold tabular-nums
            ${isRecording 
              ? 'bg-gradient-to-br from-coral-600 to-sunset-600 bg-clip-text text-transparent' 
              : 'text-gray-400'
            }
            transition-colors duration-500
          `}>
            {value.toString().padStart(2, '0')}
          </span>
        </div>
        {isRecording && !isPaused && (
          <div className="absolute -inset-1 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-2xl opacity-20 blur-md animate-pulse" />
        )}
      </div>
      <span className={`
        text-xs font-semibold mt-2 uppercase tracking-wider
        ${isRecording ? 'text-coral-500' : 'text-gray-400'}
        transition-colors duration-500
      `}>
        {label}
      </span>
    </div>
  );

  // Séparateur stylé entre les unités
  const TimeSeparator = () => (
    <div className="flex flex-col gap-2 mx-1">
      <div className={`
        w-2 h-2 rounded-full
        ${isRecording && !isPaused ? 'bg-coral-500 animate-pulse' : 'bg-gray-300'}
        transition-colors duration-500
      `} />
      <div className={`
        w-2 h-2 rounded-full
        ${isRecording && !isPaused ? 'bg-coral-500 animate-pulse' : 'bg-gray-300'}
        transition-colors duration-500
      `} style={{ animationDelay: '0.5s' }} />
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Bouton principal */}
      <div className="flex items-center gap-5">
        {!isRecording ? (
          <div className="relative group">
            {/* Cercles d'animation autour du bouton */}
            <div className="absolute inset-0 scale-110">
              <div className="absolute inset-0 rounded-full border-4 border-coral-300/30 animate-[ping_2s_ease-out_infinite]" />
            </div>
            <div className="absolute -inset-4 bg-gradient-to-br from-coral-400 to-sunset-400 rounded-full opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-500" />

            <button
              onClick={() => {
                console.log('🔴 CLIC sur bouton Démarrer détecté !');
                onStart();
              }}
              disabled={isStarting}
              className={`
                relative w-36 h-36 rounded-full transition-all duration-500 
                flex flex-col items-center justify-center
                shadow-[0_10px_40px_-10px_rgba(251,113,133,0.5)]
                ${isStarting
                  ? 'bg-gradient-to-br from-gray-400 to-gray-500 cursor-not-allowed scale-95'
                  : 'bg-gradient-to-br from-coral-500 via-coral-500 to-sunset-500 hover:scale-105 hover:shadow-[0_20px_60px_-15px_rgba(251,113,133,0.6)] active:scale-100'
                }
              `}
            >
              {/* Effet de brillance sur le bouton */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-full blur-sm" />
              </div>
              
              {isStarting ? (
                <>
                  <div className="w-14 h-14 border-4 border-white border-t-transparent rounded-full animate-spin mb-1"></div>
                  <span className="font-bold text-white text-sm">Démarrage...</span>
                </>
              ) : (
                <>
                  <Mic className="w-14 h-14 text-white mb-1 drop-shadow-lg" />
                  <span className="font-bold text-white text-sm tracking-wide">Démarrer</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {isPaused ? (
              <button
                onClick={onResume}
                className="group relative flex items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300 
                  bg-gradient-to-br from-emerald-500 to-green-600 
                  shadow-[0_8px_30px_-5px_rgba(16,185,129,0.4)]
                  hover:scale-110 hover:shadow-[0_15px_40px_-5px_rgba(16,185,129,0.5)]
                  active:scale-105"
                title="Reprendre"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent" />
                <Play className="w-9 h-9 text-white drop-shadow-lg ml-1" />
              </button>
            ) : (
              <button
                onClick={onPause}
                className="group relative flex items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300 
                  bg-gradient-to-br from-amber-500 to-orange-500 
                  shadow-[0_8px_30px_-5px_rgba(245,158,11,0.4)]
                  hover:scale-110 hover:shadow-[0_15px_40px_-5px_rgba(245,158,11,0.5)]
                  active:scale-105"
                title="Pause"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent" />
                <Pause className="w-9 h-9 text-white drop-shadow-lg" />
              </button>
            )}

            <button
              onClick={onStop}
              className="group relative flex items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300 
                bg-gradient-to-br from-red-500 to-rose-600 
                shadow-[0_8px_30px_-5px_rgba(239,68,68,0.4)]
                hover:scale-110 hover:shadow-[0_15px_40px_-5px_rgba(239,68,68,0.5)]
                active:scale-105"
              title="Arrêter"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent" />
              <Square className="w-8 h-8 text-white drop-shadow-lg" />
            </button>
          </div>
        )}
      </div>

      {/* Timer stylé */}
      <div className="flex items-center">
        <TimeUnit value={time.hrs} label="heures" />
        <TimeSeparator />
        <TimeUnit value={time.mins} label="minutes" />
        <TimeSeparator />
        <TimeUnit value={time.secs} label="secondes" />
      </div>

      {/* Indicateur d'enregistrement */}
      {isRecording && (
        <div className={`
          flex items-center gap-3 px-6 py-3 rounded-full
          ${isPaused 
            ? 'bg-amber-50 border-2 border-amber-200' 
            : 'bg-gradient-to-r from-coral-50 to-sunset-50 border-2 border-coral-200'
          }
          shadow-lg transition-all duration-300
        `}>
          <div className="relative flex items-center justify-center w-6 h-6">
            {isPaused ? (
              <Pause className="w-4 h-4 text-amber-600" />
            ) : (
              <>
                <div className="absolute inset-0 bg-coral-500 rounded-full animate-ping opacity-50" />
                <Radio className="w-4 h-4 text-coral-600 relative z-10" />
              </>
            )}
          </div>
          <span className={`font-semibold tracking-wide ${isPaused ? 'text-amber-700' : 'text-coral-700'}`}>
            {isPaused ? 'En pause' : 'Enregistrement en cours'}
          </span>
        </div>
      )}
    </div>
  );
};
