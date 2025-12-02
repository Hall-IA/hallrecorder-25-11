import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { FaqProps } from './Faq';
import { FaqList } from './FaqList';

const faq: FaqProps[] = [
  {
    question: 'Comment fonctionne HALL-RECORDER ?',
    answer:
      'HALL-RECORDER enregistre vos réunions (en présentiel ou en visioconférence), transcrit automatiquement les échanges grâce à l\'IA, puis génère un résumé clair comprenant les décisions, les actions et les points importants. L\'outil classe et archive ensuite chaque réunion dans un espace sécurisé, accessible à tout moment.'
  },
  {
    question: 'HALL-RECORDER peut-il être utilisé avec Zoom, Microsoft Teams, Google Meet ?',
    answer:
      'Oui. HALL-RECORDER se connecte facilement à vos outils de visioconférence habituels (Zoom, Microsoft Teams, Google Meet...).',
    
  },
  {
    question: 'Est-ce que les transcriptions et comptes rendus sont fiables ?',
    answer:
      'Absolument. HALL-RECORDER utilise une technologie avancée de reconnaissance vocale et d\'analyse sémantique, capable de détecter les intervenants, réduire le bruit et comprendre le contexte. Le résultat : une transcription précise et une synthèse fidèle même lors de discussions rapides ou complexes.',
    
  },
  {
    question: 'Mes données sont-elles protégées et conformes au RGPD ?',
    answer:
      'Oui. La sécurité des données est une priorité. \n Les enregistrements, transcriptions et comptes rendus sont chiffrés, stockés sur des serveurs sécurisés entièrement conformes au RGPD.',
  },
  {
    question: 'Peut-on utiliser HALL-RECORDER en plusieurs langues ?',
    answer:
      'Oui. L\'IA détecte automatiquement la langue parlée par chaque intervenant et peut transcrire ou traduire la réunion dans différentes langues. \n Idéal pour les équipes internationales, les échanges bilingues ou les entreprises multi-sites.',
    
  },
  {
    question: 'Quel type d\'entreprise peut utiliser HALL-RECORDER ?',
    answer:
      'HALL-RECORDER est conçu pour les PME, mais il convient aussi aux indépendants, aux start-up, aux équipes commerciales, RH, direction ou projet. \n Toute organisation qui souhaite gagner du temps, améliorer le suivi des décisions et structurer ses réunions peut tirer un bénéfice immédiat de l\'outil.',
    
  },
  {
    question: 'Que se passe-t-il si, pendant la réunion, vous abordez des sujets futiles ?',
    answer:
      'L\'IA se concentre uniquement sur les échanges liés au business. Elle filtre automatiquement les digressions et les sujets sans importance. Par exemple, si un participant commence à raconter ses vacances ou une anecdote personnelle, ces informations seront ignorées pour produire un résumé clair, pertinent et centré sur votre activité.',
    
  },
  {
    question: 'Peut-on mettre l’enregistrement en pause pendant une réunion ?',
    answer:
      'Oui, absolument. L\'outil dispose d\'une fonctionnalité "Pause" qui vous permet d\'interrompre l\'enregistrement à tout moment — idéal lors d\'une pause café, d\'un aparté ou d\'un moment hors sujet. Une fois la réunion reprise, il suffit de relancer l\'enregistrement pour continuer la capture là où vous l\'aviez arrêtée, sans créer plusieurs fichiers ni perdre le fil de votre compte rendu.',
    
  },
 
  {
    question: 'Que faire si je n’ai pas de connexion Internet pendant la réunion ?',
    answer: 'L\'outil fonctionne avec l\'intelligence artificielle et nécessite une connexion Internet pour analyser votre réunion en direct. Toutefois, si vous êtes hors ligne, vous pouvez simplement utiliser la fonction d\'enregistrement audio de votre mobile. Une fois la connexion rétablie, importez votre enregistrement dans l\'application : l\'IA générera automatiquement un résumé clair et complet à partir de cet audio.',
  },
];

export function FaqSection() {
  const fadeInRef = useRef<HTMLDivElement>(null);
  const fadeInInView = useInView(fadeInRef as unknown as React.RefObject<Element>, { once: true });

  const fadeUpVariants = {
    initial: {
      opacity: 0,
      y: -24,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
  };
  return (
    <section
      className="relative w-full overflow-hidden bg-[#F9F7F5] py-15"
      aria-labelledby="faq-section-title"
    >
      {/* Flou en haut */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[40%]"
        style={{
          background: 'linear-gradient(to bottom, rgba(249, 247, 245, 0.95) 0%, transparent 100%)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      {/* Flou en bas */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[30%]"
        style={{
          background: 'linear-gradient(to top, rgba(249, 247, 245, 0.95) 0%, transparent 100%)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />
      <InteractiveGridPattern
        className="z-0"
        squares={[40, 40]}
        width={70}
        height={70}
        aria-hidden="true"
      />
      <img
        src="/assets/img/shape-yellow.png"
        alt=""
        width={700}
        height={700}
        className="absolute bottom-0 -left-60 z-10 rotate-6 max-sm:hidden"
        aria-hidden="true"
        loading="lazy"
      />
      <img
        src="/assets/img/shape-pink.png"
        alt=""
        width={700}
        height={700}
        className="absolute top-0 -right-70 z-10 max-sm:hidden"
        aria-hidden="true"
        loading="lazy"
      />
      <motion.div
        className="relative z-20 mx-auto flex flex-col items-center gap-12 px-4 pt-5 md:max-w-[1000px]"
        ref={fadeInRef}
        animate={fadeInInView ? 'animate' : 'initial'}
        variants={fadeUpVariants}
        initial={false}
        transition={{
          duration: 0.6,
          delay: 0.2,
          ease: [0.21, 0.47, 0.32, 0.98],
          type: 'spring',
        }}
      >
        <header className="space-y-1.5 lg:px-[120px]">
          <h2
            id="faq-section-title"
            className="font-thunder text-center leading-tight font-medium max-sm:text-4xl sm:text-4xl lg:text-6xl"
          >
            Les questions fréquentes
          </h2>
          <p className="font-roboto text-center text-[24px] text-[#333231] max-sm:text-lg sm:text-lg md:text-xl">
            Consultez notre section FAQ pour des réponses rapides et faciles aux questions les plus
            fréquentes.
          </p>
        </header>
        <FaqList
          faqs={faq}
          // ✅ Gradient pour le fond de la FAQ
          gradientFrom="#F35F4F"  // Rouge-rose
          gradientTo="#FFAD5A"    // Orange clair

          // ✅ Couleurs pour le GlowingEffect (transition harmonieuse)
          glowColors={{
            color1: '#F35F4F',  // Rouge-rose (base)
            color2: '#F77953',  // Rouge-orange (33% du chemin)
            color3: '#FB9256',  // Orange (66% du chemin)
            color4: '#FFAD5A',  // Orange clair (base)
          }}
          />
                </motion.div>
    </section>
  );
}
