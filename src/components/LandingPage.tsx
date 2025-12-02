import HowItWorkSection, { ListItem } from './HowItWorkSection';
import AppPack from './home/AppPack';
import ArgumentsSection from './home/ArgumentsSection';
import BigTestimonial from './home/BigTestimonial';
import CTASection from './home/CTASection';
import { FaqSection } from './home/FaqSection';
import Hero from './home/Hero';
import ProductivitySection from './home/ProductivitySection';
import TestimonialSection from './home/TestimonialSection';
import Footer from './layout/Footer';
import NavBar from './layout/NavBar';

interface LandingPageProps {
  onGetStarted: () => void;
}

const sampleVideoItems: ListItem[] = [
  {
    id: '1',
    title: 'Enregistrez vos réunions à tout moment',
    description: "Démarrez l'enregistrement d'un simple clic et laissez HALL RECORDER capturer chaque mot, chaque idée, chaque décision.",
    videoUrl: '/assets/img/reception-email-item1.png',
    alt: "Interface de tri automatique d'emails par IA - Gestion intelligente de boîte mail professionnelle",
    keywords: [
      'tri emails automatique',
      'gestion boîte mail IA',
      'filtrage emails intelligent',
      'automatisation messagerie',
      'productivité email',
    ],
    category: 'Communication et Messagerie',
  },
  {
    id: '2',
    title: 'Prompteur instantané et intelligent',
    description: 'qui met en évidence les points à clarifier et les sujets à approfondir.',
    videoUrl: '/assets/img/analyse-classification-item2.png',
    alt: "Image de l'analyse et classification des emails",
    keywords: [
      'analyse email IA',
      'classification email IA',
      'scan email IA',
      'tri email IA',
      'context email IA',
      'expéditeur email IA',
      'automatisation email IA',
      'productivité email IA',
      'gestion email IA',
    ],
    category: 'Automatisation et Productivité',
  },
  {
    id: '3',
    title: 'Synthèse intelligente',
    description: `comprenant :\nContexte / Besoins / Décisions \net Actions à mener\n \n- Synthèse disponible en PDF et prêt à être envoyé par e-mail directement depuis l’application, pour partager avec votre équipe ou vos clients.\n- Audio téléchargeable à tout moment pour archivage ou réécoute.`,
    videoUrl: '/assets/img/generation-reponse.png',
    alt: 'Outil IA de transcription de réunions - Résumé automatique et compte-rendu intelligent',
    keywords: [
      'génération de réponse email IA',
      'brouillon email IA',
      'personnalisation email IA',
      'adaptation email IA',
      'automatisation email IA',
      'productivité email IA',
      'gestion email IA',
    ],
    category: 'Productivité et Collaboration',
  },
  {
    id: '4',
    title: 'Validation Humaine',
    description: "Vous validez ou modifiez avant l'envoi.",
    videoUrl: '/assets/img/validation-email.png',
    alt: 'Système automatisé de gestion de factures - Création, relance et suivi comptable par IA',
    keywords: [
      'validation email IA',
      'modification email IA',
      'envoi email IA',
      'automatisation email IA',
      'productivité email IA',
      'gestion email IA',
    ],
    category: 'Communication et Messagerie',
  },
];

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  return (
    <>
    <NavBar />
    <section className="space-y-30 overflow-x-hidden">
      <Hero />
      <section id="avantages">
        <ArgumentsSection />
        </section>
      <section id="etapes" className="hidden lg:block lg:mb-90">
        <ProductivitySection />
      </section>
      <section>
        <section id="prix">
          <AppPack />
        </section>
        <BigTestimonial />
        <TestimonialSection />
        <FaqSection />
        <CTASection />
      </section>
    </section>
    <Footer />
    </>
  );
};
