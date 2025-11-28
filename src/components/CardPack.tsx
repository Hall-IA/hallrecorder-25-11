import { useState, useEffect } from 'react';
import CustomButton from './CustomButton';
import { Plus, Minus, BadgeCheck, HelpCircle, XCircle } from 'lucide-react';
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
  // Nouvelles props pour le compteur
  enableCounter?: boolean;
  basePrice?: number; // Prix de base (premier email)
  additionalPrice?: number; // Prix par email additionnel
  localStorageKey?: string; // Clé pour le localStorage
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
  enableCounter = false,
  basePrice = 29,
  additionalPrice = 19,
  localStorageKey = 'email_counter',
  hidePrice = false,
  classNameButton,
  className,
}: CardPackProps) {
  // État pour le compteur d'emails additionnels
  const [additionalEmails, setAdditionalEmails] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Charger depuis localStorage au montage
  useEffect(() => {
    setMounted(true);
    if (enableCounter && typeof window !== 'undefined') {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        setAdditionalEmails(parseInt(saved, 10));
      }
    }
  }, [enableCounter, localStorageKey]);

  // Sauvegarder dans localStorage quand le compteur change
  useEffect(() => {
    if (mounted && enableCounter && typeof window !== 'undefined') {
      localStorage.setItem(localStorageKey, additionalEmails.toString());
    }
  }, [additionalEmails, enableCounter, localStorageKey, mounted]);

  // Calculer le prix total
  const calculateTotalPrice = () => {
    if (!enableCounter) return price;
    const total = basePrice + additionalEmails * additionalPrice;
    return total.toString();
  };

  // Incrémenter le compteur
  const incrementCounter = () => {
    setAdditionalEmails((prev) => prev + 1);
  };

  // Décrémenter le compteur (minimum 0)
  const decrementCounter = () => {
    setAdditionalEmails((prev) => Math.max(0, prev - 1));
  };
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
        <h3 className="font-thunder mb-5 text-5xl font-medium text-black">{title}</h3>

        {subtitle && <p>{subtitle}</p>}

        <ul className="space-y-4">
          {features.map((feature, index) => (
            <li key={index} className="flex gap-2 font-medium">
              <BadgeCheck className="shrink-0" />
              <span>
                {feature.title}
                {feature.text && (
                  <p className="text-sm font-normal text-gray-600">{feature.text}</p>
                )}
              </span>
            </li>
          ))}
        </ul>

        {enableCounter && (
          <section className="space-y-2">
            <p className="mb-2 text-sm font-semibold text-gray-700">Emails additionnels</p>
            <div className="space-y-3 rounded-xl bg-gray-50">
              <div className="flex items-stretch justify-between gap-4">
                <button
                  onClick={decrementCounter}
                  disabled={additionalEmails === 0}
                  className="flex w-12 cursor-pointer items-center justify-center rounded-l-lg bg-black transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-black"
                  aria-label="Diminuer"
                >
                  <Minus className="h-5 w-5 text-white" />
                </button>

                <div className="flex flex-1 flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{additionalEmails}</span>
                  <span className="$text-gray-500 mb-2 text-xs">
                    {additionalEmails === 0
                      ? '1 email inclus'
                      : `${additionalEmails + 1} emails au total`}
                  </span>
                </div>

                <button
                  onClick={incrementCounter}
                  className="flex w-12 cursor-pointer items-center justify-center rounded-r-lg bg-black transition-all hover:bg-gray-800"
                  aria-label="Augmenter"
                >
                  <Plus className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500">
              +{additionalPrice}€ par email additionnel
            </p>
          </section>
        )}
      </div>

      {/* Ligne de séparation */}
      {!hidePrice && (
        <div
          className="relative z-20 my-10"
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
                {calculateTotalPrice()}€ <span className="text-lg font-normal">{priceUnit}</span>
              </p>

              {/* Détail du prix si compteur activé */}
              {enableCounter && additionalEmails > 0 && (
                <p className="text-sm text-gray-500">
                  {basePrice}€ (base) + {additionalEmails * additionalPrice}€ ({additionalEmails}{' '}
                  email
                  {additionalEmails > 1 ? 's' : ''} additionnel{additionalEmails > 1 ? 's' : ''})
                </p>
              )}
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
          className={cn('w-full rounded-full!', classNameButton)}
          onClick={onButtonClick}
          href={buttonHref}
          target={buttonHref && buttonHref.startsWith('http') ? '_blank' : undefined}
        >
          {buttonText}
        </CustomButton>
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
