import React from 'react';
import { Hourglass, ThumbsUp, Clock, GitFork } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  iconMobile?: React.ReactNode;
  title: string;
  text: string;
}

function FeatureCard({ icon, iconMobile, title, text }: FeatureCardProps) {
  return (
    <div
      className="flex items-center gap-2 md:gap-4 rounded-lg border overflow-hidden w-full max-w-[282px] h-[120px] md:h-[180px]"
      style={{
        padding: '12px 6px',
        border: '1px solid #FEFDFD',
        borderRadius: '8px',
        background: `conic-gradient(from 194deg at 84% -3.1%, #FF9A34 0deg, #F35F4F 76.15384697914124deg, #CE7D2A 197.30769395828247deg, #FFAD5A 245.76922416687012deg), rgba(249, 247, 245, 0.64)`,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Icône avec effet de fondu sur la gauche */}
      <div className="hidden sm:flex items-center justify-center flex-shrink-0">
        <div
          className="relative"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.1) 5%, rgba(255,255,255,0.2) 15%,rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.6) 55%,  rgba(255,255,255,0.8) 65%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,1) 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.1) 5%, rgba(255,255,255,0.2) 15%,rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.6) 55%,  rgba(255,255,255,0.8) 65%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,1) 100%)',
          }}
        >
          {icon}
        </div>
      </div>

      {/* Icône mobile centrée */}
      {iconMobile && (
        <div className="flex items-center justify-center sm:hidden flex-shrink-0">
          <div className="scale-75">
            {iconMobile}
          </div>
        </div>
      )}

      {/* Contenu à droite */}
      <div
        className="flex flex-col items-center justify-center text-center flex-1"
      >
        <h3
          className="font-roboto font-semibold"
          style={{
            color: '#FFFEFD',
            textAlign: 'center',
            fontSize: 'clamp(14px, 3.5vw, 24px)',
            fontWeight: 600,
            lineHeight: 'normal',
            marginBottom: '2px',
          }}
        >
          {title}
        </h3>
        <p
          className="font-roboto px-1 md:px-2"
          style={{
            color: '#FFFEFD',
            textAlign: 'center',
            fontSize: 'clamp(10px, 2.5vw, 16px)',
            fontWeight: 400,
            lineHeight: '1.2',
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

export default function FeatureCards() {
  const features = [
    {
      icon: <Hourglass size={80} className="text-white hidden sm:block md:block" />,
      iconMobile: <Hourglass size={40} className="text-white sm:hidden" />,
      title: '100%',
      text: "Collecte toutes les informations clés de vos réunions.",
    },
    {
      icon: <ThumbsUp size={80} className="text-white hidden sm:block md:block" />,
      iconMobile: <ThumbsUp size={40} className="text-white sm:hidden" />,
      title: '15s',
      text: 'Génère un compte rendu PDF en quelques secondes.',
    },
    {
      icon: <Clock size={80} className="text-white hidden sm:block md:block" />,
      iconMobile: <Clock size={40} className="text-white sm:hidden" />,
      title: '24/7',
      text: 'Tourne en continu sans intervention humaine.',
    },
    {
      icon: <GitFork size={80} className="text-white hidden sm:block md:block" />,
      iconMobile: <GitFork size={40} className="text-white sm:hidden" />,
      title: '0 réunion',
      text: 'Laissée sans compte rendu exhaustif et exploitable.',
    },
  ];

  return (
    <div
      className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-2 px-4 sm:px-0"
      style={{
        gap: '8px',
      }}
    >
      {features.map((feature, index) => (
        <FeatureCard
          key={index}
          icon={feature.icon}
          iconMobile={feature.iconMobile}
          title={feature.title}
          text={feature.text}
        />
      ))}
    </div>
  );
}

