import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BigTestimonialData {
  name: string;
  location: string;
  info: string[];
  activity: string;
  improvement: string;
  image: string;
}

const bigTestimonials: BigTestimonialData[] = [
  {
    name: `Entreprise Consulting`,
    location: `Europe`,
    info: [`Secteur : Solutions numériques / Équipes distribuées`, `Entreprise 100% télétravail`],
    activity: `Avec une équipe répartie sur 6 pays et 4 fuseaux horaires, nos réunions étaient souvent longues et difficiles à synthétiser. Nous avions régulièrement des pertes d'information entre les managers et les équipes opérationnelles. Depuis que nous utilisons Hall-IA Réunion, chaque meeting — même court — est automatiquement enregistré, transcrit et résumé. Les actions sont claires, les décisions visibles par tous, et la communication est beaucoup plus fluide.`,
    improvement: ` • Une transparence totale pour les équipes décalées dans le temps. \n  • Des comptes rendus instantanés pour les collaborateurs qui n'ont pas pu assister à la réunion. \n  • Une prise de décision plus rapide malgré les fuseaux horaires. \n  • Une centralisation parfaite des informations : tout est dans l'historique. \n  • Une communication interne plus structurée dans un contexte d'équipe distribuée. \n \n   Résultat : réduction de 40% des réunions redondantes et meilleure coordination sur tous les projets.`,
    image: `/assets/img/first-testimonial.png`,
  },
  {
    name: `Groupe Construxia`,
    location: `Lyon`,
    info: [`Secteur : Travaux & Chantier`, `Entreprise de BTP / Construction`],
    activity: `Avec une équipe répartie sur 6 pays et 4 fuseaux horaires, nos réunions étaient souvent longues et difficiles à synthétiser. Nous avions régulièrement des pertes d'information entre les managers et les équipes opérationnelles. Depuis que nous utilisons Hall-IA Réunion, chaque meeting — même court — est automatiquement enregistré, transcrit et résumé. Les actions sont claires, les décisions visibles par tous, et la communication est beaucoup plus fluide.`,
    improvement: ` • Une précision accrue malgré les réunions en extérieur. \n  • Un suivi parfait des actions entre architectes, ingénieurs et conducteurs de travaux. \n  • Moins de retards liés à une mauvaise transmission d'information. \n  • Une preuve écrite des décisions importantes en cas de litige technique. \n \n Résultat : réduction de 17% des erreurs opérationnelles.`,
    image: `/assets/img/second-testimonial.png`,
  },
  {
    name: `Cabinet StratéNova Consulting`,
    location: `Lille, France`,
    info: [`Secteur : Solutions numériques / Équipes distribuées`, `Cabinet de conseil en management`],
    activity: `Dans notre activité de conseil, chaque réunion client génère une quantité énorme d'informations. Avant Hall-IA Réunion, nos consultants passaient parfois plus d'une heure à rédiger des comptes rendus détaillés. Aujourd'hui, l'outil transcrit automatiquement nos échanges, identifie les décisions clés et génère des comptes rendus exploitables en quelques minutes.`,
    improvement: `•  1h30 de gagné par consultant et par réunion stratégique \n  •  Des comptes rendus uniformisés, indispensables pour la continuité des missions \n  •  Une meilleure traçabilité entre les équipes projet et les directeurs de mission \n  •  Un archivage clair permettant de trouver une décision en quelques secondes. \n \n Résultat : +22% de productivité sur les missions longues.`,
    image: `/assets/img/third-testimonial.png`,
  }
];

