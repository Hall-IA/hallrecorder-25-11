import { Crown, Check, Loader } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useDialog } from '../context/DialogContext';

interface SubscriptionSelectionProps {
  onClose: () => void;
  currentPlan?: 'starter' | 'unlimited';
  upgradeOnly?: boolean;
  canClose?: boolean;
}

export const SubscriptionSelection = ({
  onClose,
  currentPlan,
  upgradeOnly = false,
  canClose = true
}: SubscriptionSelectionProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'unlimited' | null>(null);
  const { showAlert } = useDialog();

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
        starter: import.meta.env.VITE_STRIPE_PRICE_STARTER,
        unlimited: import.meta.env.VITE_STRIPE_PRICE_UNLIMITED
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
            success_url: `${window.location.origin}/#record?payment=success`,
            cancel_url: `${window.location.origin}/#subscription`,
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
      await showAlert({
        title: 'Erreur d\'abonnement',
        message: 'Une erreur est survenue. Veuillez réessayer.',
        variant: 'danger',
      });
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      id: 'starter' as const,
      name: 'Starter',
      priceHT: '39€',
      priceTTC: '46.80€',
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
      buttonColor: 'bg-gradient-to-r from-coral-500 to-sunset-500 hover:from-coral-600 hover:to-sunset-600',
      disabled: upgradeOnly && currentPlan === 'starter'
    },
    {
      id: 'unlimited' as const,
      name: 'Illimité',
      priceHT: '49€',
      priceTTC: '58.80€',
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
      color: 'from-purple-500 to-indigo-500',
      buttonColor: 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600',
      recommended: true,
      disabled: false
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-5xl w-full my-4 animate-scaleIn max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-coral-500 to-sunset-500 p-4 sm:p-6 md:p-8 text-white sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">
                {!canClose ? '🎉 Bienvenue !' : upgradeOnly ? 'Passer à Illimité' : 'Choisissez votre abonnement'}
              </h2>
              <p className="text-sm sm:text-base text-white/90">
                {!canClose
                  ? '7 jours d\'essai gratuit, sans engagement'
                  : upgradeOnly
                  ? 'Continuez sans limites'
                  : '7 jours d\'essai gratuit, sans engagement'
                }
              </p>
            </div>
            {canClose && (
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                disabled={isProcessing}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Plans */}
        <div className="p-3 sm:p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative border-2 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 transition-all ${
                  plan.disabled
                    ? 'opacity-50 cursor-not-allowed border-gray-200'
                    : plan.recommended
                    ? 'border-purple-400 shadow-xl md:scale-105 bg-gradient-to-br from-purple-50/50 to-indigo-50/50'
                    : 'border-coral-200 hover:border-coral-400 hover:shadow-lg'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-2 sm:-top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold shadow-lg">
                      ⭐ Recommandé
                    </span>
                  </div>
                )}

                <div className="text-center mb-4 sm:mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-cocoa-800 mb-1 sm:mb-2">{plan.name}</h3>
                  <p className="text-cocoa-600 text-xs sm:text-sm mb-3 sm:mb-4">{plan.description}</p>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-end justify-center gap-1">
                      <span className={`text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                        {plan.priceHT}
                      </span>
                      <span className="text-cocoa-600 mb-1 sm:mb-2 text-sm sm:text-base">{plan.period}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-cocoa-500">
                      HT <span className="mx-1">•</span> <span className="font-semibold text-cocoa-700">{plan.priceTTC} TTC</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-cocoa-700 text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={plan.disabled || isProcessing}
                  className={`w-full py-3 sm:py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base shadow-lg ${
                    plan.disabled
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : isProcessing && selectedPlan === plan.id
                      ? 'bg-gray-300 text-gray-600 shadow-none'
                      : `${plan.buttonColor} text-white hover:shadow-xl hover:scale-105 active:scale-100`
                  }`}
                >
                  {isProcessing && selectedPlan === plan.id ? (
                    <>
                      <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      <span>Redirection...</span>
                    </>
                  ) : plan.disabled ? (
                    <span>Votre plan actuel</span>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Essayer 7 jours gratuits</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="mt-4 sm:mt-6 md:mt-8 space-y-2 sm:space-y-3">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-cocoa-600 mb-2">
                💳 Paiement sécurisé par Stripe
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 text-xs text-cocoa-500">
                <span className="hidden sm:inline">Moyens de paiement :</span>
                <span className="font-semibold">Carte bancaire</span>
                <span>•</span>
                <span className="font-semibold">Apple Pay</span>
                <span>•</span>
                <span className="font-semibold">Google Pay</span>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="text-lg sm:text-2xl flex-shrink-0">🎁</div>
                <div className="flex-1 text-xs sm:text-sm text-cocoa-700">
                  <p className="font-semibold mb-1 text-green-700">7 jours d'essai gratuit !</p>
                  <ul className="space-y-1 text-xs text-cocoa-600">
                    <li>• <strong>Aucun prélèvement</strong> pendant la période d'essai</li>
                    <li>• Annulez à tout moment avant la fin des 7 jours</li>
                    <li>• Accès complet à toutes les fonctionnalités</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="text-lg sm:text-2xl flex-shrink-0">ℹ️</div>
                <div className="flex-1 text-xs sm:text-sm text-cocoa-700">
                  <p className="font-semibold mb-1">Informations de facturation :</p>
                  <ul className="space-y-1 text-xs text-cocoa-600">
                    <li>• Prix affichés HT, TVA 20% ajoutée au paiement</li>
                    <li>• Factures disponibles immédiatement</li>
                    <li>• Résiliation sans frais à tout moment</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
