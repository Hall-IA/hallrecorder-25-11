import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GlowingEffect } from '../ui/glowing-effect';

export interface FaqProps extends React.HTMLAttributes<HTMLDivElement> {
  question: string;
  answer: string;
  list?: string[];
  anotherAnswer?: string;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  glowColors?: {
    color1?: string;
    color2?: string;
    color3?: string;
    color4?: string;
  };
}

export function Faq({
  question,
  answer,
  className,
  list,
  anotherAnswer,
  backgroundColor = 'bg-gray-100',
  hoverBackgroundColor = 'hover:bg-gray-200',
  glowColors,
  ...props
}: Readonly<FaqProps>) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className={cn('relative p-0.5', className)} {...props}>
      <div className="relative h-full rounded-2xl border">
        <GlowingEffect
          blur={0}
          borderWidth={3}
          spread={30}
          glow={true}
          disabled={false}
          proximity={30}
          inactiveZone={0.75}
          gradientColors={glowColors}
        />

        <section className="relative overflow-hidden rounded-2xl transition-all duration-400 ease-in-out">
          <h3>
            <button
              onClick={toggleOpen}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${question.replaceAll(/\s+/g, '-').toLowerCase().substring(0, 30)}`}
              className={cn(
                'group flex w-full items-center gap-4 p-6 transition-colors duration-300 hover:cursor-pointer',
                backgroundColor,
                hoverBackgroundColor,
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              <span className="flex-1 text-left font-medium text-black">
                {question}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn('transition-transform', isOpen && 'rotate-180')}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </h3>

          <div
            id={`faq-answer-${question.replaceAll(/\s+/g, '-').toLowerCase().substring(0, 30)}`}
            role="region"
            aria-labelledby={`faq-question-${question.replaceAll(/\s+/g, '-').toLowerCase().substring(0, 30)}`}
            className={cn(
              'overflow-hidden transition-all duration-400 ease-in-out',
              isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="space-y-2 bg-white p-6">
              <p className="leading-relaxed text-gray-700">{answer}</p>
              {list && list.length > 0 && (
                <ul className="list-inside list-disc space-y-2 text-gray-700">
                  {list.map((item, id) => (
                    <li key={id}>{item}</li>
                  ))}
                </ul>
              )}
              {anotherAnswer && <p className="leading-relaxed text-gray-700">{anotherAnswer}</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}