export default function BigTestimonial() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % bigTestimonials.length);
  }, []);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + bigTestimonials.length) % bigTestimonials.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, goToNext]);

  return (
    <section 
      className="relative hidden lg:block w-full" 
      aria-roledescription="carousel"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Carousel wrapper */}
      <div className="relative h-[600px] overflow-hidden  md:h-[700px] lg:h-[800px]">
        {bigTestimonials.map((testimonial, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              index === currentIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={index !== currentIndex}
          >
            <div className="relative h-full overflow-hidden ">
              {/* COUCHE 1 : Background Image */}
              <img
                src={testimonial.image}
                alt={testimonial.name}
                className="absolute bottom-0 left-1/2 h-[800px] w-auto -translate-x-[45%]"
              />

              {/* COUCHE 2 : Overlay */}
              <div className="absolute inset-0 bg-[#C1A991]/65" />

             

              {/* COUCHE 4 : Contenu */}
              <div className="relative z-10 flex h-full flex-col justify-between px-6 pt-40 font-roboto text-white md:px-12 lg:px-20">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 md:flex-row md:justify-between">
                  {/* Première colonne */}
                  <div className="flex w-full flex-col md:w-[45%]">
                    <img src="/assets/img/quote.png" alt="" className="mb-6 h-10 w-10" />
                    
                    <div className="mb-6">
                      <p className="text-sm ">{testimonial.activity}</p>
                    </div>

                    <div className="rounded-lg bg-gray-500/30 p-4 backdrop-blur-md">
                      <h3 className="mb-2 text-sm font-extralight italic">
                        Ce que Hall-IA leur a apporté :
                      </h3>
                      <p className="whitespace-pre-line text-sm">
                        {testimonial.improvement}
                      </p>
                    </div>
                  </div>

                  {/* Deuxième colonne */}
                  <div className="relative flex w-full flex-col md:w-[30%]">
  {/* Guillemet en arrière-plan de cette colonne */}
  {/* <span 
    className="pointer-events-none absolute -bottom-20 -right-10 select-none font-roboto text-[700px] leading-none text-[#FF9A34] opacity-30 md:text-[400px] lg:text-[900px]"
    aria-hidden="true"
  >
    ”
  </span> */}

  {/* Contenu de la colonne (au-dessus du guillemet) */}
  <div className="relative z-10">
    <h2 className="mb-4 mt-16 text-4xl font-semibold md:text-5xl lg:text-6xl">
      {testimonial.name}
    </h2>
    <p className="mb-6 text-xl font-light text-white/90 md:text-2xl">
      {testimonial.location}
    </p>

    <div className="flex flex-col gap-3">
      {testimonial.info.map((item, i) => (
        <span
          key={i}
          className="w-fit rounded-2xl bg-gray-500/30 px-4 py-2 text-sm backdrop-blur-sm md:text-sm"
        >
          {item}
        </span>
      ))}
    </div>
  </div>
</div>
                </div>

                {/* Index de pagination en bas */}
                <div className="mx-auto flex w-full max-w-6xl items-center justify-start pb-5 text-[#333231] gap-[24px]">
                  <ChevronLeft className="h-10 w-10 cursor-pointer" />
                  <span className="text-sm ">
                    <span className="text-6xl font-medium">{String(currentIndex + 1).padStart(2, '0')}</span>/{String(bigTestimonials.length).padStart(2, '0')}
                  </span>
                  <ChevronRight className="h-10 w-10 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slider indicators */}
      <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 space-x-3">
        {bigTestimonials.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goToSlide(index)}
            className={`h-3 rounded-full transition-all ${
              index === currentIndex ? 'w-8 bg-white' : 'w-3 bg-white/50 hover:bg-white/75'
            }`}
            aria-current={index === currentIndex}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Slider controls */}
      <button
        type="button"
        onClick={goToPrevious}
        className="group absolute left-0 top-1/2 z-30 flex h-full -translate-y-1/2 cursor-pointer items-center justify-center px-4 focus:outline-none"
        aria-label="Précédent"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/30 group-hover:bg-white/50 group-focus:ring-4 group-focus:ring-white/70">
          <ChevronLeft className="h-5 w-5 text-white" />
        </span>
      </button>

      <button
        type="button"
        onClick={goToNext}
        className="group absolute right-0 top-1/2 z-30 flex h-full -translate-y-1/2 cursor-pointer items-center justify-center px-4 focus:outline-none"
        aria-label="Suivant"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/30 group-hover:bg-white/50 group-focus:ring-4 group-focus:ring-white/70">
          <ChevronRight className="h-5 w-5 text-white" />
        </span>
      </button>
    </section>
  );
}