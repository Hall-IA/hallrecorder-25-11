import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Square, Pause, Play } from 'lucide-react';

interface FloatingRecordButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export const FloatingRecordButton = ({
  isRecording,
  isPaused,
  recordingTime,
  onPause,
  onResume,
  onStop,
}: FloatingRecordButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: Math.max(16, window.innerWidth - 160),
      y: Math.max(16, window.innerHeight - 220),
    };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showDragHint, setShowDragHint] = useState(false);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const safeAreaPadding = useMemo(() => ({
    base: 16,
    sm: 20,
    md: 24,
  }), []);

  const getContainerSize = useCallback(() => {
    const el = containerRef.current;
    return {
      width: el?.offsetWidth ?? (window.innerWidth < 640 ? 120 : 144),
      height: el?.offsetHeight ?? (window.innerWidth < 640 ? 120 : 144),
    };
  }, []);

  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') {
      return { x, y };
    }

    const { width, height } = getContainerSize();
    const edgePadding = window.innerWidth < 640
      ? safeAreaPadding.base
      : window.innerWidth < 768
        ? safeAreaPadding.sm
        : safeAreaPadding.md;

    const maxX = window.innerWidth - width - edgePadding;
    const maxY = window.innerHeight - height - edgePadding;

    return {
      x: Math.min(Math.max(edgePadding, x), Math.max(edgePadding, maxX)),
      y: Math.min(Math.max(edgePadding, y), Math.max(edgePadding, maxY)),
    };
  }, [getContainerSize, safeAreaPadding]);

  const computeDefaultPosition = useCallback(() => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const edgePadding = window.innerWidth < 640
      ? safeAreaPadding.base
      : window.innerWidth < 768
        ? safeAreaPadding.sm
        : safeAreaPadding.md;

    const { width, height } = getContainerSize();

    return {
      x: window.innerWidth - width - edgePadding,
      y: window.innerHeight - height - (edgePadding + (window.innerWidth < 640 ? 56 : 32)),
    };
  }, [getContainerSize, safeAreaPadding]);

  useEffect(() => {
    if (!isRecording) return;
    if (typeof window === 'undefined') return;

    const savedPositionRaw = window.localStorage.getItem('floating-record-button-position');
    if (savedPositionRaw) {
      try {
        const parsed = JSON.parse(savedPositionRaw);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const clamped = clampPosition(parsed.x, parsed.y);
          setPosition(clamped);
          return;
        }
      } catch (error) {
        console.warn('FloatingRecordButton: impossible de lire la position sauvegardée', error);
      }
    }

    const defaultPosition = computeDefaultPosition();
    setPosition(clampPosition(defaultPosition.x, defaultPosition.y));
  }, [isRecording, clampPosition, computeDefaultPosition]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isRecording) return;
    try {
      window.localStorage.setItem('floating-record-button-position', JSON.stringify(position));
    } catch (error) {
      console.warn('FloatingRecordButton: impossible de sauvegarder la position', error);
    }
  }, [position, isRecording]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isRecording) return;

    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [clampPosition, isRecording]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.currentTarget instanceof HTMLElement)) return;

    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    setIsDragging(true);
    if (showDragHint) {
      setShowDragHint(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('floating-record-button-drag-hint-dismissed', 'true');
      }
    }
  }, [position.x, position.y, showDragHint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    event.preventDefault();
    const nextX = event.clientX - dragOffsetRef.current.x;
    const nextY = event.clientY - dragOffsetRef.current.y;
    const clamped = clampPosition(nextX, nextY);
    setPosition(clamped);
  }, [clampPosition, isDragging]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isRecording) {
      setShowDragHint(false);
      return;
    }
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('floating-record-button-drag-hint-dismissed') === 'true') return;

    const timer = window.setTimeout(() => {
      setShowDragHint(true);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [isRecording]);

  if (!isRecording) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {showDragHint && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-cocoa-900/90 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg pointer-events-none">
          Glissez pour déplacer
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-cocoa-900/90"></div>
        </div>
      )}
      {/* Zone étendue pour maintenir le hover */}
      <div className="relative flex items-center gap-2 md:gap-4 group pr-2 md:pr-4">
        {/* Boutons Pause et Arrêt (à gauche, visibles au hover sur desktop, toujours visibles sur mobile) */}
        <div className="flex items-center gap-2 md:gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 transform translate-x-0 md:translate-x-6 md:group-hover:translate-x-0 pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto">
          {isPaused ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onResume();
              }}
              className="p-2.5 md:p-3.5 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full transition-all shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95"
              title="Reprendre"
            >
              <Play className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPause();
              }}
              className="p-2.5 md:p-3.5 bg-gradient-to-br from-sunset-500 to-sunset-600 hover:from-sunset-600 hover:to-sunset-700 text-white rounded-full transition-all shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95"
              title="Pause"
            >
              <Pause className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStop();
            }}
            className="p-2.5 md:p-3.5 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full transition-all shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95"
            title="Arrêter"
          >
            <Square className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Bouton principal rond avec animation douce */}
        <div className="relative">
          {/* Ondes douces en arrière-plan */}
          <div className="absolute inset-0 bg-coral-400 rounded-full opacity-20 animate-ping pointer-events-none" style={{ animationDuration: '4s' }}></div>
          <div className="absolute inset-0 bg-coral-400 rounded-full opacity-30 animate-pulse pointer-events-none" style={{ animationDuration: '3s' }}></div>

          {/* Bouton rond principal */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-gradient-to-br from-coral-500 to-coral-600 rounded-full shadow-2xl flex flex-col items-center justify-center border-2 md:border-4 border-white transition-transform hover:scale-105 cursor-pointer">
            {/* Indicateur d'enregistrement */}
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-white rounded-full animate-pulse shadow-lg mb-1 md:mb-2" style={{ animationDuration: '2s' }} />
            
            {/* Timer */}
            <span className="font-mono font-bold text-white text-[11px] sm:text-xs md:text-sm tabular-nums">
              {formatTime(recordingTime)}
            </span>

            {/* Indicateur de pause */}
            {isPaused && (
              <div className="absolute bottom-1.5 sm:bottom-2.5 md:bottom-3 left-0 right-0">
                <p className="text-[9px] sm:text-[10px] md:text-xs text-white font-bold text-center tracking-wider">PAUSE</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
