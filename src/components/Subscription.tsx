import { useState, useEffect } from 'react';
import { Crown, Calendar, CreditCard, Download, AlertCircle, CheckCircle, XCircle, Loader, ExternalLink, Zap, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionProps {
  userId: string;
}

interface SubscriptionData {
  plan_type: 'starter' | 'unlimited';
  is_active: boolean;
  minutes_quota: number | null;
  minutes_used_this_month: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  pending_downgrade_plan: 'starter' | 'unlimited' | null;
}

interface StripeSubscription {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  description: string;
  period_start: number;
  period_end: number;
  is_proration?: boolean;
}

export const Subscription = ({ userId }: SubscriptionProps) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [stripeSubscription, setStripeSubscription] = useState<StripeSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'unlimited'>('starter');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [changeMessage, setChangeMessage] = useState<string | null>(null);
  const [changeType, setChangeType] = useState<'upgrade' | 'downgrade' | null>(null);
  const [isWaitingForInvoice, setIsWaitingForInvoice] = useState(false);
  const [lastInvoiceCount, setLastInvoiceCount] = useState(0);

  useEffect(() => {
    loadSubscription();
    loadInvoices();
  }, [userId]);

  const loadSubscription = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (subError) throw subError;
      setSubscription(subData);
      if (subData) {
        setSelectedPlan(subData.plan_type);
      }

      if (subData?.stripe_customer_id) {
        const { data: stripeData, error: stripeError } = await supabase
          .from('stripe_subscriptions')
          .select('status, cancel_at_period_end, current_period_end, payment_method_brand, payment_method_last4')
          .eq('customer_id', subData.stripe_customer_id)
          .maybeSingle();

        if (!stripeError && stripeData) {
          setStripeSubscription(stripeData);
        }
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError('Erreur lors du chargement de l\'abonnement');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-invoices`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newInvoices = data.invoices || [];
        setInvoices(newInvoices);

        if (isWaitingForInvoice && newInvoices.length > lastInvoiceCount) {
          console.log('Nouvelle facture détectée, arrêt du rechargement automatique');
          setIsWaitingForInvoice(false);
        }
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleChangePlan = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    setChangeMessage(null);
    setChangeType(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Vous devez être connecté');
      }

      if (!subscription) {
        const priceIds = {
          starter: 'price_1SSyMI14zZqoQtSCb1gqGhke',
          unlimited: 'price_1SSyNh14zZqoQtSCqPL9VwTj'
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
              price_id: priceIds[selectedPlan],
              success_url: `${window.location.origin}/#subscription`,
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
        return;
      }

      if (!subscription || selectedPlan === subscription.plan_type) {
        throw new Error('Veuillez sélectionner un plan différent de votre plan actuel');
      }

      console.log('Changing plan from', subscription.plan_type, 'to', selectedPlan);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-subscription-plan`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_plan: selectedPlan
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Change plan error:', data);
        throw new Error(data.error || 'Erreur lors du changement de plan');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      await loadSubscription();

      await new Promise(resolve => setTimeout(resolve, 500));

      setChangeMessage(data.message);
      setChangeType(data.type);

      if (data.type === 'upgrade') {
        setLastInvoiceCount(invoices.length);
        setIsWaitingForInvoice(true);
        const reloadInvoicesWithRetry = async () => {
          const maxAttempts = 8;
          const delays = [2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000];

          for (let i = 0; i < maxAttempts; i++) {
            if (!isWaitingForInvoice) {
              console.log('Rechargement arrêté : nouvelle facture détectée');
              break;
            }
            await new Promise(resolve => setTimeout(resolve, delays[i]));
            await loadInvoices();
          }

          setIsWaitingForInvoice(false);
        };
        reloadInvoicesWithRetry();
      } else {
        setLastInvoiceCount(invoices.length);
        setIsWaitingForInvoice(true);
        const reloadInvoicesWithRetry = async () => {
          const maxAttempts = 5;
          const delays = [2000, 3000, 4000, 5000, 6000];

          for (let i = 0; i < maxAttempts; i++) {
            if (!isWaitingForInvoice) {
              console.log('Rechargement arrêté : nouvelle facture détectée');
              break;
            }
            await new Promise(resolve => setTimeout(resolve, delays[i]));
            await loadInvoices();
          }

          setIsWaitingForInvoice(false);
        };
        reloadInvoicesWithRetry();
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-billing-portal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            return_url: `${window.location.origin}/#subscription`
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Billing portal error:', data);

        if (data.error && data.error.includes('No configuration provided')) {
          throw new Error('Le portail de facturation n\'est pas encore configuré. Veuillez contacter le support.');
        }

        if (data.error && data.error.includes('No Stripe customer found')) {
          throw new Error('Vous devez d\'abord souscrire à un abonnement.');
        }

        throw new Error(data.error || 'Erreur lors de la création de la session de facturation');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL du portail non reçue');
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Erreur lors de l\'accès au portail de facturation');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || isProcessing) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md mx-4 border-2 border-coral-200">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <Loader className="w-16 h-16 animate-spin text-coral-500" />
          </div>
          <h3 className="text-xl font-bold text-cocoa-800 mb-2">
            {isProcessing ? 'Changement de plan en cours...' : 'Chargement...'}
          </h3>
          <p className="text-cocoa-600">
            {isProcessing
              ? 'Veuillez patienter pendant que nous mettons à jour votre abonnement et récupérons les dernières données.'
              : 'Récupération de vos informations d\'abonnement...'
            }
          </p>
          <div className="mt-4 flex justify-center gap-1">
            <div className="w-2 h-2 bg-coral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-coral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-coral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-cocoa-800 mb-2">Aucun abonnement</h3>
          <p className="text-cocoa-600 mb-4">
            Vous n'avez pas encore d'abonnement actif.
          </p>
        </div>
      </div>
    );
  }

  const planNames = {
    starter: 'Starter',
    unlimited: 'Illimité'
  };

  const planPrices = {
    starter: '39€',
    unlimited: '49€'
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusBadge = () => {
    if (!subscription.is_active) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
          <XCircle className="w-4 h-4" />
          Inactif
        </span>
      );
    }

    if (stripeSubscription?.cancel_at_period_end) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
          <AlertCircle className="w-4 h-4" />
          Annulation prévue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
        <CheckCircle className="w-4 h-4" />
        Actif
      </span>
    );
  };

  const quotaPercentage = subscription.minutes_quota
    ? Math.min((subscription.minutes_used_this_month / subscription.minutes_quota) * 100, 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-cocoa-800">Mon Abonnement</h1>
        {getStatusBadge()}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {changeMessage && (
        <div className={`border rounded-xl p-4 ${
          changeType === 'upgrade'
            ? 'bg-green-50 border-green-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-3 mb-2">
            <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              changeType === 'upgrade' ? 'text-green-500' : 'text-blue-500'
            }`} />
            <p className={`font-semibold ${changeType === 'upgrade' ? 'text-green-700' : 'text-blue-700'}`}>
              {changeMessage}
            </p>
          </div>
          <div className="ml-8">
            {isWaitingForInvoice ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader className="w-4 h-4 animate-spin text-amber-600" />
                <span className={changeType === 'upgrade' ? 'text-green-600' : 'text-blue-600'}>
                  {changeType === 'upgrade'
                    ? 'Génération de la facture de prorata en cours...'
                    : 'Vérification de votre facture en cours...'
                  }
                </span>
              </div>
            ) : (
              <p className={`text-sm ${changeType === 'upgrade' ? 'text-green-600' : 'text-blue-600'}`}>
                {changeType === 'upgrade'
                  ? 'La facture d\'ajustement de prorata a été générée par Stripe et apparaît dans votre liste de factures ci-dessous.'
                  : 'Votre liste de factures a été mise à jour.'
                }
              </p>
            )}
          </div>
        </div>
      )}

      {subscription?.pending_downgrade_plan && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-blue-700">
            <p className="font-semibold mb-1">Changement de plan programmé</p>
            <p>
              Votre abonnement passera au plan {subscription.pending_downgrade_plan === 'starter' ? 'Starter' : 'Illimité'} le {formatDate(subscription.billing_cycle_end)}.
            </p>
          </div>
        </div>
      )}

      {/* Section Choix de la formule */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6">
        <h3 className="text-2xl font-bold text-cocoa-900 mb-4">
          Choisissez la formule qui correspond à vos besoins
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Formule Starter */}
          <div
            onClick={() => setSelectedPlan('starter')}
            className={`relative rounded-2xl p-6 border-2 cursor-pointer transition-all ${
              selectedPlan === 'starter'
                ? 'border-coral-500 bg-gradient-to-br from-coral-50 to-sunset-50 shadow-xl scale-105'
                : 'border-coral-200 bg-white hover:border-coral-300 hover:shadow-lg'
            }`}
          >
            {selectedPlan === 'starter' && (
              <div className="absolute -top-3 right-4 px-3 py-1 bg-coral-500 text-white text-xs font-bold rounded-full shadow-lg">
                Sélectionné
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl shadow-md">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-cocoa-900">Formule Starter</h4>
                <p className="text-2xl font-bold text-coral-600">39€<span className="text-sm text-cocoa-600">/mois</span></p>
                <p className="text-xs text-cocoa-500">Sans engagement</p>
              </div>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-semibold">600 minutes/mois</span>
              </li>
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Transcription IA</span>
              </li>
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Résumés automatiques</span>
              </li>
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Envoi d'emails</span>
              </li>
            </ul>
          </div>

          {/* Formule Illimitée */}
          <div
            onClick={() => setSelectedPlan('unlimited')}
            className={`relative rounded-2xl p-6 border-2 cursor-pointer transition-all ${
              selectedPlan === 'unlimited'
                ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-xl scale-105'
                : 'border-amber-200 bg-white hover:border-amber-300 hover:shadow-lg'
            }`}
          >
            {selectedPlan === 'unlimited' && (
              <div className="absolute -top-3 right-4 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-lg">
                Sélectionné
              </div>
            )}
            <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg">
              ⭐ POPULAIRE
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl shadow-md">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-cocoa-900">Formule Illimitée</h4>
                <p className="text-2xl font-bold text-amber-600">49€<span className="text-sm text-cocoa-600">/mois</span></p>
                <p className="text-xs text-cocoa-500">Sans engagement</p>
              </div>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-semibold">Minutes illimitées</span>
              </li>
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Transcription IA</span>
              </li>
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Résumés automatiques</span>
              </li>
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Envoi d'emails</span>
              </li>
              <li className="flex items-center gap-2 text-cocoa-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Support prioritaire</span>
              </li>
            </ul>
          </div>
        </div>

        {subscription && subscription.plan_type !== selectedPlan && (
          <button
            onClick={handleChangePlan}
            disabled={isProcessing}
            className="group relative w-full px-6 py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            {isProcessing ? (
              <span className="relative flex items-center justify-center gap-2">
                <Loader className="w-5 h-5 animate-spin" />
                Redirection...
              </span>
            ) : (
              <span className="relative">Changer pour la formule {selectedPlan === 'starter' ? 'Starter (39€)' : 'Illimitée (49€)'}</span>
            )}
          </button>
        )}

        {!subscription && (
          <button
            onClick={handleChangePlan}
            disabled={isProcessing}
            className="group relative w-full px-6 py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            {isProcessing ? (
              <span className="relative flex items-center justify-center gap-2">
                <Loader className="w-5 h-5 animate-spin" />
                Redirection...
              </span>
            ) : (
              <span className="relative">Activer la formule {selectedPlan === 'starter' ? 'Starter (39€)' : 'Illimitée (49€)'}</span>
            )}
          </button>
        )}

        <p className="text-xs text-center text-cocoa-500 mt-4">
          Note: Chaque réunion est limitée à un maximum de 4 heures
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-coral-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-coral-500 to-sunset-500 rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-cocoa-800">Plan actuel</h3>
              <p className="text-sm text-cocoa-600">Votre formule d'abonnement</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold bg-gradient-to-r from-coral-500 to-sunset-500 bg-clip-text text-transparent">
                {planNames[subscription.plan_type]}
              </span>
              <span className="text-2xl text-cocoa-600">{planPrices[subscription.plan_type]}/mois</span>
            </div>

            {subscription.minutes_quota ? (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-cocoa-600">Minutes utilisées</span>
                  <span className="font-semibold text-cocoa-800">
                    {subscription.minutes_used_this_month} / {subscription.minutes_quota} min
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      quotaPercentage >= 90
                        ? 'bg-red-500'
                        : quotaPercentage >= 70
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${quotaPercentage}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-green-600 font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Minutes illimitées
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border-2 border-coral-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-cocoa-800">Période de facturation</h3>
              <p className="text-sm text-cocoa-600">Dates de votre cycle</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-cocoa-600 mb-1">Début du cycle</p>
              <p className="font-semibold text-cocoa-800">
                {formatDate(subscription.billing_cycle_start)}
              </p>
            </div>

            <div>
              <p className="text-sm text-cocoa-600 mb-1">
                {stripeSubscription?.cancel_at_period_end ? 'Date d\'annulation' : 'Prochaine facturation'}
              </p>
              <p className="font-semibold text-cocoa-800">
                {formatDate(subscription.billing_cycle_end)}
              </p>
            </div>

            {stripeSubscription?.cancel_at_period_end && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-700">
                  Votre abonnement sera annulé à la fin de la période en cours.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {stripeSubscription && (
        <div className="bg-white border-2 border-coral-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-cocoa-800">Moyen de paiement</h3>
              <p className="text-sm text-cocoa-600">Carte enregistrée</p>
            </div>
          </div>

          {stripeSubscription.payment_method_brand && stripeSubscription.payment_method_last4 ? (
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-gray-100 rounded-lg font-mono">
                {stripeSubscription.payment_method_brand.toUpperCase()} •••• {stripeSubscription.payment_method_last4}
              </div>
            </div>
          ) : (
            <p className="text-cocoa-600">Aucune carte enregistrée</p>
          )}
        </div>
      )}

      {/* Section Factures */}
      <div className="bg-white border-2 border-coral-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-cocoa-800">Mes factures</h3>
              <p className="text-sm text-cocoa-600">Téléchargez vos factures</p>
            </div>
          </div>
          <button
            onClick={loadInvoices}
            disabled={isLoadingInvoices}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingInvoices ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {isWaitingForInvoice && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader className="w-5 h-5 animate-spin text-amber-600 flex-shrink-0" />
                <div className="text-sm text-amber-700">
                  <p className="font-semibold">Facture en cours de génération</p>
                  <p>Stripe génère votre facture de prorata. Elle apparaîtra ici dans quelques instants...</p>
                </div>
              </div>
              <button
                onClick={() => setIsWaitingForInvoice(false)}
                className="text-amber-600 hover:text-amber-800 text-sm font-medium px-3 py-1 rounded hover:bg-amber-100 transition-colors"
              >
                Arrêter
              </button>
            </div>
          </div>
        )}

        {isLoadingInvoices ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-coral-500" />
            <span className="ml-2 text-cocoa-600">Chargement des factures...</span>
          </div>
        ) : invoices.length > 0 ? (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-gradient-to-br from-peach-50 to-coral-50 rounded-xl border border-coral-200 hover:border-coral-300 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-cocoa-900">Facture {invoice.number}</p>
                    {invoice.is_proration && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        📊 Prorata
                      </span>
                    )}
                    {invoice.status === 'paid' && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Payée
                      </span>
                    )}
                    {invoice.status === 'open' && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                        En attente
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-cocoa-600">
                    {new Date(invoice.created * 1000).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                  <p className="text-sm text-cocoa-500">{invoice.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-cocoa-900">
                      {invoice.amount.toFixed(2)} {invoice.currency}
                    </p>
                  </div>
                  {invoice.invoice_pdf && (
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>PDF</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-cocoa-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune facture disponible</p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-coral-50 to-sunset-50 border-2 border-coral-200 rounded-2xl p-6">
        <h3 className="font-bold text-cocoa-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Gestion de l'abonnement et annulation
        </h3>

        <p className="text-cocoa-600 mb-4">
          Accédez au portail Stripe pour gérer votre abonnement, mettre à jour votre moyen de paiement ou annuler votre abonnement.
        </p>

        <button
          onClick={handleManageBilling}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Ouverture...</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-5 h-5" />
              <span>Gérer mon abonnement / Annuler</span>
            </>
          )}
        </button>

        <p className="text-xs text-cocoa-500 mt-3">
          Vous serez redirigé vers le portail sécurisé Stripe où vous pourrez annuler votre abonnement en quelques clics.
        </p>
      </div>
    </div>
  );
};
