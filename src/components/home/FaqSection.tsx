import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { FaqProps } from './Faq';
import { FaqList } from './FaqList';

const faq: FaqProps[] = [
  {
    question: ' Qu’est-ce que HALL-IA ?',
    answer:
      'HALL-IA est une plateforme d’agents d’intelligence artificielle métiers, conçue pour aider les entreprises à gagner du temps, réduire les erreurs et automatiser les tâches répétitives Chaque agent est spécialisé (juridique, marketing, RH, finance, commercial, etc.) et s’appuie sur des modèles d’IA avancés pour analyser, rédiger, classer, calculer ou décider intelligemment à votre place. Vous choisissez les agents dont vous avez besoin, les activez, et ils s’intègrent à votre quotidien sans effort.',
    
  },
  {
    question: 'À qui s’adresse HALL-IA ?',
    answer:
      'HALL-IA s’adresse à toutes les entreprises, quelle que soit leur taille ou leur secteur. Nos solutions sont pensées pour les PME, TPE et indépendants qui veulent tirer parti de l’IA sans passer par des développements complexes ni recruter des data scientists. Que vous gériez une agence, un cabinet, un commerce ou une structure industrielle, HALL-IA vous aide à automatiser les opérations qui consomment le plus de temps et à transformer vos processus internes.',
    
  },
  {
    question: 'Faut-il être expert en IA pour utiliser HALL-IA ?',
    answer:
      'Pas du tout — c’est justement l’objectif inverse. HALL-IA a été pensée pour être accessible à tous, avec une interface intuitive, des exemples concrets et un accompagnement étape par étape. Nos formations internes s’adaptent à votre niveau — du débutant complet à l’utilisateur expert — afin de garantir une montée en compétence progressive et concrète pour toutes vos équipes.',
    
  },
  {
    question: 'Quels types de tâches les agents IA peuvent-ils automatiser ?',
    answer:
      'Les agents HALL-IA peuvent prendre en charge aussi bien des tâches simples et répétitives que des processus complexes et multi-étapes. Quelques exemples : ',
    
    list: [
      'Génération et analyse de documents juridiques, contrats, devis, factures, courriers, etc.',
      'Gestion de campagnes marketing (emails, réseaux sociaux, reporting).',
      'Rédaction de contenus professionnels, appels d’offres, notes internes.',
      'Tri, catégorisation et synthèse automatique de données clients ou RH.',
      'Automatisation des relances, suivis, ou réponses à des messages clients.',
      'Pré-analyse de dossiers complexes ou de données comptables',
    ],
    anotherAnswer:
      'En résumé : si la tâche est récurrente, chronophage ou basée sur des règles, HALL-IA peut la gérer pour vous.',
  },
  {
    question: 'Combien de temps faut-il pour mettre HALL-IA en place ?',
    answer:
      'Quelques minutes seulement. La plateforme est entièrement en ligne et ne nécessite aucune installation technique. Après inscription, vous choisissez les agents qui correspondent à vos besoins, les configurez en quelques clics, et vos automatisations sont prêtes. Nos équipes peuvent également vous accompagner pour cartographier vos processus et optimiser le déploiement.',
    
  },
  {
    question: 'HALL-IA respecte-t-il la confidentialité de mes données ?',
    answer:
      'Absolument. La sécurité et la confidentialité sont au cœur de notre démarche. Vos données sont hébergées en Europe, dans des environnements conformes au RGPD, et aucune donnée client n’est utilisée pour entraîner nos modèles. Vous restez seul propriétaire de vos données et de vos documents. HALL-IA offre également des options de confidentialité renforcée pour les secteurs sensibles (juridique, médical, comptable…).',
    
  },
  {
    question: 'Peut-on personnaliser les agents IA selon son entreprise ?',
    answer:
      'Oui. Chaque agent peut être entraîné ou ajusté à vos usages internes : vocabulaire, documents, ton, procédures, etc. Vous pouvez connecter vos propres outils (CRM, messagerie, Google Workspace, Notion, etc.) pour créer une expérience totalement intégrée et cohérente. Notre équipe peut aussi concevoir des agents sur mesure, adaptés à vos workflows métiers spécifiques.',
    
  },
  {
    question: 'Quel est le modèle tarifaire ?',
    answer:
      'HALL-IA fonctionne en abonnement mensuel flexible et sans engagement. Vous ne payez que pour les agents activés, avec un coût adapté à la taille de votre entreprise. Chaque plan inclut :',
    list: [
      'l’accès complet à la plateforme,',
      'les mises à jour automatiques,',
      'un support utilisateur dédié,',
      'et un suivi de performance mensuel.',
    ],
    anotherAnswer:
      'Une période d’essai gratuite vous permet de tester les agents avant de vous engager.',
    
  },
  {
    question: 'Proposez-vous un accompagnement ou une formation ?',
    answer:
      'Oui, c’est une partie essentielle de notre offre. Nous accompagnons chaque entreprise dans :',
    list: [
      'l’audit de ses processus existants,',
      'le déploiement des agents les plus pertinents,',
      'la formation des collaborateurs selon leur niveau,',
      'et le suivi de la performance et du ROI dans le temps.',
    ],
    anotherAnswer:
      'Notre objectif : que vous puissiez maîtriser vos outils IA en interne, sans dépendre d’un prestataire.',
    
  },
  {
    question: 'Quels résultats concrets peut-on attendre avec HALL-IA ?',
    answer: 'Nos clients constatent dès les premières semaines :',
    list: [
      'jusqu’à 20 heures de temps libéré par collaborateur et par semaine,',
      'une réduction de 85 % des erreurs manuelles,',
      'un gain annuel moyen de 250 000 € pour une PME de 50 personnes,',
      'et une hausse de la satisfaction des collaborateurs de +60 %.',
    ],
    anotherAnswer:
      'En clair : moins de tâches répétitives, plus de performance, et une entreprise qui avance plus vite — sans alourdir les équipes.',
    
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
