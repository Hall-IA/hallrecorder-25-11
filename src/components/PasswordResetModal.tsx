import { useState, useEffect } from 'react';
import { Mail, Lock, X, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PasswordResetModalProps {
  onClose: () => void;
}

export const PasswordResetModal = ({ onClose }: PasswordResetModalProps) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Timer pour le cooldown de renvoi
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset-code', {
        body: { email },
      });

      if (error) throw error;

      if (data.error) {
        setError(data.error);
        return;
      }

      setMessage('Un code de vérification a été envoyé à votre adresse email.');
      setStep('code');
      setResendCooldown(60); // 60 secondes de cooldown
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setMessage('');
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset-code', {
        body: { email },
      });

      if (error) throw error;

      if (data.error) {
        setError(data.error);
        return;
      }

      setMessage('Un nouveau code a été envoyé à votre adresse email.');
      setResendCooldown(60); // 60 secondes de cooldown
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue lors du renvoi');
    } finally {
      setIsResending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-and-reset-password', {
        body: {
          email,
          code,
          newPassword,
        },
      });

      if (error) throw error;

      if (data.error) {
        setError(data.error);
        return;
      }

      setMessage(data.message || 'Mot de passe réinitialisé avec succès !');

      // Fermer le modal après 2 secondes
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border-2 border-orange-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-cocoa-400 hover:text-cocoa-600 transition-colors"
          disabled={loading}
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-coral-100 to-sunset-100 rounded-2xl flex items-center justify-center">
              {step === 'email' ? (
                <Mail className="w-8 h-8 text-coral-600" />
              ) : (
                <Lock className="w-8 h-8 text-coral-600" />
              )}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-cocoa-900 mb-2">
            {step === 'email' ? 'Mot de passe oublié ?' : 'Nouveau mot de passe'}
          </h2>
          <p className="text-cocoa-600 text-sm">
            {step === 'email'
              ? 'Entrez votre email pour recevoir un code de vérification'
              : 'Entrez le code reçu et votre nouveau mot de passe'}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-cocoa-800 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cocoa-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  className="w-full pl-12 pr-4 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 transition-all"
                />
              </div>
            </div>

            {message && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-green-700 text-sm">{message}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coral-500 to-coral-600 text-white font-bold rounded-xl hover:from-coral-600 hover:to-coral-700 transition-all shadow-lg shadow-coral-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>Envoyer le code</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
                setMessage('');
              }}
              className="flex items-center gap-2 text-coral-600 hover:text-coral-700 font-medium transition-colors text-sm mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>

            <div>
              <label htmlFor="code" className="block text-sm font-semibold text-cocoa-800 mb-2">
                Code de vérification (6 chiffres)
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 transition-all text-center text-2xl font-bold tracking-widest"
              />
              <p className="mt-2 text-xs text-cocoa-500">Le code expire dans 15 minutes</p>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isResending}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-coral-600 hover:text-coral-700 hover:bg-coral-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-coral-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Envoi en cours...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Renvoyer dans {resendCooldown}s</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Renvoyer le code</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-semibold text-cocoa-800 mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cocoa-400" />
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-12 pr-4 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-cocoa-800 mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cocoa-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-12 pr-4 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 transition-all"
                />
              </div>
              <p className="mt-2 text-xs text-cocoa-500">Minimum 6 caractères</p>
            </div>

            {message && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-green-700 text-sm">{message}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coral-500 to-coral-600 text-white font-bold rounded-xl hover:from-coral-600 hover:to-coral-700 transition-all shadow-lg shadow-coral-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Réinitialiser le mot de passe</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
