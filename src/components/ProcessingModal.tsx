import { Sparkles } from 'lucide-react';

interface ProcessingModalProps {
  isOpen: boolean;
  status: string;
  onClose?: () => void;
}

// Composant pour une ligne de texte skeleton avec shimmer
const SkeletonLine = ({ width, delay = 0 }: { width: string; delay?: number }) => (
  <div 
    className="h-3 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 relative overflow-hidden"
    style={{ width, animationDelay: `${delay}ms` }}
  >
    <div 
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"
      style={{ animationDelay: `${delay}ms` }}
    />
  </div>
);

// Composant pour un bloc de "paragraphe" skeleton
const SkeletonParagraph = ({ lines, startDelay = 0 }: { lines: number; startDelay?: number }) => (
  <div className="space-y-2.5">
    {Array.from({ length: lines }).map((_, i) => {
      // Varier les largeurs pour un effet plus naturel
      const widths = ['100%', '95%', '88%', '92%', '78%', '85%', '70%'];
      const width = widths[i % widths.length];
      return <SkeletonLine key={i} width={width} delay={startDelay + i * 100} />;
    })}
  </div>
);

export const ProcessingModal = ({ isOpen, status, onClose }: ProcessingModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[90]"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-orange-100/50">
        {/* Header avec icône et titre */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral-500 to-sunset-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-2xl blur-lg opacity-30 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-cocoa-900">Génération en cours</h3>
            <p className="text-sm text-cocoa-500">{status}</p>
          </div>
        </div>

        {/* Preview du résumé en skeleton */}
        <div className="bg-gradient-to-br from-orange-50/80 to-coral-50/50 rounded-2xl p-6 border border-orange-100/50">
          {/* Titre skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-coral-400 to-sunset-400" />
            <SkeletonLine width="45%" delay={0} />
          </div>
          
          {/* Premier paragraphe */}
          <div className="mb-5">
            <SkeletonParagraph lines={3} startDelay={200} />
          </div>
          
          {/* Section avec bullet points */}
          <div className="space-y-3 mb-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div 
                  className="w-1.5 h-1.5 rounded-full bg-coral-300 mt-1.5 animate-pulse"
                  style={{ animationDelay: `${500 + i * 150}ms` }}
                />
                <SkeletonLine width={`${85 - i * 10}%`} delay={500 + i * 150} />
              </div>
            ))}
          </div>
          
          {/* Deuxième paragraphe */}
          <SkeletonParagraph lines={2} startDelay={900} />
        </div>

        {/* Indicateur de progression subtil */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-coral-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Style pour l'animation shimmer */}
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};
