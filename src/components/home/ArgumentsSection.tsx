import { ArrowRight } from 'lucide-react';

interface ArgumentItem {
  title: string;
  description: string[];
  image: string;
  imagePosition: 'left' | 'right';
}

const argumentsData: ArgumentItem[] = [
  {
    title: 'Assistant WhatsApp spécialisé en SAV',
    description: [
      'Notre chatbot répond comme un technicien SAV : diagnostic, procédures, étapes de résolution, conseils, redirections.',
    ],
    image: '/assets/img/first-argument.png',
    imagePosition: 'left',
  },
  {
    title: 'Base de connaissances illimitée',
    description: [
      'Regroupez vos:',
      '- fiches techniques',
      '- notices PDF',
      '- procédures internes',
      '- liens de votre site web',
      "L'IA consulte et fournit des réponses fiables, sourcées et cohérentes.",
    ],
    image: '/assets/img/second-argument.png',
    imagePosition: 'right',
  },
  {
    title: 'Gestion intégrée des tickets',
    description: [
      'Chaque demande complexe se transforme automatiquement en ticket :',
      '- statut (ouvert, en cours, résolu)',
      '- priorité (normale, urgente)',
      '- historique complet',
      '- alertes email',
      'Idéal pour les équipes techniques.',
    ],
    image: '/assets/img/third-argument.png',
    imagePosition: 'left',
  },
  {
    title: 'Inbox WhatsApp professionnelle',
    description: [
      'Une vue claire de toutes les conversations :',
      '- statut en direct',
      '- historique complet',
      '- tri par client, date, urgence.',
    ],
    image: '/assets/img/fourth-argument.png',
    imagePosition: 'right',
  },
];

export default function ArgumentsSection() {
  return (
    <section className="font-roboto w-full py-20">
      {argumentsData.map((argument, index) => (
        <div key={index} className="relative mb-20 last:mb-0 md:mb-32">
          <div className="">
            <div
              className={`flex flex-col items-center gap-8 md:flex-row md:gap-12 ${
                argument.imagePosition === 'right' ? 'md:flex-row-reverse' : ''
              }`}
            >
              {/* Contenu texte - reste dans le container */}
              <div
                className={`flex w-full flex-col md:w-1/2 ${
                  argument.imagePosition === 'right' ? 'md:mr-50' : 'md:ml-50'
                }`}
              >
                <h2 className="mb-6 text-4xl font-thunder font-medium text-gray-800 md:text-5xl lg:text-6xl md:max-w-[600px]">
                  {argument.title}
                </h2>
                <div className="mb-8 space-y-2 text-lg font-roboto text-gray-700 md:max-w-[600px] ">
                  {argument.description.map((line, lineIndex) => (
                    <p key={lineIndex} className={line.startsWith('-') ? 'ml-4' : ''}>
                      {line}
                    </p>
                  ))}
                </div>
                <button
                  className="flex w-fit items-center gap-2 rounded-full bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                >
                  Essayer gratuitement
                  <ArrowRight size={20} className="text-white" />
                </button>
              </div>

              {/* Image */}
              <div className="relative w-full md:w-1/2">
                <div
                  className={`relative overflow-hidden ${
                    argument.imagePosition === 'left'
                      ? 'rounded-tl-[200px] rounded-bl-[200px]'
                      : 'rounded-tr-[200px] rounded-br-[200px]'
                  }`}
                >
                  <img
                    src={argument.image}
                    alt={argument.title}
                    className="h-auto w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

