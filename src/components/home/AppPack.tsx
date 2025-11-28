
import { useState, useMemo } from 'react';
import { LoginModal } from '../LoginModal';
import { BadgeCheck, HelpCircle, XCircle } from 'lucide-react';
import CustomButton from '../CustomButton';
import CardPack from '../CardPack';

export default function AppPack() {
  // Utiliser l'API native URLSearchParams au lieu de react-router-dom
  const showFreeTrial = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('promo') === 'true';
  }, []);
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  
  const handleStartClick = (planType: string) => {
    setSelectedPlan(planType);
    localStorage.setItem('selected_plan', planType);
    setShowLoginModal(true);
  };

  const handleSignupSuccess = (userId: string) => {
    setShowLoginModal(false);
  };

  return (
    <section className="relative flex w-full flex-col items-center overflow-hidden px-4 py-16">
      <img
        src="/assets/img/shape-yellow.png"
        alt=""
        width={400}
        height={400}
        className="absolute -top-5 -left-30 -z-10 rotate-35 max-lg:hidden"
        aria-hidden="true"
        loading="lazy"
      />

      <h2 className="font-thunder mb-16 text-center text-5xl font-medium md:text-7xl lg:mt-10">
        Essayer, et commencez aujourd'hui
      </h2>

      <section className="flex w-full max-w-7xl flex-col justify-center gap-8 lg:flex-row">
        {/* Essai Gratuit */}
        {showFreeTrial && (
          <div
            className="flex w-full flex-col justify-between rounded-2xl lg:w-96"
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
          >
            <div className="space-y-5 px-10 pt-30 pb-10">
              <h3 className="font-thunder mb-5 text-5xl font-medium text-white">Essai Gratuit</h3>
              <p className="font-roboto text-white">
                Testez notre solution gratuitement, c'est{' '}
                <span
                  className="cursor-pointer underline underline-offset-2 hover:font-medium"
                  onClick={() => setShowSubscriptionModal(true)}
                >
                  sans engagement !
                </span>
              </p>
              <ul className="space-y-4 text-white">
                <li className="flex gap-2">
                  <BadgeCheck className="shrink-0" />
                  <span>
                    <p className="font-semibold">1 compte email</p>
                    <p className="text-sm font-normal">
                      Accès à l'ensemble des fonctionnalités de la solution Business
                    </p>
                  </span>
                </li>
                <li className="flex gap-2">
                  <BadgeCheck className="shrink-0" />
                  <p className="font-semibold">Activez votre essai avec le code promo</p>
                </li>
              </ul>
              <CustomButton
                onClick={() => handleStartClick('free_trial')}
                className="animate-fade-in-left-long w-full rounded-full! bg-white px-6 py-3 text-base font-medium text-orange-500! shadow-lg transition-colors hover:bg-white/20 hover:text-white! sm:w-auto sm:px-7 sm:py-3.5 sm:text-lg md:px-8 md:py-4 md:text-xl"
              >
                Commencer
              </CustomButton>
            </div>
            <div className="flex justify-end">
              <img
                className="rounded-2xl"
                width={600}
                height={400}
                src="/img/femme-pack.png"
                alt=""
              />
            </div>
          </div>
        )}

        <CardPack
          title="Business"
          subtitle="L'automatisation de votre boîte mail, sans engagement"
          features={[
            { title: '1 compte mail inclus' },
            {
              title: 'Classification intelligente de vos emails',
            },
            {
              title:
                "Réponses générées automatiquement par l'IA dans vos brouillons, prêtes à être envoyées",
            },
            {
              title: 'Base de connaissances personnalisable incluse',
              text: "Une fois connecté à l'application, vous ajoutez les liens vers votre site internet, vos réseaux sociaux et importez vos documents PDF pour enrichir l'IA.",
            },
            { title: 'Statistiques détaillées sur vos échanges et performances' },
          ]}
          price="20€"
          priceUnit="/par mois"
          buttonText="Commencer"
          enableCounter={true}
          basePrice={49}
          additionalPrice={39}
          localStorageKey="business_pass_email_counter"
          onButtonClick={() => handleStartClick('business_pass')}
          className={!showFreeTrial ? 'lg:flex-1 lg:w-1/2' : 'lg:w-96'}
        />

        <CardPack
          topGradient={`radial-gradient(
              ellipse 90% 90% at 50% 0%,
              #9F78FF 0%,
              #815AF3 50%,
              #D1AAFF 50%,
              transparent 80%
          )`}
          title="Solution sur mesure"
          subtitle="Entièrement dédiée à votre entreprise"
          features={[
            {
              title: "Développement d'une solution personnalisée",
              text: 'Parfaitement adaptée à votre structure',
            },
            {
              title: 'Conception sur mesure selon votre cahier des charges',
              text: 'Avec création de fonctionnalités spécifiques',
            },
            {
              title: 'Définition ensemble du tri intelligent des emails',
              text: 'Selon vos priorités et vos processus internes',
            },
            {
              title:
                'Automatisation avancée des traitements pour optimiser vos flux et réduire les tâches répétitives',
            },
            {
              title: "Réponses générées par l'IA",
              text: "Envoi automatique ou ajout dans vos brouillons selon le type d'email",
            },
            { title: 'Intégration complète avec vos outils CRM / ERP' },
            { title: 'Support dédié', text: 'Avec un accompagnement continu' },
            {
              title: 'API complète',
              text: 'Pour connecter ou étendre la solution à vos systèmes existants',
            },
          ]}
          buttonText="Nous contacter"
          buttonHref="https://hallia.ai/contact"
          hidePrice
          classNameButton="mt-10 xl:mt-0"
          className={!showFreeTrial ? 'lg:flex-1 lg:w-1/2' : 'lg:w-96'}
        />
      </section>

      <button
        onClick={() => setShowSubscriptionModal(true)}
        className="mt-8 mb-16 flex cursor-pointer items-center gap-2 text-gray-600 transition-colors hover:text-gray-800"
      >
        <span className="text-sm">Aucun engagement – Abonnement mensuel</span>
        <HelpCircle className="h-4 w-5" />
      </button>

      {/* Modal de connexion/inscription */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSignupSuccess={handleSignupSuccess}
      />

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
    </section>
  );
}
