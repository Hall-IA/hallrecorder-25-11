import { motion, AnimatePresence } from 'framer-motion';
import { Edit3 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WordCorrectionHintProps {
  show: boolean;
  position: { x: number; y: number };
}

export const WordCorrectionHint = ({ show, position }: WordCorrectionHintProps) => {
  const [hasSeenHint, setHasSeenHint] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà vu le hint
    const seen = localStorage.getItem('hasSeenDoubleClickHint');
    setHasSeenHint(!!seen);
  }, []);

  const dismissHint = () => {
    localStorage.setItem('hasSeenDoubleClickHint', 'true');
    setHasSeenHint(true);
  };

  // Ne pas afficher si déjà vu
  if (hasSeenHint) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed z-[100000] pointer-events-none"
          style={{
            left: position.x,
            top: position.y - 60,
          }}
        >
          {/* Tooltip avec animation */}
          <div className="relative">
            {/* Contenu du tooltip */}
            <div className="bg-gradient-to-r from-coral-500 to-sunset-500 text-white px-4 py-2.5 rounded-lg shadow-2xl border border-coral-400">
              <div className="flex items-center gap-2">
                {/* Icône avec animation de pulsation */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Edit3 className="w-4 h-4" />
                </motion.div>

                {/* Texte avec animation de double-clic */}
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold whitespace-nowrap">
                    Double-cliquez
                  </span>

                  {/* Animation de clic */}
                  <motion.div
                    className="flex gap-0.5"
                    animate={{
                      scale: [1, 0.9, 1, 0.9, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 1,
                      ease: 'easeInOut',
                    }}
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </motion.div>

                  <span className="text-sm font-semibold whitespace-nowrap">
                    pour corriger
                  </span>
                </div>

                {/* Bouton pour masquer le hint */}
                <button
                  onClick={dismissHint}
                  className="ml-2 text-white/80 hover:text-white transition-colors pointer-events-auto"
                  title="Ne plus afficher"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Flèche pointant vers le mot */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
              <motion.div
                animate={{
                  y: [0, 3, 0],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-sunset-500"
              />
            </div>

            {/* Effet de lueur */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-coral-400 to-sunset-400 rounded-lg blur-lg -z-10"
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
