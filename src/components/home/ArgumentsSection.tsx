import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Image } from '../ui/Image';

interface ArgumentItem {
  title: string;
  description: string[];
  image: string;
  imagePosition: 'left' | 'right';
}

const argumentsData: ArgumentItem[] = [
  {
    title: 'Fonctionne en présentiel ou en Visio: ',
    description: [
      "Notre technologie avancée permet d'enregistrer vos réunions aussi bien en présentiel qu'en visioconférence. En salle, le module capte l'ensemble des échanges autour de lui ; en visio, il analyse automatiquement les voix et interventions de tous les participants. Compatible avec Google Meet, Zoom, Teams, Discord et bien d'autres, l'outil s'intègre facilement à votre environnement de travail.",
    ],
    image: '/assets/img/presentiel-visio.webp',
    imagePosition: 'left',
  },
  {
    title: 'Faites votre choix ! Résumé court ou résumé approfondi ? ',
    description: [
      "Personnalisez votre compte rendu selon vos besoins. Choisissez un résumé court et synthétique pour aller à l'essentiel – idées clés, décisions et actions à mener – ou optez pour un rapport approfondi qui détaille l'ensemble des points discutés. Chaque format s'adapte parfaitement à vos attentes et peut être exporté en PDF pour un partage simple avec votre équipe.",
    ],
    image: '/assets/img/resume-court-long.png',
    imagePosition: 'right',
  },
  {
    title: 'Transformez un simple enregistrement audio en un résumé parfait : ',
    description: [
      "Vous disposez d'un enregistrement audio ou d'une réunion captée hors ligne ? Glissez simplement votre fichier pour obtenir une retranscription fiable ainsi qu'un résumé précis de l'ensemble des échanges. Notre technologie convertit tout type d'audio en un compte rendu clair et exhaustif, prêt à être partagé ou archivé.",
    ],
    image: '/assets/img/transformation-note.png',
    imagePosition: 'left',
  },
  {
    title: 'Classez vos comptes rendus pour un accès plus rapide : ',
    description: [
      "Organisez vos réunions en toute simplicité. Classez vos enregistrements et comptes rendus dans des dossiers ou catégories personnalisés pour retrouver rapidement chaque échange. Grâce à l'outil de recherche intégré, accédez instantanément à une réunion par son titre, sa date ou même un mot-clé. Une gestion claire et structurée pour garder vos contenus toujours à portée de main.",
    ],
    image: '/assets/img/classification.png',
    imagePosition: 'right',
  },
  {
    title: "Cliquez c'est envoyé ! ",
    description: [
      "Envoyez vos comptes rendus en un clic. Plus besoin de copier-coller ou de rédiger de longs e-mails : l'outil intègre un système d'envoi automatique qui transmet directement la réunion, le compte rendu détaillé en pièce jointe, un résumé des points clés dans le corps du message et la liste des actions personnalisée. Créez vos propres listes de diffusion et partagez instantanément chaque réunion aux personnes concernées.",
    ],
    image: '/assets/img/envoie-email.png',
    imagePosition: 'left',
  },
  {
    title: 'Prompteur intelligent pendant votre réunion : ',
    description: [
      "Activez votre véritable coach de réunion. Plus qu'un simple observateur, l'Assistant Actif agit comme un prompteur intelligent qui suggère en temps réel des précisions, des questions pertinentes ou des axes à approfondir. Vos équipes peuvent ainsi répondre instantanément à une objection, apporter un argument clé ou enrichir l'échange au bon moment. Une aide dynamique qui transforme chaque réunion en opportunité de performance.",
    ],
    image: '/assets/img/prompteur.png',
    imagePosition: 'right',
  },
];

export default function ArgumentsSection() {
  // Vérifier si le paramètre promo=true est présent dans l'URL
  const showPromo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('promo') === 'true';
  }, []);

  return (
    <section className="font-roboto w-full lg:pt-10 lg:pb-20 overflow-hidden">
      {/* Titre dans le container */}
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-thunder font-medium mb-10 lg:mb-20">
          Découvrez les fonctionnalités avancées
        </h2>
      </div>


      {argumentsData.map((argument, index) => (
        <div key={index} className="relative mb-20 last:mb-0 min-[1100px]:mb-32">
          <div
            className={`flex flex-col items-center min-[1100px]:flex-row min-[1100px]:items-stretch ${
              argument.imagePosition === 'right' ? 'min-[1100px]:flex-row-reverse' : ''
            }`}
          >
            {/* Contenu texte - pleine largeur < 1100px, 50% >= 1100px */}
            <div className="w-full min-[1100px]:w-1/2 flex items-center order-1 min-[1100px]:order-none">
              <div
                className={`flex flex-col px-6 pb-3 md:py-8 min-[1100px]:py-12 w-full max-w-3xl mx-auto min-[1100px]:max-w-none min-[1100px]:mx-0 ${
                  argument.imagePosition === 'left'
                    ? 'min-[1100px]:pl-16 xl:pl-20 min-[1100px]:pr-6 xl:pr-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]'
                    : 'min-[1100px]:pr-16 xl:pr-20 min-[1100px]:pl-6 xl:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]'
                }`}
              >
                <h2 className="mb-6 text-2xl sm:text-3xl md:text-4xl min-[1100px]:text-5xl xl:text-5xl font-thunder font-medium text-gray-800">
                  {argument.title}
                </h2>
                <div className="mb-8 space-y-2 text-sm sm:text-base md:text-lg font-roboto text-gray-700">
                  {argument.description.map((line, lineIndex) => (
                    <p key={lineIndex} className={line.startsWith('-') ? 'ml-4' : ''}>
                      {line}
                    </p>
                  ))}
                </div>
                <button 
                  onClick={() => {
                    window.location.href = window.location.origin + '/#record?signup=true';
                  }}
                  className="flex w-fit items-center gap-2 rounded-full bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] px-8 py-3 text-sm sm:text-base md:text-lg font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                >
                  {showPromo ? 'Essayer gratuitement' : 'Essayez maintenant'}
                  <ArrowRight size={20} className="text-white" />
                </button>
              </div>
            </div>

            {/* Image - visible sur tous les écrans, en dessous du texte sur mobile */}
            <motion.div 
              className="w-full max-w-3xl mx-auto px-6 min-[1100px]:max-w-none min-[1100px]:mx-0 min-[1100px]:w-1/2 min-[1100px]:px-0 shrink-0 order-2 min-[1100px]:order-none"
              initial={{ 
                opacity: 0, 
                x: argument.imagePosition === 'left' ? -100 : 100 
              }}
              whileInView={{ 
                opacity: 1, 
                x: 0 
              }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ 
                duration: 0.8, 
                ease: [0.25, 0.1, 0.25, 1] 
              }}
            >
              <div
                className={`relative overflow-hidden h-[250px] sm:h-[350px] md:h-[450px] min-[1100px]:h-full ${
                  argument.imagePosition === 'left'
                    ? 'rounded-2xl min-[1100px]:rounded-tl-[250px] min-[1100px]:rounded-bl-[250px] xl:rounded-tl-[300px] xl:rounded-bl-[300px]'
                    : 'rounded-2xl min-[1100px]:rounded-tr-[250px] min-[1100px]:rounded-br-[250px] xl:rounded-tr-[300px] xl:rounded-br-[300px]'
                }`}
              >
                <img
                  src={argument.image}
                  alt={argument.title}
                  className="h-full w-full object-cover object-[center_top]"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </motion.div>
          </div>
        </div>
      ))}
    </section>
  );
}