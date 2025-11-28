import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import TestimonialCarousel from "@/components/TestimonialCarousel";



export default function TestimonialSection() {
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
    <section className="flex flex-col items-center justify-center gap-28 bg-[#F9F7F5] py-32">
      <motion.h2
        className="font-thunder text-5xl font-medium"
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
        Nos clients en parlent
      </motion.h2>
      <motion.div
        className="w-full"
        ref={fadeInRef}
        animate={fadeInInView ? 'animate' : 'initial'}
        variants={fadeUpVariants}
        initial={false}
        transition={{
          duration: 0.6,
          delay: 0.4,
          ease: [0.21, 0.47, 0.32, 0.98],
          type: 'spring',
        }}
      >
        <TestimonialCarousel />
      </motion.div>
    </section>
  );
}
