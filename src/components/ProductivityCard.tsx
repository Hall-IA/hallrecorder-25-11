import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Upload, Brain, GitForkIcon, File, Play, BookOpen } from 'lucide-react';

interface StepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface ResultProps {
  metric: string;
  explanation: string;
  height: number; // Pourcentage de hauteur de la barre
}

const steps: StepProps[] = [
  {
    icon: <Play size={30} className="text-orange-400" />,
    title: 'Lancez l’enregistrement',
    description: 'Ouvrez l’application et démarrez l’enregistrement en un clic. Rien à configurer.',
  },
  {
    icon: <MessageSquare size={30} className="text-orange-400" />,
    title: 'Conduisez votre réunion normalement',
    description: 'Échangez, présentez, discutez : l’outil capture tout en arrière-plan, sans perturber votre réunion.',
  },
  {
    icon: <BookOpen size={30} className="text-orange-400" />,
    title: ' Clôturez et choisissez votre résumé',
    description: 'Terminez l’enregistrement, sélectionnez un résumé court ou exhaustif… et téléchargez automatiquement votre compte-rendu.',
  },
];

const results: ResultProps[] = [
  {
    metric: '+5 heures économisées par jour',
    explanation: 'Votre équipe ne traite plus les messages répétitifs.',
    height: 100,
  },
  {
    metric: '+18% de satisfaction client constaté après 30 jours',
    explanation: 'Le bot trouve les réponses rapidement dans vos PDF/FAQ.',
    height: 200,
  },
  {
    metric: '-40% d\'appels entrants liés au SAV',
    explanation: 'Les clients ont des réponses instantanées.',
    height: 250,
  },
  {
    metric: '100% de présence',
    explanation: 'Même quand personne n\'est connecté.',
    height: 300,
  },
];

export function ProductivityCard() {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => {
      if (cardRef.current) observer.unobserve(cardRef.current);
    };
  }, []);

  return (
    <section
      ref={cardRef}
      className={`relative w-full pt-10 sm:pt-16 md:pt-20 transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
      style={{
        background: `conic-gradient(
          from 195.77deg at 84.44% -1.66%,
          #FE9736 0deg,
          #F4664C 76.15deg,
          #F97E41 197.31deg,
          #E3AB8D 245.77deg,
          #FE9736 360deg
        )`,
      }}
      itemScope
      itemType="https://schema.org/CreativeWork"
      aria-label="Comment ça fonctionne et résultats immédiats"
      id="avantages"
    >
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-3 md:py-0">
        {/* Section "Comment ça fonctionne ?" */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h3
            className="mb-8 text-center text-2xl font-thunder font-medium text-white sm:text-3xl md:text-4xl md:mb-12 lg:text-5xl xl:text-6xl"
            itemProp="headline"
          >
            Comment ça fonctionne ?
          </h3>

          {/* Conteneur avec les 3 étapes */}
          <div className="relative flex flex-col items-center gap-2 sm:gap-3 md:gap-4 lg:flex-row lg:justify-center lg:gap-0">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`relative flex items-center ${index > 0 ? 'lg:-ml-[106px]' : ''}`}
                style={{
                  // Z-index décroissant : carte 1 = 3, carte 2 = 2, carte 3 = 1
                  // Ainsi la première carte est AU-DESSUS de la deuxième
                  zIndex: steps.length - index,
                }}
              >
                {/* Carte en forme de flèche */}
                <div className="relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="495"
                    height="224"
                    viewBox="0 0 495 224"
                    fill="none"
                    className="h-auto w-full max-w-[300px] sm:max-w-[400px] md:max-w-[450px] lg:max-w-[500px]"
                  >
                    <defs>
                      <filter
                        id={`filter0_d_4525_11964_${index}`}
                        x="0"
                        y="-32"
                        width="494.667"
                        height="288"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                      >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix
                          in="SourceAlpha"
                          type="matrix"
                          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                          result="hardAlpha"
                        />
                        <feOffset dx="8" />
                        <feGaussianBlur stdDeviation="16" />
                        <feComposite in2="hardAlpha" operator="out" />
                        <feColorMatrix
                          type="matrix"
                          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0"
                        />
                        <feBlend
                          mode="normal"
                          in2="BackgroundImageFix"
                          result="effect1_dropShadow_4525_11964"
                        />
                        <feBlend
                          mode="normal"
                          in="SourceGraphic"
                          in2="effect1_dropShadow_4525_11964"
                          result="shape"
                        />
                      </filter>
                    </defs>
                    <g filter={`url(#filter0_d_4525_11964_${index})`}>
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M409.359 0L454.667 112L409.359 224H24.4746L24 0H409.359Z"
                        fill="#FEFDFD"
                      />
                    </g>
                  </svg>
                  {/* Contenu de la carte */}
                  <div className="absolute inset-0 flex flex-col justify-start gap-4 px-5 pr-6 py-2 sm:px-12 md:px-16 lg:px-20 mt-1">
                    <div className="hidden sm:flex bg-orange-200/50 rounded-xl p-2 w-fit">{step.icon}</div>
                    <h4 className="font-roboto text-sm font-semibold text-orange-500 px-2 sm:px-0 md:text-sm lg:text-sm xl:text-lg">
                      {step.title}
                    </h4>
                    <p className="font-roboto text-xs text-gray-600 px-2 sm:px-0 md:text-sm lg:text-xs xl:text-base">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section "Résultats immédiats" */}
        {/* <div>
          <h3
            className="mb-12  text-4xl font-thunder font-medium text-white md:text-5xl lg:text-6xl"
            itemProp="headline"
          >
            Résultats immédiats
          </h3>

          <div className="flex flex-col items-start justify-end gap-6 md:flex-row md:items-end md:justify-center md:gap-8">
            {results.map((result, index) => (
              <div key={index} className="flex flex-col items-start gap-6">
                <div className="space-y-3">
                  <p className="font-roboto text-base font-semibold text-white md:text-lg border-l-2 border-red-500 pl-2">
                    {result.metric}
                  </p>
                  <p className="font-roboto mt-1 text-sm text-white/90 md:text-base">
                    {result.explanation}
                  </p>
                </div>

                <div
                  className="rounded-t-md bg-white transition-all duration-700"
                  style={{
                    height: `${result.height}px`,
                    minHeight: '40px',
                    width: '100px',
                    animationDelay: `${index * 100}ms`,
                  }}
                />
              </div>
            ))}
          </div> 
        </div>*/}
      </div>
    </section>
  );
}