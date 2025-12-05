import { useEffect, useState } from 'react';
import { driver } from 'driver.js';
// Note: On n'importe PAS le CSS par défaut de driver.js pour éviter les conflits
// Les styles sont définis dans src/index.css sous "DRIVER.JS CUSTOM STYLES"

// Types pour les étapes du tour
export interface TourStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

// Hook pour gérer les tours guidés
export function useFeatureTour(tourId: string, steps: TourStep[], options?: {
  autoStart?: boolean;
  delay?: number;
}) {
  const [hasSeenTour, setHasSeenTour] = useState(true);

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà vu ce tour
    const seenTours = JSON.parse(localStorage.getItem('seenTours') || '[]');
    const alreadySeen = seenTours.includes(tourId);
    setHasSeenTour(alreadySeen);

    // Démarrer automatiquement si configuré
    if (options?.autoStart && !alreadySeen) {
      const timer = setTimeout(() => {
        startTour();
      }, options?.delay || 1000);

      return () => clearTimeout(timer);
    }
  }, [tourId]);

  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps: steps,
      onDestroyed: () => {
        // Marquer le tour comme vu
        const seenTours = JSON.parse(localStorage.getItem('seenTours') || '[]');
        if (!seenTours.includes(tourId)) {
          localStorage.setItem('seenTours', JSON.stringify([...seenTours, tourId]));
          setHasSeenTour(true);
        }
      },
      // Personnalisation des styles pour matcher votre design
      popoverClass: 'driver-popover-custom',
      progressText: 'Étape {{current}} sur {{total}}',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminé',
    });

    driverObj.drive();
  };

  const resetTour = () => {
    const seenTours = JSON.parse(localStorage.getItem('seenTours') || '[]');
    const filtered = seenTours.filter((id: string) => id !== tourId);
    localStorage.setItem('seenTours', JSON.stringify(filtered));
    setHasSeenTour(false);
  };

  return {
    hasSeenTour,
    startTour,
    resetTour,
  };
}

// Hook pour réinitialiser tous les tours (utile pour le développement)
export function useResetAllTours() {
  const resetAll = () => {
    localStorage.removeItem('seenTours');
  };

  return { resetAll };
}
