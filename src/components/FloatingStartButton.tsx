import { Mic } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface FloatingStartButtonProps {
  onStartRecording: () => void;
  isVisible: boolean;
}

export const FloatingStartButton = ({ onStartRecording, isVisible }: FloatingStartButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const pointerDownPositionRef = useRef({ x: 0, y: 0 });
  const dragActiveRef = useRef(false);
  const pointerDownOnButtonRef = useRef(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDragHint, setShowDragHint] = useState(false);
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: Math.max(20, window.innerWidth - 200),
      y: Math.max(20, window.innerHeight - 220),
    };
  });

  const safeAreaPadding = useMemo(() => ({
    base: 20,
    lg: 28,
  }), []);

  const getContainerSize = useCallback(() => {
    const el = containerRef.current;
    return {
      width: el?.offsetWidth ?? 112,
      height: el?.offsetHeight ?? 112,
    };
  }, []);

  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') {
      return { x, y };
    }

    const { width, height } = getContainerSize();
    const padding = window.innerWidth < 1280 ? safeAreaPadding.base : safeAreaPadding.lg;

    const maxX = window.innerWidth - width - padding;
    const maxY = window.innerHeight - height - padding;

    return {
      x: Math.min(Math.max(padding, x), Math.max(padding, maxX)),
      y: Math.min(Math.max(padding, y), Math.max(padding, maxY)),
    };
  }, [getContainerSize, safeAreaPadding]);

  const computeDefaultPosition = useCallback(() => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const padding = window.innerWidth < 1280 ? safeAreaPadding.base : safeAreaPadding.lg;
    const { width, height } = getContainerSize();

    return {
      x: window.innerWidth - width - padding,
      y: window.innerHeight - height - (padding + 48),
    };
  }, [getContainerSize, safeAreaPadding]);

  useEffect(() => {
    if (!isVisible) {
      setShowDragHint(false);
      return;
    }
    if (typeof window === 'undefined') return;

    const savedPositionRaw = window.localStorage.getItem('floating-start-button-position');
    if (savedPositionRaw) {
      try {
        const parsed = JSON.parse(savedPositionRaw);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const clamped = clampPosition(parsed.x, parsed.y);
          setPosition(clamped);
          return;
        }
      } catch (error) {
        console.warn('FloatingStartButton: impossible de lire la position sauvegardée', error);
      }
    }

    const defaults = computeDefaultPosition();
    setPosition(clampPosition(defaults.x, defaults.y));
  }, [isVisible, clampPosition, computeDefaultPosition]);

  useEffect(() => {
    if (!isVisible) return;
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem('floating-start-button-position', JSON.stringify(position));
    } catch (error) {
      console.warn('FloatingStartButton: impossible de sauvegarder la position', error);
    }
  }, [position, isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, isVisible]);

  useEffect(() => {
    if (!isVisible) {
      setShowDragHint(false);
      return;
    }
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('floating-start-button-drag-hint-dismissed') === 'true') return;

    const timer = window.setTimeout(() => {
      setShowDragHint(true);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [isVisible]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.currentTarget instanceof HTMLElement)) return;

    const target = event.target as HTMLElement;
    const isButton = !!target.closest('button');
    pointerDownOnButtonRef.current = isButton;
    if (!isButton) {
      event.preventDefault();
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    pointerDownPositionRef.current = { x: event.clientX, y: event.clientY };
    dragActiveRef.current = false;
    if (showDragHint) {
      setShowDragHint(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('floating-start-button-drag-hint-dismissed', 'true');
      }
    }
  }, [position.x, position.y, showDragHint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    const dx = event.clientX - pointerDownPositionRef.current.x;
    const dy = event.clientY - pointerDownPositionRef.current.y;
    const distanceSquared = dx * dx + dy * dy;

    if (!dragActiveRef.current && distanceSquared > 16) {
      dragActiveRef.current = true;
      setIsDragging(true);
    }

    if (!dragActiveRef.current) return;

    event.preventDefault();
    const nextX = event.clientX - dragOffsetRef.current.x;
    const nextY = event.clientY - dragOffsetRef.current.y;
    setPosition(clampPosition(nextX, nextY));
  }, [clampPosition]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (pointerDownOnButtonRef.current && !dragActiveRef.current) {
      onStartRecording();
    }

    dragActiveRef.current = false;
    setIsDragging(false);
    pointerDownOnButtonRef.current = false;
  }, [onStartRecording]);

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed z-40 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
      <button
        className={`relative w-28 h-28 bg-gradient-to-br from-coral-500 via-coral-600 to-sunset-500 rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-125 hover:rotate-[360deg] shadow-glow-coral group ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
        title="Démarrer un enregistrement"
        style={{
          boxShadow: '0 10px 40px rgba(249, 115, 22, 0.4), 0 0 80px rgba(249, 115, 22, 0.2), inset 0 -4px 12px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Pulse animé extérieur multiple */}
        <div className="absolute -inset-2 bg-coral-400 rounded-full opacity-40 animate-ping pointer-events-none" style={{ animationDuration: '2s' }}></div>
        <div className="absolute -inset-4 bg-coral-400 rounded-full opacity-20 animate-ping pointer-events-none" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }}></div>
        <div className="absolute -inset-6 bg-coral-400 rounded-full opacity-10 animate-ping pointer-events-none" style={{ animationDuration: '3s', animationDelay: '0.6s' }}></div>

        {/* Glow pulsant */}
        <div className="absolute inset-1 bg-coral-400 rounded-full opacity-40 animate-pulse pointer-events-none" style={{ animationDuration: '1.5s' }}></div>

        {/* Reflet 3D */}
        <div className="absolute inset-3 bg-gradient-to-tr from-white/40 via-white/20 to-transparent rounded-full pointer-events-none"></div>

        {/* Hover effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

        {/* Icône avec animation */}
        <div className="relative transform transition-transform duration-500 group-hover:scale-110">
          <Mic className="w-12 h-12 text-white drop-shadow-2xl filter brightness-110" />
          {/* Effet de "voix" sortant du micro */}
          <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          </div>
          <div className="absolute -right-4 -top-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          </div>
          <div className="absolute -right-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>

        {/* Tooltip amélioré */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 glass border-2 border-coral-200 px-6 py-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none shadow-2xl scale-90 group-hover:scale-100">
          <span className="text-base font-bold bg-gradient-to-r from-coral-600 via-sunset-600 to-coral-600 bg-clip-text text-transparent animate-gradient">
            Démarrer l'enregistrement
          </span>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white/90"></div>
        </div>
      </button>
    </div>
  );
};

