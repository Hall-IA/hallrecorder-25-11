import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isActive: boolean;
  barColor?: string;
  bgColor?: string;
}

export const AudioVisualizer = ({
  stream,
  isActive,
  barColor = '#FF6B4A',
  bgColor = 'transparent',
}: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const freqBufferRef = useRef<Uint8Array | null>(null);
  const prevHeightsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    // Utiliser le DPI natif complet pour un rendu cristallin
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const cssWidth = rect.width || 600;
      const cssHeight = rect.height || 200;
      // Canvas haute résolution
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      // Garder la taille CSS
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isActive || !stream || !canvasRef.current) return;

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx: AudioContext = new AudioCtx();
    audioContextRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    // FFT maximale pour une précision extrême
    analyser.fftSize = 4096;
    // Smoothing réduit pour plus de réactivité
    analyser.smoothingTimeConstant = 0.6;
    analyserRef.current = analyser;

    if (stream.getAudioTracks().length === 0) {
      return () => {
        audioCtx.close();
      };
    }
    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    // Activer l'anti-aliasing et le lissage pour les formes
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    freqBufferRef.current = freqData;

    // Nombre de barres fixe pour un rendu constant
    const BAR_COUNT = 80;

    // Initialiser les hauteurs précédentes pour l'animation fluide
    if (prevHeightsRef.current.length !== BAR_COUNT) {
      prevHeightsRef.current = new Array(BAR_COUNT).fill(0);
    }

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;

      // Fond gris clair
      ctx.fillStyle = '#f3f4f6'; // gray-100
      ctx.fillRect(0, 0, w, h);

      // Dessiner les lignes verticales de grille
      const gridLineCount = 12;
      ctx.strokeStyle = '#e5e7eb'; // gray-200
      ctx.lineWidth = 1 * dpr;
      for (let i = 1; i < gridLineCount; i++) {
        const x = (w / gridLineCount) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Ligne horizontale centrale
      ctx.strokeStyle = '#d1d5db'; // gray-300
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      // Récupérer les données de fréquence
      analyser.getByteFrequencyData(freqData);

      // Calcul des dimensions des barres
      const totalBarSpace = w * 0.95; // 95% de largeur utilisée
      const barWidth = Math.round((totalBarSpace / BAR_COUNT) * 0.7);
      const gap = Math.round((totalBarSpace / BAR_COUNT) * 0.3);
      const startX = (w - (BAR_COUNT * (barWidth + gap) - gap)) / 2;

      // Nombre de bins de fréquence par barre (focus sur les basses/moyennes)
      const usableBins = Math.floor(freqData.length * 0.6); // 60% des bins (basses/moyennes fréquences)
      const binsPerBar = Math.floor(usableBins / BAR_COUNT);

      for (let i = 0; i < BAR_COUNT; i++) {
        // Calculer la moyenne des fréquences pour cette barre
        let sum = 0;
        let count = 0;
        const startBin = i * binsPerBar;
        const endBin = Math.min(startBin + binsPerBar, usableBins);

        for (let j = startBin; j < endBin; j++) {
          sum += freqData[j];
          count++;
        }

        const avgValue = count > 0 ? sum / count : 0;

        // Normalisation avec courbe pour plus de dynamisme
        const normalized = Math.pow(avgValue / 255, 0.85);

        // Hauteur cible
        const maxBarHeight = (h * 0.42);
        const targetHeight = Math.max(2 * dpr, normalized * maxBarHeight);

        // Animation fluide avec interpolation
        const prevHeight = prevHeightsRef.current[i];
        const smoothingFactor = targetHeight > prevHeight ? 0.3 : 0.15; // Monte vite, descend doucement
        const currentHeight = prevHeight + (targetHeight - prevHeight) * smoothingFactor;
        prevHeightsRef.current[i] = currentHeight;

        const x = startX + i * (barWidth + gap);

        // Créer un dégradé vertical pour chaque barre
        const gradient = ctx.createLinearGradient(0, mid - currentHeight, 0, mid + currentHeight);
        const intensity = Math.min(1, normalized * 1.5);

        // Dégradé du coral vers le sunset avec opacité basée sur l'intensité
        gradient.addColorStop(0, `rgba(255, 107, 74, ${0.3 + intensity * 0.7})`);
        gradient.addColorStop(0.5, `rgba(255, 87, 51, ${0.5 + intensity * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 107, 74, ${0.3 + intensity * 0.7})`);

        ctx.fillStyle = gradient;

        // Dessiner avec coins arrondis pour un look premium
        const radius = Math.min(barWidth / 2, 3 * dpr);

        // Barre du haut (vers le haut depuis le milieu)
        drawRoundedRect(ctx, x, mid - currentHeight, barWidth, currentHeight, radius, 'top');

        // Barre du bas (vers le bas depuis le milieu) - miroir
        drawRoundedRect(ctx, x, mid, barWidth, currentHeight, radius, 'bottom');
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (analyserRef.current) analyserRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      audioCtx.close();
    };
  }, [isActive, stream, barColor]);

  return (
    <div className="w-full h-full" style={{ background: bgColor }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          display: isActive ? 'block' : 'none',
        }}
      />
      {!isActive && (
        <div className="flex items-center justify-center h-full w-full text-cocoa-500/70 text-sm">
          Visualisation en pause
        </div>
      )}
    </div>
  );
};

// Fonction helper pour dessiner des rectangles avec coins arrondis
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  roundSide: 'top' | 'bottom' | 'both'
) {
  ctx.beginPath();

  if (roundSide === 'top') {
    // Coins arrondis en haut seulement
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  } else if (roundSide === 'bottom') {
    // Coins arrondis en bas seulement
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y);
  } else {
    // Tous les coins arrondis
    ctx.roundRect(x, y, width, height, radius);
  }

  ctx.closePath();
  ctx.fill();
}

