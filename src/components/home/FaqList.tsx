import { cn } from "@/lib/utils";
import { Faq, FaqProps } from "./Faq";

interface FaqListProps {
  faqs: FaqProps[];
  className?: string;
  gradientFrom?: string;
  gradientTo?: string;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  // ✅ Couleurs pour le GlowingEffect
  glowColors?: {
    color1?: string;
    color2?: string;
    color3?: string;
    color4?: string;
  };
}

export function FaqList({ 
  faqs, 
  className,
  gradientFrom,
  gradientTo,
  backgroundColor,
  hoverBackgroundColor,
  glowColors, // ✅ Reçoit les couleurs du glow
}: Readonly<FaqListProps>) {
  return (
    <section className={cn('w-full', className)} aria-labelledby="faq-heading">
      <div className={cn('flex flex-col gap-4')}>
        {faqs.map((faq, index) => (
          <Faq
            key={faq.question.substring(0, 50) || index}
            question={faq.question}
            answer={faq.answer}
            list={faq.list}
            anotherAnswer={faq.anotherAnswer}
            backgroundColor={backgroundColor}
            hoverBackgroundColor={hoverBackgroundColor}
            glowColors={glowColors} // ✅ Propage les couleurs
            className="h-full w-full"
          />
        ))}
      </div>
    </section>
  );
}