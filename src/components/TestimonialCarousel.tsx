import { Fragment, useEffect, useRef, useState } from 'react';
import { Marquee } from './ui/marquee';

const testimonials = [
  {
    name: 'StratéNova Consulting',
    role: 'Cabinet de Conseil (Paris, FR)',
    image: '/assets/img/profil-julie.png',
    title: 'Transformation digitale & performance des organisations - 45 consultants',
    text: `StratéNova accompagne des entreprises dans leurs projets de modernisation. Ils utilisent Hall-IA Réunion pour standardiser leurs comptes rendus et fluidifier la transmission d'information entre consultants et directeurs de mission.`,
  },
  {
    name: 'Construxia',
    role: 'Construction & Ingénierie (Lyon, FR)',
    image: '/assets/img/profil-benjamin.png',
    title:"Gestion de chantiers, ingénierie civile et rénovation - 120 collaborateurs",
    text: "Construxia s’appuie sur Hall-IA Réunion pour fiabiliser les réunions de chantier, assurer le suivi des décisions et réduire les risques liés aux erreurs de communication entre équipes terrain et bureau d’études.",
  },
  {
    name: 'E-Shopia Market',
    role: 'E-commerce & Retail (Lille, FR)',
    image: '/assets/img/profil-andrée.webp',
    title:'Vente en ligne & marketing multicanal - 30 collaborateurs',
    text:"E-Shopia utilise Hall-IA Réunion pour structurer ses réunions marketing, suivre plus efficacement ses projets et centraliser tout l’historique des décisions concernant les campagnes.  "
  },
  {
    name: 'RemoteFlow Digital',
    role: ' Entreprise 100 % Télétravail (Europe)',
    image: '/assets/img/person1.png',
    title:'Solutions digitales & gestion de projets à distance - 28 collaborateurs répartis sur 6 pays',
    text: "RemoteFlow fait confiance à Hall-IA Réunion pour synchroniser des équipes distribuées, créer des comptes rendus automatiques et réduire drastiquement les réunions redondantes.",
  },
  {
    name: 'Mediaspark Studio.',
    role: "Agence Créative (Montréal, CA)",
    image: '/assets/img/person2.webp',
    title:'Design, production digitale & storytelling de marque - 18 créatifs',
    text: "Mediaspark utilise Hall-IA pour capturer les réunions créatives, conserver toutes les idées, et partager rapidement des synthèses structurées avec les équipes clients."
  },
  {
    name: 'JurisLine Associés',
    role: 'Cabinet d’Avocats (Bruxelles, BE)',
    image: '/assets/img/person3.jpg',
    title:'Droit des affaires & contrats internationaux - 22 avocats',
    text: "Ils s’appuient sur Hall-IA Réunion pour générer des comptes rendus fidèles, sécurisés et conformes, facilitant la préparation des dossiers et la coordination interne entre avocats.",
  },
];

function Testimonial({
  name,
  role,
  image,
  title,
  text,
}: Readonly<{
  name: string;
  role: string;
  image: string;
  title?: string;
  text: string;
}>) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <article
      className="group flex w-[350px] flex-shrink-0 flex-col items-center  transition-all hover:scale-105 lg:w-[470px]"
      aria-labelledby={`testimonial-${name.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div
        className="relative z-10 mt-2 -mb-8 h-16 w-16 overflow-hidden rounded-full bg-[#DBD8D5]"
        aria-hidden="true"
      >
        <img
          src={image}
          alt={`Portrait de ${name}`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <figure
        className="mb-10 flex flex-col items-center justify-center gap-6 rounded-xl border bg-white p-8 shadow-lg hover:cursor-pointer lg:p-10"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? `Réduire le témoignage de ${name}` : `Lire le témoignage complet de ${name}`
        }
      >
        <figcaption className="text-lg">
          <h3
            id={`testimonial-${name.replace(/\s+/g, '-').toLowerCase()}`}
            className="font-semibold text-[#FF9A34] text-center"
          >
            {name}
          </h3>
          <p className="text-[#191918] text-center">{role}</p>
        </figcaption>

        <blockquote className="relative overflow-hidden text-[#858381]">
          <div
            className={`transition-all duration-500 ease-in-out ${
              isExpanded ? 'max-h-[500px]' : 'max-h-24'
            }`}
          >
            {title && (
              <p className="mb-2 font-medium ">{title}</p>
            )}
            <p className="font-normal">{text}</p>
          </div>
          <div
            className={`pointer-events-none absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-500 ${
              isExpanded ? 'opacity-0' : 'opacity-100'
            }`}
            aria-hidden="true"
          ></div>
        </blockquote>
      </figure>
    </article>
  );
}

export default function TestimonialCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollAmount = 420;

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const newScrollLeft =
        direction === 'left'
          ? Math.max(0, container.scrollLeft - scrollAmount)
          : Math.min(maxScrollLeft, container.scrollLeft + scrollAmount);

      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Fragment>
      {/* Desktop */}
      <section
        className="hidden w-full lg:block"
        aria-labelledby="testimonials-heading"
        role="region"
      >
        <h2 id="testimonials-heading" className="sr-only">
          Nos clients en parlent
        </h2>

        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          {/* Gradient gauche */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/4 bg-gradient-to-r from-[#F9F7F5] to-transparent" />

          {/* Gradient droite */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/4 bg-gradient-to-l from-[#F9F7F5] to-transparent" />

          {/* Marquee avec les témoignages */}
          <Marquee pauseOnHover className="[--duration:40s] [--gap:2.5rem]">
            {testimonials.map((testimonial, index) => (
              <Testimonial key={index} {...testimonial} />
            ))}
          </Marquee>
        </div>
      </section>

      {/* Mobile */}
      <section className="w-full lg:hidden" aria-labelledby="testimonials-heading" role="region">
        <h2 id="testimonials-heading" className="sr-only">
          Nos clients en parlent
        </h2>

        <div className="flex flex-col">
          {/* Carousel */}
          <div
            ref={scrollRef}
            className="scrollbar-hide relative flex snap-x snap-mandatory gap-10 overflow-x-auto overflow-y-hidden scroll-smooth"
            role="list"
            aria-label="Liste des témoignages clients"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                role="listitem"
                className="shrink-0 snap-center first:ms-24 last:me-24"
              >
                <Testimonial {...testimonial} />
              </div>
            ))}
          </div>

          <nav
            className="flex w-full justify-center gap-10"
            aria-label="Navigation du carrousel de témoignages"
          >
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`cursor-pointer rounded-full bg-white p-3 shadow-lg transition-colors ${
                !canScrollLeft ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-50'
              }`}
              aria-label="Voir le témoignage précédent"
              type="button"
            >
              <svg
                className="h-6 w-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`cursor-pointer rounded-full bg-white p-3 shadow-lg transition-colors ${
                !canScrollRight ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-50'
              }`}
              aria-label="Voir le témoignage suivant"
              type="button"
            >
              <svg
                className="h-6 w-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </nav>
        </div>
      </section>
    </Fragment>
  );
}