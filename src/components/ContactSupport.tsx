import { useState, useEffect } from 'react';
import { Mail, Upload, Send, CheckCircle, AlertCircle, Loader2, X, Image as ImageIcon, PartyPopper, HelpCircle, XCircle, Sparkles, MessageCircle, Lightbulb } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDialog } from '../context/DialogContext';

// Modal de succès
interface SuccessModalProps {
  isOpen: boolean;
  email: string;
  ticketId: string;
  onClose: () => void;
}

const SuccessModal = ({ isOpen, email, ticketId, onClose }: SuccessModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec icône */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-6 text-white text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
            <PartyPopper className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Message envoyé !</h2>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800">
              <p className="font-medium">Votre ticket a bien été créé</p>
              <p className="text-xs text-emerald-600 mt-1 font-mono">{ticketId}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 text-center">
            Notre équipe vous répondra dans les plus brefs délais à l'adresse :
          </p>

          <div className="text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-800">
              <Mail className="w-4 h-4 text-coral-500" />
              {email}
            </span>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Un email de confirmation vous a été envoyé.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
};

const SUPPORT_STORAGE_BUCKET = 'Compte-rendu';
const SUPPORT_STORAGE_PREFIX = 'support-tickets';

const sanitizeFilename = (filename: string, fallbackExt = 'png') => {
  if (!filename) {
    return `capture.${fallbackExt}`;
  }

  const parts = filename.split('.');
  const rawExt = parts.length > 1 ? parts.pop() : null;
  const extension = (rawExt ?? fallbackExt).toLowerCase().replace(/[^a-z0-9]/g, '') || fallbackExt;
  const rawBase = parts.join('.') || 'capture';
  const base = rawBase.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '') || 'capture';

  return `${base}.${extension}`;
};

interface ContactSupportProps {
  userId: string;
  userEmail?: string;
  reloadTrigger?: number;
}

type ProblemCategory = 'question' | 'bug' | 'feature' | 'other';

