import { useState } from 'react';
import { Mic, FileText, Mail, Clock, CheckCircle, Zap, Shield, Users, ArrowRight, Star } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const features = [
    {
      icon: <Mic className="w-8 h-8" />,
      title: "Enregistrement haute qualité",
      description: "Capturez vos réunions avec une qualité audio cristalline, sans limite de durée"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Résumés intelligents",
      description: "Obtenez instantanément les points clés, décisions et actions de chaque réunion"
    },
    {
      icon: <Mail className="w-8 h-8" />,
      title: "Partage simplifié",
      description: "Envoyez vos comptes-rendus par email en un clic avec pièces jointes"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Gain de temps massif",
      description: "Économisez des heures de prise de notes et de rédaction de comptes-rendus"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Sécurité garantie",
      description: "Vos données sont chiffrées et stockées de manière sécurisée"
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Historique complet",
      description: "Accédez à toutes vos réunions passées et retrouvez facilement vos informations"
    }
  ];

  const plans = [
    {
      name: "Essentiel",
      price: 17,
      description: "Parfait pour les professionnels indépendants",
      features: [
        "50 heures d'enregistrement / mois",
        "Résumés IA de qualité",
        "Historique de 6 mois",
        "Partage par email",
        "Support par email",
      ],
      popular: false,
      color: "from-coral-500 to-coral-600"
    },
    {
      name: "Professionnel",
      price: 37,
      description: "Idéal pour les équipes et entrepreneurs",
      features: [
        "200 heures d'enregistrement / mois",
        "Résumés IA avancés",
        "Historique illimité",
        "Partage par email avec pièces jointes",
        "Prise de notes pendant l'enregistrement",
        "Édition des résumés",
        "Informations participants",
        "Support prioritaire",
      ],
      popular: true,
      color: "from-amber-500 to-orange-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50">
      <nav className="bg-white/80 backdrop-blur-lg border-b border-orange-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/image copy.png" alt="Logo" className="w-12 h-12 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-coral-500 to-sunset-500 bg-clip-text text-transparent">
                Meeting recorder
              </span>
            </div>
            <button
              onClick={onGetStarted}
              className="group relative px-6 py-3 bg-gradient-to-r from-coral-500 to-sunset-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-coral-500/30 hover:shadow-xl hover:shadow-coral-500/50 hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative">Connexion</span>
            </button>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-coral-100 text-coral-700 px-4 py-2 rounded-full font-semibold mb-6 animate-fadeInDown">
            <Star className="w-4 h-4" />
            <span>Solution IA pour vos réunions professionnelles</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-coral-500 via-sunset-500 to-amber-600 bg-clip-text text-transparent mb-6 leading-tight animate-fadeInUp delay-100">
            Transformez vos réunions<br />en comptes-rendus parfaits
          </h1>
          <p className="text-xl md:text-2xl text-cocoa-600 max-w-3xl mx-auto mb-10 leading-relaxed animate-fadeInUp delay-200">
            Fini les prises de notes interminables. Notre IA enregistre, transcrit et résume vos réunions automatiquement.
            Concentrez-vous sur l'essentiel, nous gérons le reste.
          </p>
          <button
            onClick={onGetStarted}
            className="group relative inline-flex items-center gap-3 px-8 py-5 bg-gradient-to-r from-coral-500 via-sunset-500 to-coral-600 text-white text-lg font-bold rounded-2xl transition-all duration-300 shadow-2xl shadow-coral-500/40 hover:shadow-glow-coral hover:scale-105 overflow-hidden animate-zoomIn delay-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
            <span className="relative">Commencer gratuitement</span>
            <ArrowRight className="relative w-6 h-6 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <p className="text-sm text-cocoa-500 mt-4 animate-fadeIn delay-400">Aucune carte bancaire requise pour essayer</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-3xl p-8 shadow-xl border-2 border-orange-100 hover:border-coral-300 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 overflow-hidden animate-fadeInUp"
              style={{ animationDelay: `${500 + index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-coral-50 to-sunset-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative w-16 h-16 bg-gradient-to-br from-coral-500 via-sunset-500 to-coral-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                {feature.icon}
              </div>
              <h3 className="relative text-xl font-bold text-cocoa-800 mb-3">{feature.title}</h3>
              <p className="relative text-cocoa-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-coral-50 to-orange-50 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-cocoa-800 mb-4 animate-fadeInDown">
              Choisissez votre plan
            </h2>
            <p className="text-xl text-cocoa-600 mb-8 animate-fadeInUp delay-100">
              Des tarifs simples et transparents pour tous vos besoins
            </p>

            <div className="inline-flex items-center gap-3 bg-white rounded-full p-1.5 shadow-lg animate-zoomIn delay-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-full font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-md'
                    : 'text-cocoa-600 hover:text-coral-600'
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2.5 rounded-full font-semibold transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-md'
                    : 'text-cocoa-600 hover:text-coral-600'
                }`}
              >
                Annuel
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  -20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white rounded-3xl p-8 shadow-2xl border-2 transition-all hover:scale-105 animate-fadeInUp ${
                  plan.popular ? 'delay-300' : 'delay-400'
                } ${
                  plan.popular
                    ? 'border-coral-400 shadow-coral-500/30'
                    : 'border-orange-100 hover:border-coral-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-coral-500 to-coral-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg">
                      ⭐ Plus populaire
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-3xl font-bold text-cocoa-800 mb-2">{plan.name}</h3>
                  <p className="text-cocoa-600 mb-6">{plan.description}</p>

                  <div className="mb-2">
                    <span className={`text-6xl font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                      {billingCycle === 'yearly' ? Math.round(plan.price * 0.8) : plan.price}€
                    </span>
                    <span className="text-cocoa-600 text-lg">/mois</span>
                  </div>

                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 font-semibold">
                      Économisez {Math.round(plan.price * 0.2 * 12)}€ par an
                    </div>
                  )}
                </div>

                <button
                  onClick={onGetStarted}
                  className={`w-full py-4 rounded-xl font-bold text-lg mb-8 transition-all shadow-lg ${
                    plan.popular
                      ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white hover:from-coral-600 hover:to-coral-700 shadow-coral-500/30'
                      : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-orange-500/30'
                  }`}
                >
                  Commencer maintenant
                </button>

                <ul className="space-y-4">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-coral-500 flex-shrink-0 mt-0.5" />
                      <span className="text-cocoa-700 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-cocoa-600 text-lg">
              Tous les plans incluent une période d'essai de 14 jours
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-gradient-to-br from-coral-500 to-sunset-600 rounded-3xl p-12 md:p-16 text-center shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded-full bg-white border-4 border-coral-500 flex items-center justify-center"
                >
                  <Users className="w-6 h-6 text-coral-600" />
                </div>
              ))}
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Rejoignez des milliers de professionnels
          </h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Entrepreneurs, managers, consultants... Ils ont tous choisi Meeting Recorder pour optimiser leurs réunions et gagner un temps précieux.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-3 px-8 py-5 bg-white text-coral-600 text-lg font-bold rounded-2xl hover:bg-orange-50 transition-all shadow-2xl hover:scale-105"
          >
            <span>Essayer gratuitement pendant 14 jours</span>
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </section>

      <footer className="bg-cocoa-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/image copy.png" alt="Logo" className="w-10 h-10 object-contain" />
              <span className="text-xl font-bold">Meeting Recorder</span>
            </div>
            <div className="text-center md:text-right text-cocoa-400">
              <p>© 2024 Meeting Recorder. Tous droits réservés.</p>
              <p className="text-sm mt-2">Propulsé par l'IA pour des réunions plus productives</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
