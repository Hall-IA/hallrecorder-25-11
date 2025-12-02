import { useState } from 'react';
import { HelpCircle, User, XCircle } from 'lucide-react';
import FeatureCards from './FeatureCards';

export default function Hero() {
  const [email, setEmail] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Sauvegarder l'email dans le localStorage pour le récupérer sur la page de connexion
    if (email) {
      localStorage.setItem('initialEmail', email);
    }
    // Rediriger vers la page de connexion
    window.location.href = window.location.origin + '/#record';
  };

  return (
    <section>
      <div
        className="relative mx-0 md:mx-8 mt-4 w-full md:w-[calc(100%-4rem)] rounded-3xl bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/assets/img/hero-meeting.png)',
        }}
      >
        {/* Overlay pour améliorer la lisibilité du texte */}
        <div className="absolute inset-0 rounded-3xl bg-black/40" />
        
<section className="relative m-auto max-w-7xl overflow-x-hidden">

      {/* Conteneur avec l'image en background */}
        <section className="flex min-h-screen items-center gap-12 px-6 pt-32 pb-10 sm:px-4 xl:flex-row xl:justify-between">
        <div className="space-y-12 w-full  xl:w-auto">
          <div className="font-roboto flex items-center gap-2 font-medium">
            {/* <img src="assets/svg/hallia-orange-logo.svg" height={48} width={48} alt="" /> */}
            <p className='text-lg font-thunder font-medium -mb-3 text-white pt-2 pb-1 px-4 bg-gray-800/70 rounded-full '>HALL RECORDER</p>
          </div>
          <div className="font-thunder space-y-6 text-4xl md:text-5xl lg:text-6xl xl:text-7xl lg:w-[70%] font-medium text-white">
            <div className="space-y-2">
              <h1>Votre agent de réunion : <br />
              Enregistre vos réunions et résume les échanges
              <span className="ml-3 bg-gradient-to-b from-[#F35F4F] to-[#FD9A00] bg-clip-text text-transparent">
                avec l’IA
              </span></h1>
            </div>
            <ul className="list-none md:list-disc md:list-inside ml-4 space-y-2">
              <li className="font-roboto max-w-[80%] text-base font-semibold text-base md:text-lg">
              Concentrez-vous sur vos échanges.
              </li>
              <li className="font-roboto max-w-[80%] text-base font-semibold text-base md:text-lg">
              Résume parfaitement vos interactions.
              </li>

              <li className="font-roboto max-w-[80%] text-base font-semibold text-base md:text-lg">
              Planifiez vos tâches à venir
              </li>
            </ul>
          
          
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="mt-8 mb-16 flex cursor-pointer items-center gap-2 text-gray-600 transition-colors hover:text-gray-800"
            >
              <span className="font-roboto text-sm text-white">Aucun engagement – Abonnement mensuel</span>
              <HelpCircle className="h-4 w-5 text-white" />
            </button>
          </div>
          <section className="flex flex-col xl:flex-row gap-4 mx-auto">
                      <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col lg:w-1/2 items-center justify-between gap-4 rounded-2xl bg-white p-6 sm:flex-row"
          >
            <div className="flex w-full items-center gap-2 rounded-xl border border-[#F4F1EE] px-3 py-2.5 md:w-2/3">
              <User
                fill="none"
                stroke="gray"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                size={18}
              />
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="jean.dupon@gmail.com"
                className="w-full bg-white focus:ring-0 focus:outline-none"
                required
                aria-required="true"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-fit cursor-pointer rounded-full bg-gradient-to-br from-[#F35F4F] to-[#FFAD5A] px-6 py-2.5 font-semibold whitespace-nowrap text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl md:w-auto"
            >
              Démarrez maintenant
            </button>
          </form>
          <div className="font-roboto pb-10 flex-col md:flex-row xl:pb-0 flex w-full xl:w-1/2  items-center gap-6 text-white">
            <div className="flex items-center gap-6">
              <p className="font-bold">Excellent</p>
              <div className="flex justify-center gap-2">
                {Array.from({ length: 5 }).map((_, index) => {
                  return (
                    <div className="bg-[#219653] p-1.5" key={index}>
                      <img src="/assets/svg/star.svg" width={19.6} height={18.55} alt="" />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <p className="text-center">
                Basé sur <span className="font-semibold underline">456 avis</span>
              </p>
              <div className="flex items-center gap-1.5">
                <img src="/assets/svg/Shape.svg" width={30} height={30} alt="" />
                <p className="text-xl font-bold">Trustpilot</p>
              </div>
            </div>
          </div>
          </section>
        </div>

        <div className="relative hidden xl:block">
        

          <div
            className="absolute inset-x-0 bottom-0 z-[5] h-1/2 bg-gradient-to-t from-[#F4F1EE] to-transparent"
            aria-hidden="true"
          />
        </div>
        </section>
          
</section>
      </div>
      <section className="mx-auto -mt-10 max-w-7xl overflow-x-hidden">
        <div className="flex justify-center">
          <FeatureCards />
        </div>
      </section>

  
      {/* Vidéo */}
      {/* <MacbookScrollSection /> */}


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
