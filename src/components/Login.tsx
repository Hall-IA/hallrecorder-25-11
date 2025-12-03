import { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, UserPlus, Home, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PasswordResetModal } from './PasswordResetModal';

interface LoginProps {
  onSuccess: () => void;
}

export const Login = ({ onSuccess }: LoginProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Récupérer l'email depuis le localStorage au montage du composant
  useEffect(() => {
    const initialEmail = localStorage.getItem('initialEmail');
    if (initialEmail) {
      setEmail(initialEmail);
      // Nettoyer le localStorage après récupération
      localStorage.removeItem('initialEmail');
    }
    
    // Vérifier si on doit afficher le formulaire d'inscription
    // Les paramètres peuvent être dans le hash (#record?signup=true) ou dans l'URL (?signup=true)
    const hash = window.location.hash;
    const searchParams = window.location.search;
    
    // Parser le hash pour extraire les paramètres (format: #record?signup=true)
    if (hash.includes('?')) {
      const hashParts = hash.split('?');
      if (hashParts.length > 1) {
        const hashParams = new URLSearchParams(hashParts[1]);
        if (hashParams.get('signup') === 'true') {
          setIsSignUp(true);
        }
      }
    }
    
    // Vérifier dans les paramètres de requête standard
    const urlParams = new URLSearchParams(searchParams);
    if (urlParams.get('signup') === 'true') {
      setIsSignUp(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/#record`,
          },
        });

        if (error) throw error;

        if (data.user) {
          setMessage('Un email de confirmation a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception.');
          setEmail('');
          setPassword('');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        onSuccess();
      }
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 flex items-center justify-center px-4 py-20 md:py-4 relative">
      {/* Bouton Retour à la page d'accueil */}
      <button
        onClick={() => {
          window.location.href = window.location.origin + '/';
        }}
        className="absolute font-roboto top-4 left-4 px-4 py-2 md:px-4 md:py-2 rounded-full text-white font-semibold text-sm shadow-lg transition-all hover:scale-105"
        style={{
          background: `conic-gradient(from 194deg at 84% -3.1%, #FF9A34 0deg, #F35F4F 76.15384697914124deg, #CE7D2A 197.30769395828247deg, #FFAD5A 245.76922416687012deg), rgba(249, 247, 245, 0.64)`,
          backdropFilter: 'blur(4px)',
        }}
      >
        <span className="md:hidden">
          <Home className="w-5 h-5" />
        </span>
        <span className="hidden md:inline">Retour à la page d'accueil</span>
      </button>
      
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logohallia.png" alt="Logo" className="w-12 h-12 md:w-20 md:h-20 object-contain" />
          </div>
          <h1 className="text-4xl font-thunder font-bold bg-gradient-to-r from-coral-500 to-sunset-500 bg-clip-text text-transparent mb-2">
            HALL RECORDER
          </h1>
          <p className="text-cocoa-600 text-lg font-roboto">
            {isSignUp ? 'Créez votre compte' : 'Connectez-vous à votre compte'}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 border-2 border-orange-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block font-roboto text-sm font-semibold text-cocoa-800 mb-2">
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
                  className=" font-roboto w-full pl-12 pr-4 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-cocoa-800 mb-2 font-roboto">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cocoa-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-12 pr-12 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-cocoa-400 hover:text-cocoa-600 transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {isSignUp && (
                <p className="mt-2 text-xs text-cocoa-500 font-roboto">Minimum 6 caractères</p>
              )}
              {!isSignUp && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(true)}
                    className="text-sm text-coral-600 hover:text-coral-700 font-medium transition-colors font-roboto"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}
            </div>

            {message && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <p className="text-green-700 text-sm font-roboto">{message}</p>
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
              className="w-full font-roboto flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coral-500 to-coral-600 text-white font-bold rounded-xl hover:from-coral-600 hover:to-coral-700 transition-all shadow-lg shadow-coral-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin font-roboto"></div>
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  <span>{isSignUp ? "S'inscrire" : 'Se connecter'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage('');
                setError('');
              }}
              className="font-roboto text-coral-600 hover:text-coral-700 font-semibold transition-colors"
            >
              {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
            </button>
          </div>
        </div>
      </div>

      {showPasswordReset && (
        <PasswordResetModal onClose={() => setShowPasswordReset(false)} />
      )}
    </div>
  );
};
