import { Mic, Square, Pause, Play } from 'lucide-react';

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
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-center gap-5">
        {!isRecording ? (
          <div className="relative">
            <div className="absolute inset-0 bg-coral-400 rounded-full opacity-20 animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 bg-coral-400 rounded-full opacity-30 animate-pulse" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 bg-coral-400 rounded-full opacity-10 blur-xl"></div>

            <button
              onClick={() => {
                console.log('🔴 CLIC sur bouton Démarrer détecté !');
                onStart();
              }}
              disabled={isStarting}
              className={`relative w-40 h-40 rounded-full transition-all duration-300 shadow-2xl flex flex-col items-center justify-center border-4 border-white ${
                isStarting
                  ? 'bg-gradient-to-br from-gray-400 to-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-br from-coral-500 via-coral-600 to-sunset-500 hover:from-coral-600 hover:via-sunset-600 hover:to-sunset-700 hover:scale-110 shadow-glow-coral hover:shadow-2xl'
              }`}
            >
              {isStarting ? (
                <>
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="font-bold text-white text-sm">Démarrage...</span>
                </>
              ) : (
                <>
                  <Mic className="w-16 h-16 text-white mb-2 drop-shadow-lg" />
                  <span className="font-bold text-white text-sm drop-shadow-md">Démarrer</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={onResume}
                className="group relative flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white w-24 h-24 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-110 hover:rotate-3"
                title="Resume"
              >
                <div className="absolute inset-0 bg-white rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                <Play className="w-10 h-10 drop-shadow-lg" />
              </button>
            ) : (
              <button
                onClick={onPause}
                className="group relative flex items-center justify-center bg-gradient-to-br from-sunset-500 to-orange-600 hover:from-sunset-600 hover:to-orange-700 text-white w-24 h-24 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-110"
                title="Pause"
              >
                <div className="absolute inset-0 bg-white rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                <Pause className="w-10 h-10 drop-shadow-lg" />
              </button>
            )}

            <button
              onClick={onStop}
              className="group relative flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white w-24 h-24 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-110 hover:-rotate-3"
              title="Stop"
            >
              <div className="absolute inset-0 bg-white rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <Square className="w-10 h-10 drop-shadow-lg" />
            </button>
          </>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-coral-500 to-sunset-500 blur-xl opacity-20 animate-pulse-soft"></div>
        <div className="relative text-6xl font-mono font-bold bg-gradient-to-r from-coral-600 via-sunset-600 to-coral-600 bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer">
          {formatTime(recordingTime)}
        </div>
      </div>

      {isRecording && (
        <div className="flex items-center gap-3 px-8 py-4 glass border-2 border-coral-300 rounded-full shadow-lg shadow-coral-500/20">
          <div className="relative">
            <div className="absolute inset-0 bg-coral-500 rounded-full animate-ping opacity-75"></div>
            <div className="w-3 h-3 bg-coral-500 rounded-full animate-pulse shadow-lg shadow-coral-500/50"></div>
          </div>
          <span className="font-bold text-coral-700 tracking-wide">
            {isPaused ? 'En pause' : 'Enregistrement en cours...'}
          </span>
        </div>
      )}
    </div>
  );
};
