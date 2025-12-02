import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function CTASection() {
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
      className="font-roboto py-36 text-white"
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
      aria-labelledby="cta-heading"
    >
      <motion.div
        className="mx-auto flex flex-col items-center justify-between gap-6 md:max-w-[1000px] md:flex-row md:px-6 lg:px-0"
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
        <div className="space-y-4">
          <h2 id="cta-heading" className="font-thunder text-5xl font-medium">
            Prêt à commencer ?
          </h2>
          <p>Demandez un audit ou envoyez un message</p>
        </div>
        <a
          href="https://calendly.com/contact-hallia/30min"
          className="inline-block rounded-full bg-white px-6 py-4 transition-all hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#F97E41]"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Réserver un rendez-vous sur Calendly - Ouvre dans un nouvel onglet"
        >
          <span className="bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] bg-clip-text font-semibold text-transparent">
            Je me lance
          </span>
        </a>
      </motion.div>
    </section>
  );
}