export const ContactSupport = ({ userId, userEmail }: ContactSupportProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [category, setCategory] = useState<ProblemCategory>('question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTicketId, setSuccessTicketId] = useState('');
  const [successEmail, setSuccessEmail] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { showAlert } = useDialog();

  // Mettre à jour l'email quand userEmail change
  useEffect(() => {
    if (userEmail) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  // Créer les URLs de preview pour les screenshots
  useEffect(() => {
    console.log('📸 Screenshots:', screenshots.length);
    const newUrls = screenshots.map((file, idx) => {
      const url = URL.createObjectURL(file);
      console.log(`  [${idx}] ${file.name} → ${url} (${file.type}, ${(file.size/1024).toFixed(1)}KB)`);
      return url;
    });
    setPreviewUrls(newUrls);
    console.log('✅ Preview URLs créées:', newUrls.length);
    
    return () => {
      console.log('🧹 Nettoyage des preview URLs');
      newUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [screenshots]);

  const categories = [
    { id: 'question' as const, label: 'Question', IconComponent: HelpCircle },
    { id: 'bug' as const, label: 'Bug / Problème technique', IconComponent: XCircle },
    { id: 'feature' as const, label: 'Demande de fonctionnalité', IconComponent: Sparkles },
    { id: 'other' as const, label: 'Autre', IconComponent: MessageCircle },
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      await showAlert({
        title: 'Format non supporté',
        message: 'Seules les images sont acceptées (PNG, JPG, GIF, etc.)',
        variant: 'warning',
      });
    }
    
    const newScreenshots = [...screenshots, ...imageFiles].slice(0, 3);
    setScreenshots(newScreenshots);
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const uploadScreenshotsAndGetLinks = async (files: File[], sanitizedNames: string[]): Promise<string[]> => {
    if (!userId || files.length === 0) {
      return [];
    }

    const urls: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sanitizedName = sanitizedNames[i] || sanitizeFilename(file.name, 'png');
      const uniquePath = `${userId}/${SUPPORT_STORAGE_PREFIX}/${timestamp}_${i}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from(SUPPORT_STORAGE_BUCKET)
        .upload(uniquePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/png',
        });

      if (uploadError) {
        console.error('❌ Erreur upload capture support:', uploadError);
        throw new Error("Erreur lors de l'upload des captures d'écran. Veuillez réessayer ou retirer les captures.");
      }

      const { data: publicData } = supabase.storage
        .from(SUPPORT_STORAGE_BUCKET)
        .getPublicUrl(uniquePath);

      if (!publicData?.publicUrl) {
        throw new Error('Impossible de générer les liens des captures d\'écran. Veuillez réessayer.');
      }

      urls.push(publicData.publicUrl);
    }

    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setErrorMessage('Veuillez remplir tous les champs obligatoires');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Veuillez entrer une adresse email valide');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
      return;
    }

    setIsSending(true);
    setShowError(false);

    try {
      // Générer un ticketId unique
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      console.log('📧 Création du ticket:', ticketId);

      // Upload des screenshots si présents
      const sanitizedNames = screenshots.map((file, index) =>
        sanitizeFilename(file?.name || `capture_${index + 1}.png`, 'png')
      );

      let screenshotUrls: string[] = [];
      if (screenshots.length > 0) {
        screenshotUrls = await uploadScreenshotsAndGetLinks(screenshots, sanitizedNames);
        console.log('✅ Screenshots uploadés:', screenshotUrls.length);
      }

      // 1. Envoyer le ticket au support (support@hallia.ai)
      console.log('📤 Envoi du ticket au support...');
      const { data: ticketData, error: ticketError } = await supabase.functions.invoke('send-ticket-to-support', {
        body: {
          ticketId,
          name: name.trim(),
          email: email.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          screenshots: screenshotUrls,
        },
      });

      if (ticketError) {
        console.error('❌ Erreur envoi ticket:', ticketError);
        throw new Error(ticketError.message || 'Erreur lors de l\'envoi du ticket au support');
      }

      console.log('✅ Ticket envoyé au support:', ticketData);

      // 2. Envoyer la réponse automatique au client
      console.log('📨 Envoi de la confirmation au client...');
      try {
        const { error: autoReplyError } = await supabase.functions.invoke('support-auto-reply', {
          body: {
            to: email.trim(),
            name: name.trim(),
            ticketId,
          },
        });

        if (autoReplyError) {
          console.warn('⚠️ Erreur envoi réponse automatique (non bloquant):', autoReplyError);
        } else {
          console.log('✅ Email de confirmation envoyé');
        }
      } catch (autoReplyError) {
        console.error('⚠️ Erreur envoi réponse automatique (non bloquant):', autoReplyError);
      }

      // Succès ! Afficher le modal
      setSuccessEmail(email.trim());
      setSuccessTicketId(ticketId);
      setShowSuccessModal(true);

      // Reset le formulaire
      setName('');
      setEmail(userEmail || '');
      setCategory('question');
      setSubject('');
      setMessage('');
      setScreenshots([]);

    } catch (error: any) {
      console.error('❌ Erreur lors de l\'envoi:', error);
      setErrorMessage(error.message || 'Une erreur est survenue lors de l\'envoi');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="hidden md:block p-3 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-cocoa-900 font-roboto">Support</h2>
          <p className="text-sm text-cocoa-600 font-roboto">Nous sommes là pour vous aider !</p>
        </div>
      </div>

      {/* Modal de succès */}
      <SuccessModal
        isOpen={showSuccessModal}
        email={successEmail}
        ticketId={successTicketId}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Message d'erreur */}
      {showError && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3 animate-scaleIn">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900 font-roboto">Erreur</p>
            <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nom */}
        <div>
          <label className="block text-sm font-semibold text-cocoa-800 mb-2 font-roboto">
            Votre nom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jean Dupont"
            className="text-sm md:text-base font-roboto w-full px-4 py-3 border-2 border-coral-200 rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all"
            disabled={isSending}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-cocoa-800 mb-2 font-roboto">
            Votre email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            className="text-sm md:text-base font-roboto w-full px-4 py-3 border-2 border-coral-200 rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all"
            disabled={isSending}
          />
          <p className="text-xs text-cocoa-500 mt-1">
            Nous vous enverrons une confirmation à cette adresse
          </p>
        </div>

        {/* Catégorie */}
        <div>
          <label className="block text-sm font-semibold text-cocoa-800 mb-3 font-roboto">
            Catégorie <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((cat) => {
              const Icon = cat.IconComponent;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  disabled={isSending}
                  className={`text-sm md:text-base font-roboto p-3 rounded-xl border-2 transition-all text-left ${
                    category === cat.id
                      ? 'border-coral-500 bg-coral-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-coral-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Icon className={`w-7 h-7 ${category === cat.id ? 'text-coral-600' : 'text-gray-400'}`} />
                    <span className="text-xs font-medium text-cocoa-800">{cat.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sujet */}
        <div>
          <label className="block text-sm font-semibold text-cocoa-800 mb-2 font-roboto">
            Sujet <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex: Problème lors de la transcription d'un enregistrement"
            className="text-sm md:text-base font-roboto w-full px-4 py-3 border-2 border-coral-200 rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all"
            disabled={isSending}
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-cocoa-800 mb-2 font-roboto">
            Décrivez votre problème <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez en détail le problème rencontré, les étapes pour le reproduire, etc."
            rows={6}
            className="w-full text-sm md:text-base font-roboto px-4 py-3 border-2 border-coral-200 rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all resize-none"
            disabled={isSending}
          />
        </div>

        {/* Upload de captures d'écran */}
        <div>
          <label className="block text-sm font-semibold text-cocoa-800 mb-2 font-roboto">
            Captures d'écran (optionnel, max 3)
          </label>
          
          <div className="space-y-3">
            {/* Preview des images */}
            {screenshots.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {screenshots.map((file, index) => (
                  <div key={index} className="relative group bg-white rounded-xl border-2 border-coral-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                    {/* Image */}
                     <div className="aspect-video w-full bg-gray-100 flex items-center justify-center">
                      {previewUrls[index] ? (
                        <img
                          src={previewUrls[index]}
                          alt={`Screenshot ${index + 1}`}
                          className="w-full h-full object-contain"
                          onLoad={() => {
                            console.log('✅ Image affichée:', file.name, previewUrls[index]);
                          }}
                          onError={(e) => {
                            console.error('❌ Erreur chargement image:', file.name, previewUrls[index]);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-cocoa-400">
                          <ImageIcon className="w-12 h-12" />
                          <span className="text-sm">Chargement...</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Info bar */}
                    <div className="p-3 bg-coral-50 border-t border-coral-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <ImageIcon className="w-4 h-4 text-coral-600 flex-shrink-0" />
                          <span className="text-xs font-medium text-cocoa-800 truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeScreenshot(index)}
                          className="flex-shrink-0 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-cocoa-600">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bouton d'upload */}
            {screenshots.length < 3 && (
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isSending}
                />
                <div className="border-2 border-dashed border-coral-300 rounded-xl p-6 text-center cursor-pointer hover:border-coral-500 hover:bg-coral-50 transition-all">
                  <Upload className="w-8 h-8 text-coral-500 mx-auto mb-2" />
                  <p className="text-xs md:text-sm font-semibold text-cocoa-800 font-roboto ">
                    Cliquez pour ajouter des captures d'écran
                  </p>
                  <p className="text-xs md:text-sm text-cocoa-600 mt-1 font-roboto">
                    PNG, JPG, GIF (max 3 fichiers)
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex gap-3">
            <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800">
              <p className="font-semibold font-roboto">Conseil</p>
              <p className="text-sm md:text-base mt-1 font-roboto">
                Les captures d'écran nous aident à mieux comprendre votre problème et à le résoudre plus rapidement.
              </p>
            </div>
          </div>
        </div>

        {/* Bouton d'envoi */}
        <button
          type="submit"
          disabled={isSending}
          className="w-full py-4 text-sm md:text-base font-roboto bg-gradient-to-r from-coral-500 to-sunset-500 text-white font-bold rounded-xl hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Envoyer le message
            </>
          )}
        </button>
      </form>
    </div>
  );
};
