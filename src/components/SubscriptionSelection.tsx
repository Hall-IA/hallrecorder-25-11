import { Crown, Check, Loader } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface SubscriptionSelectionProps {
  onClose: () => void;
  currentPlan?: 'starter' | 'unlimited';
  upgradeOnly?: boolean;
}

export const SubscriptionSelection = ({
  onClose,
  currentPlan,
  upgradeOnly = false
}: SubscriptionSelectionProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'unlimited' | null>(null);

  const handleSubscribe = async (plan: 'starter' | 'unlimited') => {
    setIsProcessing(true);
    setSelectedPlan(plan);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Vous devez être connecté');
      }

      // TODO: Remplacer par vos vrais Price IDs Stripe
      const priceIds = {
        starter: 'price_1SSyMI14zZqoQtSCb1gqGhke', // À remplacer par votre Price ID
        unlimited: 'price_1SSyNh14zZqoQtSCqPL9VwTj' // À remplacer par votre Price ID
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price_id: priceIds[plan],
            success_url: `${window.location.origin}/?payment=success`,
            cancel_url: `${window.location.origin}/?payment=cancelled`,
            mode: 'subscription'
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la création de la session de paiement');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      id: 'starter' as const,
      name: 'Starter',
      price: '39€',
      period: '/mois',
      description: 'Parfait pour démarrer',
      features: [
        '600 minutes d\'enregistrement/mois',
        'Transcription automatique',
        'Résumés IA',
        'Suggestions en temps réel',
        'Envoi par email',
        'Export PDF'
      ],
      color: 'from-coral-500 to-sunset-500',
      disabled: upgradeOnly && currentPlan === 'starter'
    },
    {
      id: 'unlimited' as const,
      name: 'Illimité',
      price: '49€',
      period: '/mois',
      description: 'Pour une utilisation intensive',
      features: [
        'Minutes illimitées',
        'Transcription automatique',
        'Résumés IA',
        'Suggestions en temps réel',
        'Envoi par email',
        'Export PDF',
        'Support prioritaire'
      ],
      color: 'from-amber-500 to-orange-500',
      recommended: true,
      disabled: false
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-coral-500 to-sunset-500 p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                {upgradeOnly ? 'Passer à la formule Illimitée' : 'Choisissez votre abonnement'}
              </h2>
              <p className="text-white/90">
                {upgradeOnly
                  ? 'Continuez sans limites avec la formule Illimitée'
                  : 'Commencez dès maintenant avec Meeting Recorder'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              disabled={isProcessing}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative border-2 rounded-2xl p-6 transition-all ${
                  plan.disabled
                    ? 'opacity-50 cursor-not-allowed border-gray-200'
                    : plan.recommended
                    ? 'border-amber-400 shadow-xl scale-105'
                    : 'border-coral-200 hover:border-coral-400 hover:shadow-lg'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Recommandé
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-cocoa-800 mb-2">{plan.name}</h3>
                  <p className="text-cocoa-600 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-end justify-center gap-1">
                    <span className={`text-5xl font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                      {plan.price}
                    </span>
                    <span className="text-cocoa-600 mb-2">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-cocoa-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={plan.disabled || isProcessing}
                  className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    plan.disabled
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : isProcessing && selectedPlan === plan.id
                      ? 'bg-gray-300 text-gray-600'
                      : plan.recommended
                      ? `bg-gradient-to-r ${plan.color} text-white hover:shadow-xl hover:scale-105`
                      : 'bg-coral-100 text-coral-700 hover:bg-coral-200'
                  }`}
                >
                  {isProcessing && selectedPlan === plan.id ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>Redirection...</span>
                    </>
                  ) : plan.disabled ? (
                    <span>Votre plan actuel</span>
                  ) : (
                    <>
                      <Crown className="w-5 h-5" />
                      <span>S'abonner</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-cocoa-600">
              💳 Paiement sécurisé par Stripe • Annulation à tout moment
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
