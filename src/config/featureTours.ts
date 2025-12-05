import { TourStep } from '../hooks/useFeatureTour';

// Configuration de tous les tours guidés de l'application
export const TOURS = {
  // Tour pour la page de détail d'une réunion
  meetingDetail: {
    id: 'meeting-detail-features',
    steps: [
      {
        element: '#meeting-summary-text',
        popover: {
          title: 'Résumé de votre réunion',
          description: 'Voici le résumé généré automatiquement de votre réunion. Vous pouvez le modifier en activant le mode édition.',
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
      {
        element: '#meeting-summary-text',
        popover: {
          title: 'Correction rapide',
          description: '💡 Astuce : Double-cliquez sur n\'importe quel mot pour le corriger rapidement ! La correction sera enregistrée dans votre dictionnaire personnel.',
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
      {
        element: '[data-tour="email-button"]',
        popover: {
          title: 'Partager par email',
          description: 'Envoyez le résumé directement par email avec un seul clic. Vous pouvez choisir entre Gmail, SMTP ou votre client email local.',
          side: 'left' as const,
          align: 'start' as const,
        },
      },
      {
        element: '[data-tour="edit-button"]',
        popover: {
          title: 'Mode édition',
          description: 'Activez le mode édition pour modifier le titre, le résumé et la transcription de votre réunion.',
          side: 'left' as const,
          align: 'start' as const,
        },
      },
      {
        element: '[data-tour="pdf-button"]',
        popover: {
          title: 'Exporter en PDF',
          description: 'Téléchargez votre réunion complète au format PDF pour la partager facilement.',
          side: 'left' as const,
          align: 'start' as const,
        },
      },
    ] as TourStep[],
  },

  // Tour pour la première utilisation de l'enregistrement
  firstRecording: {
    id: 'first-recording-guide',
    steps: [
      {
        element: '#meeting-title-input',
        popover: {
          title: 'Nom de la réunion',
          description: 'Donnez un nom à votre réunion (optionnel). Si vous le laissez vide, l\'IA générera automatiquement un titre pertinent.',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour="recording-mode"]',
        popover: {
          title: 'Mode d\'enregistrement',
          description: 'Choisissez le mode Présentiel pour enregistrer avec votre microphone, ou Visio pour enregistrer une réunion en ligne.',
          side: 'right' as const,
        },
      },
      {
        element: '[data-tour="start-recording"]',
        popover: {
          title: 'Démarrer l\'enregistrement',
          description: 'Cliquez ici pour commencer à enregistrer. Vous pourrez mettre en pause et reprendre à tout moment.',
          side: 'top' as const,
        },
      },
    ] as TourStep[],
  },

  // Tour pour la page d'historique
  meetingHistory: {
    id: 'meeting-history-features',
    steps: [
      {
        element: '[data-tour="view-toggle"]',
        popover: {
          title: 'Changer la vue',
          description: 'Basculez entre la vue en liste et la vue en grille pour afficher vos réunions.',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour="search-filter"]',
        popover: {
          title: 'Rechercher et filtrer',
          description: 'Utilisez la recherche pour retrouver rapidement vos réunions par titre, participant ou contenu.',
          side: 'bottom' as const,
        },
      },
    ] as TourStep[],
  },
};
