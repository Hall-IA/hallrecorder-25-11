import { useState } from 'react';
import CustomButton from './CustomButton';
import { BadgeCheck, HelpCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  title: string;
  text?: string;
}

interface CardPackProps {
  title: string;
  subtitle?: string;
  features: Feature[];
  price?: string;
  priceUnit?: string;
  buttonText: string;
  buttonGradient?: string;
  topGradient?: string;
  onButtonClick?: () => void;
  buttonHref?: string;
  hidePrice?: boolean; // Masquer le prix et le hr dotted
  classNameButton?: string;
  className?: string;
}

export default function CardPack({
  title,
  subtitle,
  features,
  price,
  priceUnit,
  buttonText,
  buttonGradient = `conic-gradient(
    from 195.77deg at 84.44% -1.66%,
    #FE9736 0deg,
    #F4664C 76.15deg,
    #F97E41 197.31deg,
    #E3AB8D 245.77deg,
    #FE9736 360deg
  )`,
  topGradient = `radial-gradient(
    ellipse 90% 90% at 50% 0%,
    #FE9736 0%,
    #F97E41 50%,
    #F4664C 50%,
    transparent 80%
  )`,
  onButtonClick,
  buttonHref,
  hidePrice = false,
  classNameButton,
  className,
}: CardPackProps) {
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  return (
    <div className={cn("font-roboto relative flex w-full flex-col justify-between overflow-hidden rounded-2xl bg-white", className)}>
      {/* Gradient blur en haut */}
      <div
        className="pointer-events-none absolute -top-12 right-0 left-0 z-10 h-[200px] w-full rounded-t-2xl blur-xl"
        style={{
          background: topGradient,
        }}
      />


      {/* Section titre et features */}
      <div className="relative z-20 space-y-5 px-10 pt-30 pb-0">
        <h3 className="font-thunder mb-5 lg:text-5xl text-4xl font-medium text-black whitespace-pre-line">{title}</h3>

        {subtitle && <p>{subtitle}</p>}

        <ul className="space-y-4">
          {features.map((feature, index) => (
            <li key={index} className="flex gap-2 font-medium">
              <BadgeCheck className={`shrink-0 ${index === 0 ? '' : ''}`} style={index === 0 ? { color: '#00A63E' } : {}} />
              <span style={index === 0 ? { color: '#00A63E' } : {}}>
                {feature.title}
                {feature.text && (
                  <p className="text-sm font-normal text-gray-600">{feature.text}</p>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Section prix et bouton */}
      <div className="relative z-20  pb-10">
        {/* Ligne de séparation */}
        {!hidePrice && (
          <div
            className="relative z-20 my-5"
            style={{
              height: '1px',
              backgroundImage:
                'linear-gradient(to right, #d1d5db 0%, #d1d5db 50%, transparent 50%, transparent 100%)',
              backgroundSize: '20px 1px',
              backgroundRepeat: 'repeat-x',
            }}
          />
        )}

      {/* Section prix et bouton */}
      <div className="relative z-20 space-y-5 px-10 pb-10">
        {/* Prix */}
        {!hidePrice && (
          <div className="flex flex-col w-full gap-4">
              <p className="font-thunder text-4xl font-medium">
                {price}€ <span className="text-lg font-normal">{priceUnit}</span>
              </p>
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="flex cursor-pointer items-center gap-1 text-gray-600 transition-colors hover:text-gray-800"
            >
              <span className="text-sm">Sans engagement</span>
              <HelpCircle className="h-4 w-5" />
            </button>
          </div>
        )}

        <CustomButton
          style={{
            background: buttonGradient,
          }}
          className={cn('w-full !rounded-full', classNameButton)}
          onClick={onButtonClick}
          href={buttonHref}
          target={buttonHref && buttonHref.startsWith('http') ? '_blank' : undefined}
        >
          {buttonText}
        </CustomButton>
        </div>
      </div>

      {/* Modal Conditions d'abonnement */}
      {showSubscriptionModal && (
        <div
          className="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-300"
          onClick={() => setShowSubscriptionModal(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Conditions d'abonnement</h2>
              </div>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="group flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-200/50 transition-all duration-300 hover:bg-gray-300"
              >
                <XCircle className="h-5 w-5 text-black transition-transform duration-300 group-hover:scale-110" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-6 p-6">
              <p className="text-base text-gray-700">
                Nos applications sont disponibles sous forme d'abonnement mensuel ou annuel, selon
                les conditions ci-dessous.
              </p>

              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">1. Durée et reconduction</h3>
                  <p className="text-base text-gray-700">
                    Chaque abonnement, qu'il soit mensuel ou annuel, est conclu pour la durée
                    initialement choisie par le client. À l'issue de cette période, l'abonnement se
                    renouvelle automatiquement par tacite reconduction pour une durée identique,
                    sauf résiliation préalable du client.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">2. Paiement</h3>
                  <p className="mb-2 text-base text-gray-700">
                    <strong>Abonnement mensuel :</strong> le montant est facturé et payable d'avance
                    chaque mois.
                  </p>
                  <p className="text-base text-gray-700">
                    <strong>Abonnement annuel :</strong> le montant est facturé et payable d'avance
                    pour une période de 12 mois.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">3. Résiliation</h3>
                  <p className="mb-2 text-base text-gray-700">
                    Le client peut demander la résiliation de son abonnement à tout moment.
                  </p>
                  <p className="mb-2 text-base text-gray-700">
                    Pour un abonnement mensuel, la résiliation prend effet à la fin du mois en
                    cours.
                  </p>
                  <p className="mb-2 text-base text-gray-700">
                    Pour un abonnement annuel, la résiliation prend effet à la fin de la période
                    annuelle en cours.
                  </p>
                  <p className="text-base text-gray-700">
                    Aucun remboursement, même partiel, ne sera effectué pour une période déjà
                    commencée, les abonnements étant payables d'avance.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">
                    4. Modalités d'annulation
                  </h3>
                  <p className="mb-2 text-base text-gray-700">
                    La demande de résiliation peut être effectuée :
                  </p>
                  <ul className="ml-4 list-inside list-disc space-y-1 text-base text-gray-700">
                    <li>Depuis l'espace client</li>
                  </ul>
                  <p className="mt-2 text-base text-gray-700">
                    Une confirmation de résiliation sera envoyée par email. Pour éviter le
                    renouvellement automatique, la résiliation doit être faite avant la date
                    d'échéance de la période en cours.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">5. Réactivation</h3>
                  <p className="text-base text-gray-700">
                    Le client peut réactiver son abonnement à tout moment en souscrivant à nouveau
                    via la plateforme.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
