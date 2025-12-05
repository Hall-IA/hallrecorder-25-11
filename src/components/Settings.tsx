import { useState, useEffect } from 'react';
import { Save, Upload, X, Mail, BookOpen, Plus, Trash2, Sparkles, Eye, Search, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SummaryMode } from '../services/transcription';
import { invalidateDictionaryCache } from '../services/dictionaryCorrection';
import { useDialog } from '../context/DialogContext';

interface SettingsProps {
  userId: string;
  onDefaultSummaryModeChange?: (mode: SummaryMode | null) => void;
}

export const Settings = ({ userId, onDefaultSummaryModeChange }: SettingsProps) => {
  const [signatureText, setSignatureText] = useState('');
  const [signatureLogoUrl, setSignatureLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // États de sauvegarde individuels
  const [isSavingSummaryMode, setIsSavingSummaryMode] = useState(false);
  const [isSavingEmailMethod, setIsSavingEmailMethod] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [emailMethod, setEmailMethod] = useState<'gmail' | 'local' | 'smtp'>('gmail');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [senderName, setSenderName] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordModified, setIsPasswordModified] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isEditingSmtp, setIsEditingSmtp] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [customDictionary, setCustomDictionary] = useState<Array<{ id: string; incorrect_word: string; correct_word: string }>>([]);
  const [newIncorrectWord, setNewIncorrectWord] = useState('');
  const [newCorrectWord, setNewCorrectWord] = useState('');
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [dictionarySearch, setDictionarySearch] = useState('');

  const [defaultSummaryMode, setDefaultSummaryMode] = useState<SummaryMode | ''>('');
  // Contact Groups
  const [contactGroups, setContactGroups] = useState<Array<{ id: string; name: string; description: string; contacts: Array<{ id: string; name: string; email: string }> }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const { showAlert, showConfirm } = useDialog();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState<{ groupId: string; isOpen: boolean }>({ groupId: '', isOpen: false });

  useEffect(() => {
    loadSettings();
    loadCustomDictionary();
    loadContactGroups();

    // Écouter les messages de la popup OAuth
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
        console.log('✅ Gmail connecté !', event.data.email);
        setGmailConnected(true);
        setGmailEmail(event.data.email);
        // Recharger les settings pour avoir les dernières données
        loadSettings();
      } else if (event.data.type === 'GMAIL_AUTH_ERROR') {
        console.error('❌ Erreur Gmail:', event.data.error);
        await showAlert({
          title: 'Erreur de connexion Gmail',
          message: `Erreur de connexion Gmail : ${event.data.error}`,
          variant: 'danger',
        });
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [userId, showAlert]);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('signature_text, signature_logo_url, email_method, smtp_host, smtp_port, smtp_user, smtp_password_encrypted, smtp_secure, gmail_connected, gmail_email, default_summary_mode, sender_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setSignatureText(data.signature_text || '');
      setSignatureLogoUrl(data.signature_logo_url || '');
      setLogoPreview(data.signature_logo_url || '');
      setEmailMethod(data.email_method || 'gmail');
      setSmtpHost(data.smtp_host || '');
      setSmtpPort(data.smtp_port || 587);
      setSmtpUser(data.smtp_user || '');
      setSenderName(data.sender_name || '');
      
      // Si un mot de passe chiffré existe, afficher un placeholder
      if (data.smtp_password_encrypted) {
        setSmtpPassword('••••••••••••'); // Placeholder pour indiquer qu'un MDP existe
        setHasExistingPassword(true);
      } else {
        setSmtpPassword('');
        setHasExistingPassword(false);
      }
      setIsPasswordModified(false); // Reset au chargement
      
      setSmtpSecure(data.smtp_secure !== false);
      setGmailConnected(data.gmail_connected || false);
      setGmailEmail(data.gmail_email || '');
      const loadedDefaultMode = (data.default_summary_mode as SummaryMode | null) || null;
      setDefaultSummaryMode(loadedDefaultMode || '');
      onDefaultSummaryModeChange?.(loadedDefaultMode);
    }
  };

  const loadCustomDictionary = async () => {
    const { data, error } = await supabase
      .from('custom_dictionary')
      .select('id, incorrect_word, correct_word')
      .eq('user_id', userId)
      .order('incorrect_word', { ascending: true });

    if (data) {
      setCustomDictionary(data);
    }
  };

  const handleAddWord = async () => {
    if (!newIncorrectWord.trim() || !newCorrectWord.trim()) {
      await showAlert({
        title: 'Champs requis',
        message: 'Veuillez remplir les deux champs',
        variant: 'warning',
      });
      return;
    }

    const { error } = await supabase
      .from('custom_dictionary')
      .upsert({
        user_id: userId,
        incorrect_word: newIncorrectWord.toLowerCase().trim(),
        correct_word: newCorrectWord.trim(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,incorrect_word',
      });

    if (error) {
      await showAlert({
        title: 'Erreur du dictionnaire',
        message: 'Erreur lors de l\'ajout du mot',
        variant: 'danger',
      });
      console.error(error);
      return;
    }

    setNewIncorrectWord('');
    setNewCorrectWord('');
    invalidateDictionaryCache(); // Invalider le cache pour que les nouvelles corrections soient appliquées
    await loadCustomDictionary();
  };

  const handleDeleteWord = async (id: string) => {
    const { error } = await supabase
      .from('custom_dictionary')
      .delete()
      .eq('id', id);

    if (error) {
      await showAlert({
        title: 'Erreur du dictionnaire',
        message: 'Erreur lors de la suppression',
        variant: 'danger',
      });
      console.error(error);
      return;
    }

    invalidateDictionaryCache(); // Invalider le cache pour refléter la suppression
    await loadCustomDictionary();
  };

  // Contact Groups Functions
  const loadContactGroups = async () => {
    // Charger les groupes
    const { data: groups, error: groupsError } = await supabase
      .from('contact_groups')
      .select('id, name, description')
      .eq('user_id', userId)
      .order('name');

    if (groupsError) {
      console.error('Erreur lors du chargement des groupes:', groupsError);
      return;
    }

    if (groups) {
      // Pour chaque groupe, charger ses contacts
      const groupsWithContacts = await Promise.all(
        groups.map(async (group) => {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, name, email')
            .eq('group_id', group.id)
            .order('name');

          return {
            ...group,
            contacts: contacts || []
          };
        })
      );

      setContactGroups(groupsWithContacts);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      await showAlert({
        title: 'Nom requis',
        message: 'Veuillez entrer un nom de groupe',
        variant: 'warning',
      });
      return;
    }

    const { data, error } = await supabase
      .from('contact_groups')
      .insert({
        user_id: userId,
        name: newGroupName,
        description: newGroupDescription
      })
      .select()
      .single();

    if (error) {
      await showAlert({
        title: 'Erreur groupe',
        message: 'Erreur lors de la création du groupe',
        variant: 'danger',
      });
      console.error(error);
      return;
    }

    setNewGroupName('');
    setNewGroupDescription('');
    setIsCreatingGroup(false);
    await loadContactGroups();
  };

  const handleDeleteGroup = async (groupId: string) => {
    const confirmed = await showConfirm({
      title: 'Supprimer le groupe',
      message: 'Voulez-vous vraiment supprimer ce groupe et tous ses contacts ?',
      confirmLabel: 'Supprimer',
      variant: 'warning',
    });
    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from('contact_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      await showAlert({
        title: 'Erreur groupe',
        message: 'Erreur lors de la suppression du groupe',
        variant: 'danger',
      });
      console.error(error);
      return;
    }

    if (selectedGroup === groupId) {
      setSelectedGroup(null);
    }

    await loadContactGroups();
  };

  const handleAddContact = async (groupId: string, closeModal = false) => {
    if (!newContactEmail.trim()) {
      await showAlert({
        title: 'Email requis',
        message: 'Veuillez entrer une adresse email',
        variant: 'warning',
      });
      return;
    }

    const { error } = await supabase
      .from('contacts')
      .insert({
        group_id: groupId,
        name: newContactName,
        email: newContactEmail
      });

    if (error) {
      await showAlert({
        title: 'Erreur contact',
        message: 'Erreur lors de l\'ajout du contact',
        variant: 'danger',
      });
      console.error(error);
      return;
    }

    setNewContactName('');
    setNewContactEmail('');
    if (closeModal) {
      setShowAddContactModal({ groupId: '', isOpen: false });
    }
    await loadContactGroups();
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      await showAlert({
        title: 'Erreur contact',
        message: 'Erreur lors de la suppression du contact',
        variant: 'danger',
      });
      console.error(error);
      return;
    }

    await loadContactGroups();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier le type de fichier
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
      
      if (!validTypes.includes(file.type)) {
        await showAlert({
          title: 'Format non supporté',
          message: '❌ Format non supporté.\n\nFormats acceptés : PNG, JPG, GIF, WebP, SVG',
          variant: 'warning',
        });
        return;
      }

      // Vérifier la taille (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        await showAlert({
          title: 'Fichier trop volumineux',
          message: '❌ Fichier trop volumineux.\n\nTaille maximale : 2 MB',
          variant: 'warning',
        });
        return;
      }

      console.log('📷 Logo sélectionné:', file.name, file.type, `${(file.size / 1024).toFixed(2)} KB`);
      
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        console.log('✅ Aperçu du logo généré');
      };
      reader.onerror = async () => {
        console.error('❌ Erreur lecture fichier');
        await showAlert({
          title: 'Erreur lecture fichier',
          message: '❌ Erreur lors de la lecture du fichier',
          variant: 'danger',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setSignatureLogoUrl('');
  };

  const convertSvgToPng = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 400; // Largeur fixe pour bonne qualité
          canvas.height = (400 * img.height) / img.width;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context non disponible'));
            return;
          }
          
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const pngFile = new File([blob], file.name.replace(/\.svg$/i, '.png'), { type: 'image/png' });
              resolve(pngFile);
            } else {
              reject(new Error('Conversion PNG échouée'));
            }
          }, 'image/png', 0.95);
        };
        img.onerror = () => reject(new Error('Erreur chargement SVG'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsDataURL(file);
    });
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return signatureLogoUrl;

    setIsUploading(true);
    try {
      let fileToUpload = logoFile;
      
      // Convertir SVG en PNG si nécessaire
      if (logoFile.type === 'image/svg+xml') {
        console.log('🔄 Conversion SVG → PNG...');
        fileToUpload = await convertSvgToPng(logoFile);
        console.log('✅ SVG converti en PNG');
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${userId}/signature-logo-${Date.now()}.${fileExt}`;

      if (signatureLogoUrl) {
        const oldFileName = signatureLogoUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('logos')
            .remove([`${userId}/${oldFileName}`]);
        }
      }

      const contentType = fileToUpload.type || 'application/octet-stream';
      console.log('📤 Upload du logo:', fileName, contentType);

      const { error: uploadError, data } = await supabase.storage
        .from('logos')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: contentType
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      await showAlert({
        title: 'Erreur upload logo',
        message: `Erreur lors du téléchargement du logo: ${error.message || 'Erreur inconnue'}`,
        variant: 'danger',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);

    try {
      // Validation basique
      if (!smtpHost || !smtpUser) {
        setSmtpTestResult({
          success: false,
          message: 'Veuillez remplir le serveur SMTP et l\'email/utilisateur'
        });
        setIsTestingSmtp(false);
        return;
      }

      // Si le mot de passe n'a pas été modifié, demander à l'utilisateur
      if (!isPasswordModified && hasExistingPassword) {
        const shouldUseExisting = await showConfirm({
          title: 'Mot de passe déjà enregistré',
          message:
            'Voulez-vous tester avec le mot de passe déjà enregistré ?\n\n' +
            'OK = Utiliser le mot de passe enregistré\n' +
            'Annuler = Saisir un nouveau mot de passe',
          confirmLabel: 'Utiliser le mot de passe',
          cancelLabel: 'Saisir un nouveau',
          variant: 'info',
        });

        if (!shouldUseExisting) {
          setSmtpTestResult({
            success: false,
            message: 'Veuillez saisir un mot de passe pour tester la connexion'
          });
          setIsTestingSmtp(false);
          return;
        }
      } else if (!smtpPassword || smtpPassword === '••••••••••••') {
        setSmtpTestResult({
          success: false,
          message: 'Veuillez saisir un mot de passe pour tester la connexion'
        });
        setIsTestingSmtp(false);
        return;
      }

      console.log('🔌 Test de connexion SMTP...');

      // Appeler l'Edge Function de test
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-smtp-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          password: isPasswordModified ? smtpPassword : undefined, // Si non modifié, utiliser celui en DB
          secure: smtpPort === 465,
          userId: userId,
          useExistingPassword: !isPasswordModified && hasExistingPassword
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSmtpTestResult({
          success: true,
          message: '✅ Connexion réussie ! Les identifiants sont corrects.'
        });
      } else {
        setSmtpTestResult({
          success: false,
          message: `❌ Échec de connexion : ${result.error || 'Erreur inconnue'}`
        });
      }
    } catch (error: any) {
      console.error('Erreur test SMTP:', error);
      setSmtpTestResult({
        success: false,
        message: `❌ Erreur : ${error.message}`
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Fonctions de sauvegarde individuelles
  const handleSelectSummaryMode = async (mode: SummaryMode) => {
    setDefaultSummaryMode(mode);
    setIsSavingSummaryMode(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          default_summary_mode: mode,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      onDefaultSummaryModeChange?.(mode);
    } catch (error) {
      console.error('Erreur:', error);
      await showAlert({
        title: 'Erreur',
        message: 'Erreur lors de la sauvegarde du mode de résumé',
        variant: 'danger',
      });
    } finally {
      setIsSavingSummaryMode(false);
    }
  };

  const handleSaveEmailMethod = async () => {
    setIsSavingEmailMethod(true);
    try {
      // Chiffrer le mot de passe SMTP si modifié
      let passwordUpdate = {};
      
      if (isPasswordModified && smtpPassword && smtpPassword.trim() !== '' && smtpPassword !== '••••••••••••') {
        console.log('🔐 Chiffrement du nouveau mot de passe SMTP...');
        
        const { data: encryptedPassword, error: encryptError } = await supabase
          .rpc('encrypt_smtp_password', {
            password: smtpPassword,
            user_id: userId
          });

        if (encryptError) {
          console.error('Erreur lors du chiffrement du mot de passe:', encryptError);
          throw new Error('Impossible de chiffrer le mot de passe SMTP');
        }

        passwordUpdate = {
          smtp_password_encrypted: encryptedPassword,
          smtp_password: null
        };
        
        console.log('✅ Mot de passe SMTP chiffré avec succès');
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          email_method: emailMethod,
          smtp_host: smtpHost || null,
          smtp_port: smtpPort || null,
          smtp_user: smtpUser || null,
          sender_name: senderName.trim() || null,
          ...passwordUpdate,
          smtp_secure: smtpSecure,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      await loadSettings();
      
      await showAlert({
        title: 'Sauvegardé !',
        message: 'La méthode d\'envoi email a été enregistrée',
        variant: 'success',
      });
    } catch (error) {
      console.error('Erreur:', error);
      await showAlert({
        title: 'Erreur',
        message: 'Erreur lors de la sauvegarde de la méthode d\'envoi',
        variant: 'danger',
      });
    } finally {
      setIsSavingEmailMethod(false);
    }
  };

  const handleSaveSignature = async () => {
    setIsSavingSignature(true);
    try {
      let finalLogoUrl = signatureLogoUrl;

      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          finalLogoUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          signature_text: signatureText,
          signature_logo_url: finalLogoUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSignatureLogoUrl(finalLogoUrl);
      setLogoPreview(finalLogoUrl);
      setLogoFile(null);

      await showAlert({
        title: 'Sauvegardé !',
        message: 'La signature email a été enregistrée',
        variant: 'success',
      });
    } catch (error) {
      console.error('Erreur:', error);
      await showAlert({
        title: 'Erreur',
        message: 'Erreur lors de la sauvegarde de la signature',
        variant: 'danger',
      });
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Supprimer l'affichage du récapitulatif séparé - tout sera affiché dans le mode édition

  return (
    <div className="h-full bg-gradient-to-br from-peach-50 via-white to-coral-50 p-3 md:p-6 lg:p-8 overflow-auto font-roboto">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-cocoa-900 mb-6 md:mb-8 animate-fadeInDown font-roboto">
          Paramètres
        </h2>

        {/* Message de succès - Modal centré */}
        {showSaveSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform animate-scaleIn">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-cocoa-900 mb-2 font-roboto">Paramètres sauvegardés !</h3>
                <p className="text-cocoa-600 mb-6 font-roboto">Vos paramètres ont été enregistrés avec succès et seront utilisés dans tous vos emails.</p>
                <button
                  onClick={() => setShowSaveSuccess(false)}
                  className="px-6 py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold hover:from-coral-600 hover:to-sunset-600 transition-all shadow-md font-roboto"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 md:space-y-6">
        {/* Résumé par défaut - Design PRO */}
        <div className="bg-[#FAFAFA] rounded-2xl shadow-sm border border-gray-200 px-2 py-4 md-p-5 lg-p-5 xl:p-5 animate-fadeInUp delay-200">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="hidden md:block p-2 md:p-2.5 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl shadow-md flex-shrink-0">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-gray-900 font-roboto">Mode de résumé par défaut</h3>
              <p className="text-xs md:text-sm text-gray-500 font-roboto">Choisissez la version générée automatiquement</p>
            </div>
            {isSavingSummaryMode && (
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 font-roboto">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-coral-500 border-t-transparent"></div>
                <span className="hidden lg:inline">Sauvegarde...</span>
              </div>
            )}
          </div>

          {/* Cards selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSelectSummaryMode('detailed')}
              disabled={isSavingSummaryMode}
              className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                defaultSummaryMode === 'detailed'
                  ? 'border-coral-400 bg-white shadow-lg'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
            >
              {defaultSummaryMode === 'detailed' && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-coral-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${defaultSummaryMode === 'detailed' ? 'bg-coral-100' : 'bg-gray-100'}`}>
                  <Sparkles className={`w-5 h-5 ${defaultSummaryMode === 'detailed' ? 'text-coral-600' : 'text-gray-500'}`} />
                </div>
                <span className="text-base font-semibold text-gray-900 font-roboto">Résumé détaillé</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed font-roboto">
                Rapport complet avec l'ensemble des détails importants de votre réunion.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSummaryMode('short')}
              disabled={isSavingSummaryMode}
              className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                defaultSummaryMode === 'short'
                  ? 'border-orange-400 bg-white shadow-lg'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
            >
              {defaultSummaryMode === 'short' && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${defaultSummaryMode === 'short' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                  <Sparkles className={`w-5 h-5 ${defaultSummaryMode === 'short' ? 'text-orange-600' : 'text-gray-500'}`} />
                </div>
                <span className="font-semibold text-base text-gray-900 font-roboto">Résumé court</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed font-roboto">
                L'essentiel en quelques lignes, idéal pour les réunions courtes ou un aperçu rapide.
              </p>
            </button>
          </div>
        </div>

        {/* Choix de la méthode d'envoi email - Design PRO */}
        <div className="bg-[#FAFAFA] rounded-2xl shadow-sm border border-gray-200 px-2 py-4 md-p-5 lg-p-5 xl:p-5 animate-fadeInUp delay-300">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className=" hidden md:block p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl shadow-md shadow-orange-200/50">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 font-roboto">Méthode d'envoi email</h3>
                <p className="text-sm text-gray-500 font-roboto">Configurez l'envoi de vos comptes-rendus</p>
              </div>
            </div>
            <button
              onClick={handleSaveEmailMethod}
              disabled={isSavingEmailMethod}
              className="flex items-center text-sm md:text-base gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all shadow-md shadow-orange-200/50 disabled:opacity-50 disabled:cursor-not-allowed font-roboto"
            >
              {isSavingEmailMethod ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span className="font-roboto">Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="font-roboto">Sauvegarder</span>
                </>
              )}
            </button>
          </div>

          {/* Segmented Control */}
          <div className="bg-gray-100 p-1 rounded-lg flex justify-center w-full md:inline-flex md:w-auto mb-6">
            <button
              type="button"
              onClick={() => setEmailMethod('gmail')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all font-roboto ${
                  emailMethod === 'gmail'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              {/* Logo Gmail moderne - M coloré */}
              <svg className="hidden md:block w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="url(#gmail-gradient)"/>
                <defs>
                  <linearGradient id="gmail-gradient" x1="0" y1="12" x2="24" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#EA4335"/>
                    <stop offset="0.25" stopColor="#FBBC05"/>
                    <stop offset="0.5" stopColor="#34A853"/>
                    <stop offset="0.75" stopColor="#4285F4"/>
                    <stop offset="1" stopColor="#EA4335"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-roboto">Gmail</span>
              {gmailConnected && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
            </button>
            <button
              type="button"
              onClick={() => setEmailMethod('local')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-4 py-2.5 rounded-md text-xs md:text-sm font-medium transition-all font-roboto ${
                  emailMethod === 'local'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline font-roboto">Application email</span>
              <span className="sm:hidden font-roboto">App mail</span>
            </button>
            <button
              type="button"
              onClick={() => setEmailMethod('smtp')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-4 py-2.5 rounded-md text-xs md:text-sm font-medium transition-all font-roboto ${
                  emailMethod === 'smtp'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              {/* Icône SMTP - Serveur technique */}
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 11-2 0 1 1 0 012 0zM2 13a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm14 1a1 1 0 11-2 0 1 1 0 012 0z"/>
              </svg>
              <span className="hidden sm:inline font-roboto">SMTP avancé</span>
              <span className="sm:hidden font-roboto">SMTP</span>
            </button>
          </div>

          {/* Content based on selection */}
          <div className="transition-all duration-300 ease-in-out">
            {/* Gmail Content */}
            {emailMethod === 'gmail' && (
              <div className="bg-white rounded-xl border border-gray-200 px-2 py-4 md:p-5 shadow-sm">
                {!gmailConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-50 rounded-lg">
                        {/* Logo Gmail moderne - M coloré */}
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
                          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="url(#gmail-icon-gradient)"/>
                          <defs>
                            <linearGradient id="gmail-icon-gradient" x1="0" y1="12" x2="24" y2="12" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#EA4335"/>
                              <stop offset="0.25" stopColor="#FBBC05"/>
                              <stop offset="0.5" stopColor="#34A853"/>
                              <stop offset="0.75" stopColor="#4285F4"/>
                              <stop offset="1" stopColor="#EA4335"/>
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 font-roboto">Connectez votre compte Gmail</h4>
                        <p className="text-sm text-gray-600 mt-1 font-roboto">
                          Envoi automatique et direct depuis votre boîte Gmail. Aucune configuration technique requise.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium font-roboto">Recommandé</span>
                    </div>
                    <button
                      onClick={async () => {
                        setIsConnectingGmail(true);
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) throw new Error('Session non trouvée');
                          (window as any).__gmailAuthToken = session.access_token;
                          const clientId = import.meta.env.VITE_GMAIL_CLIENT_ID;
                          const redirectUri = `${window.location.origin}/gmail-callback`;
                          const scope = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';
                          const state = btoa(JSON.stringify({ token: session.access_token }));
                          const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
                          window.open(authUrl, '_blank', 'width=500,height=600');
                        } catch (error) {
                          console.error('Erreur lors de la connexion Gmail:', error);
                          await showAlert({ title: 'Erreur de connexion Gmail', message: 'Erreur lors de la connexion Gmail', variant: 'danger' });
                        } finally {
                          setIsConnectingGmail(false);
                        }
                      }}
                      disabled={isConnectingGmail}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#2563EB] text-white rounded-lg font-medium hover:bg-[#1D4ED8] transition-all disabled:opacity-50 font-roboto"
                    >
                      {isConnectingGmail ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span className="font-roboto">Connexion en cours...</span>
                        </>
                      ) : (
                        <>
                          {/* Logo Gmail moderne - M coloré (blanc) */}
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="white"/>
                          </svg>
                          <span className="font-roboto">Connecter mon compte Gmail</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 ">
                    <div className="flex items-center gap-3 py-1 px-2 md:p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="p-1.5 bg-green-500 rounded-full hidden md:block">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-800 font-roboto">Gmail connecté</p>
                        <p className="text-sm text-green-700 font-roboto">{gmailEmail}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const confirmed = await showConfirm({ title: 'Déconnecter Gmail', message: 'Voulez-vous vraiment déconnecter votre compte Gmail ?', confirmLabel: 'Déconnecter', variant: 'warning' });
                        if (!confirmed) return;
                        await supabase.from('user_settings').update({ gmail_connected: false, gmail_email: null, gmail_access_token: null, gmail_refresh_token: null, gmail_token_expiry: null }).eq('user_id', userId);
                        setGmailConnected(false);
                        setGmailEmail('');
                        await showAlert({ title: 'Gmail déconnecté', message: 'Compte Gmail déconnecté', variant: 'info' });
                      }}
                      className="text-sm text-red-600 hover:text-red-700 font-medium font-roboto"
                    >
                      Déconnecter le compte
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Local Email Content */}
            {emailMethod === 'local' && (
              <div className="bg-white rounded-xl border border-gray-200 px-2 py-4 md:p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Mail className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 font-roboto">Application email locale</h4>
                    <p className="text-sm text-gray-600 mt-1 font-roboto">
                      Ouvre automatiquement votre application email (Outlook, Thunderbird, Mail...) avec le compte-rendu pré-rempli. Vous gardez le contrôle avant l'envoi.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 font-roboto">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-roboto">Aucune configuration requise</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SMTP Content */}
            {emailMethod === 'smtp' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Mode compact (SMTP configuré et pas en édition) */}
                {smtpHost && smtpUser && hasExistingPassword && !isEditingSmtp ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 font-roboto">SMTP configuré</p>
                          <p className="text-xs text-gray-500 font-roboto">
                            {smtpHost}:{smtpPort} ({smtpUser})
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsEditingSmtp(true)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-roboto"
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Mode édition (formulaire complet) */
                  <div className="p-5 space-y-5">
                    {/* SMTP Form - 2 columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5 font-roboto">
                          Serveur SMTP
                        </label>
                        <input
                          type="text"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.example.com"
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm font-roboto"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5 font-roboto">
                          Port
                        </label>
                        <input
                          type="number"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                          placeholder="587"
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm font-roboto"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5 font-roboto">
                          Email / Identifiant
                        </label>
                        <input
                          type="email"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                          placeholder="votre@email.com"
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm font-roboto"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <label className="text-sm font-medium text-gray-700 font-roboto">Mot de passe</label>
                          {hasExistingPassword && !isPasswordModified && (
                            <span className="text-xs text-green-600 flex items-center gap-1 font-roboto">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Enregistré
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={smtpPassword}
                            onChange={(e) => { setSmtpPassword(e.target.value); setIsPasswordModified(true); }}
                            onFocus={() => { if (hasExistingPassword && !isPasswordModified) setSmtpPassword(''); }}
                            placeholder={hasExistingPassword && !isPasswordModified ? "••••••••" : "Mot de passe"}
                            autoComplete="new-password"
                            className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm font-roboto"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5 font-roboto">
                          Nom d'expéditeur <span className="text-gray-400 font-normal">(optionnel)</span>
                        </label>
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Mon Entreprise"
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm font-roboto"
                        />
                      </div>
                    </div>

                    {/* TLS/SSL Checkbox */}
                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        id="smtp-secure"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 font-roboto">Connexion sécurisée (TLS/SSL)</span>
                        <p className="text-xs text-gray-500 font-roboto">Recommandé pour la sécurité de vos données</p>
                      </div>
                    </label>

                    {/* Test Button */}
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleTestSmtpConnection}
                        disabled={isTestingSmtp || !smtpHost || !smtpUser}
                        className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium transition-all font-roboto ${
                          isTestingSmtp
                            ? 'bg-gray-200 text-gray-500 cursor-wait'
                            : !smtpHost || !smtpUser
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {isTestingSmtp ? (
                          <>
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            <span className="font-roboto">Test en cours...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="font-roboto">Tester la connexion SMTP</span>
                          </>
                        )}
                      </button>

                      {/* Test Result */}
                      {smtpTestResult && (
                        <div className={`mt-3 p-3 rounded-lg text-sm ${
                          smtpTestResult.success
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                          <p className="font-medium font-roboto">{smtpTestResult.message}</p>
                        </div>
                      )}
                    </div>

                    {/* Info note */}
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs text-amber-800 font-roboto">
                        Pour Gmail, utilisez un <strong>mot de passe d'application</strong> depuis les paramètres de sécurité Google.
                      </p>
                    </div>

                    {/* Bouton Annuler si en mode édition */}
                    {isEditingSmtp && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => setIsEditingSmtp(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-roboto"
                        >
                          Fermer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signature Email - Design PRO */}
        <div className="bg-[#FAFAFA] rounded-2xl shadow-sm border border-gray-200 px-2 py-4 md-p-5 lg-p-5 xl:p-5  animate-fadeInUp delay-300">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="hidden md:block p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl shadow-md shadow-orange-200/50">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className=" text-lg font-bold text-gray-900 font-roboto">Signature Email</h3>
                <p className="text-sm text-gray-500 font-roboto">Ajoutée automatiquement à vos emails</p>
              </div>
            </div>
            <button
              onClick={handleSaveSignature}
              disabled={isSavingSignature}
              className="flex items-center text-sm md:text-base gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all shadow-md shadow-orange-200/50 disabled:opacity-50 disabled:cursor-not-allowed font-roboto"
            >
              {isSavingSignature ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span className="font-roboto">Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="font-roboto">Sauvegarder</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche : Logo + Texte */}
            <div className="space-y-5">
              {/* Logo section */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-3 font-roboto">
                  Logo de la signature <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                {logoPreview ? (
                  <div className="space-y-3">
                    <div className="relative inline-block">
                      <div className="w-20 h-20 rounded-lg border border-gray-200 bg-white p-2 flex items-center justify-center">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 bg-gray-900 text-white rounded-full hover:bg-gray-700 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm w-full font-roboto">
                        <Upload className="w-4 h-4" />
                        Changer
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm font-roboto">
                        <Upload className="w-4 h-4" />
                        Importer
                      </div>
                    </label>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-3 font-roboto">
                  Formats acceptés : PNG, JPG, SVG
                </p>
              </div>

              {/* Texte de signature */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-3 font-roboto">
                  Informations de signature
                </label>
                <textarea
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  placeholder="Jean Dupont&#10;Directeur Commercial&#10;Mon Entreprise SA&#10;Tél : +33 1 23 45 67 89&#10;www.exemple.com"
                  rows={5}
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 resize-none text-sm leading-relaxed font-roboto"
                />
                <p className="text-xs text-gray-500 mt-2 font-roboto">
                  Ces informations apparaîtront dans votre signature email.
                </p>
              </div>
            </div>

            {/* Colonne droite : Aperçu */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-3 font-roboto">
                Aperçu de la signature
              </label>
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 min-h-[200px]">
                {(signatureText || logoPreview) ? (
                  <div className="space-y-4">
                    {signatureText && (
                      <pre className="whitespace-pre-wrap text-gray-800 font-sans text-sm leading-relaxed font-roboto">{signatureText}</pre>
                    )}
                    {logoPreview && (
                      <div className={signatureText ? "pt-3 border-t border-gray-200" : ""}>
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-12 w-auto object-contain"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm font-roboto">
                    <div className="text-center">
                      <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>Votre signature apparaîtra ici</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Avancée - Design Compact Pro */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fadeInUp delay-300">

          {/* Section Dictionnaire - Design Compact */}
          <div>
            {/* En-tête avec zone de saisie intégrée */}
            <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="hidden md:flex w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-900 font-roboto">Correction automatique</span>
                    <span className="text-xs text-gray-500 truncate font-roboto">Personnalisez les mots corrigés dans les résumés</span>
                  </div>
                </div>
                {customDictionary.length > 0 && (
                  <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs font-medium rounded-full self-start sm:self-center font-roboto">
                    {customDictionary.length}
                  </span>
                )}
              </div>

              {/* Zone de saisie inline */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={newIncorrectWord}
                  onChange={(e) => setNewIncorrectWord(e.target.value)}
                  placeholder="Mot incorrect"
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-all font-roboto"
                />
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0 self-center sm:self-auto rotate-90 sm:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <input
                  type="text"
                  value={newCorrectWord}
                  onChange={(e) => setNewCorrectWord(e.target.value)}
                  placeholder="Correction"
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-all font-roboto"
                />
                <button
                  onClick={handleAddWord}
                  disabled={!newIncorrectWord || !newCorrectWord}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                    newIncorrectWord && newCorrectWord
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Liste des mots - Avec scroll interne */}
            {customDictionary.length > 0 ? (
              <div className="max-h-[280px] overflow-y-auto">
                <div className="divide-y divide-gray-50">
                  {customDictionary.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-500 truncate flex-1">{entry.incorrect_word}</span>
                      <svg className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="text-sm text-gray-900 font-medium truncate flex-1">{entry.correct_word}</span>
                      <button
                        onClick={() => handleDeleteWord(entry.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-gray-400 font-roboto">Aucune correction configurée</p>
              </div>
            )}
          </div>

          {/* Section Groupes - Design Compact */}
          <div className="border-t border-gray-100">
            {/* En-tête */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="hidden md:flex w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900 font-roboto">Groupes de contacts</span>
                    <span className="text-xs text-gray-500 font-roboto">Créez des listes pour envoyer vos résumés rapidement</span>
                  </div>
                  {contactGroups.length > 0 && (
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs font-medium rounded-full font-roboto">
                      {contactGroups.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors font-roboto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau</span>
                </button>
              </div>

              {/* Formulaire de création inline */}
              {isCreatingGroup && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nom du groupe"
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-all font-roboto"
                  />
                  <input
                    type="text"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder="Description"
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-all font-roboto"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateGroup}
                      disabled={!newGroupName}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all font-roboto ${
                        newGroupName
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Créer
                    </button>
                    <button
                      onClick={() => { setIsCreatingGroup(false); setNewGroupName(''); setNewGroupDescription(''); }}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Liste des groupes - Avec scroll interne */}
            {contactGroups.length > 0 ? (
              <div className="max-h-[320px] overflow-y-auto">
                <div className="divide-y divide-gray-50">
                  {contactGroups.map((group) => {
                    const colors = [
                      { bg: 'bg-blue-500', text: 'text-white' },
                      { bg: 'bg-emerald-500', text: 'text-white' },
                      { bg: 'bg-purple-500', text: 'text-white' },
                      { bg: 'bg-amber-500', text: 'text-white' },
                      { bg: 'bg-rose-500', text: 'text-white' },
                    ];
                    const colorIndex = group.name.charCodeAt(0) % colors.length;
                    const color = colors[colorIndex];
                    const initials = group.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                    return (
                      <div key={group.id}>
                        {/* Ligne groupe */}
                        <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                          {/* Avatar compact */}
                          <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center flex-shrink-0`}>
                            <span className={`text-xs font-bold ${color.text} font-roboto`}>{initials}</span>
                          </div>
                          {/* Nom + description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate font-roboto">{group.name}</p>
                            {group.description && (
                              <p className="text-xs text-gray-400 truncate font-roboto">{group.description}</p>
                            )}
                          </div>
                          {/* Badge contacts */}
                          <span className="text-xs text-gray-500 flex-shrink-0 font-roboto">
                            {group.contacts.length} contact{group.contacts.length !== 1 ? 's' : ''}
                          </span>
                          {/* Actions - toujours visibles */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                selectedGroup === group.id
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'text-gray-300 hover:text-orange-600 hover:bg-orange-50'
                              }`}
                              title="Gérer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(group.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Panel contacts (expandable) */}
                        {selectedGroup === group.id && (
                          <div className="px-5 pb-4 pt-2 bg-gray-50/50 border-t border-gray-100">
                            {/* Liste contacts avec scroll */}
                            {group.contacts.length > 0 && (
                              <div className="space-y-1 mb-3 max-h-[150px] overflow-y-auto">
                                {group.contacts.map((contact) => (
                                  <div key={contact.id} className="flex items-center gap-2 py-1.5 px-3 bg-white rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-gray-700 truncate block font-roboto">{contact.name || contact.email}</span>
                                      {contact.name && <span className="text-xs text-gray-400 truncate block font-roboto">{contact.email}</span>}
                                    </div>
                                    <button
                                      onClick={() => handleDeleteContact(contact.id)}
                                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Ajouter contact inline - Desktop */}
                            <div className="hidden md:flex items-center gap-2">
                              <input
                                type="text"
                                value={newContactName}
                                onChange={(e) => setNewContactName(e.target.value)}
                                placeholder="Nom"
                                className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded text-sm placeholder-gray-400 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 font-roboto"
                              />
                              <input
                                type="email"
                                value={newContactEmail}
                                onChange={(e) => setNewContactEmail(e.target.value)}
                                placeholder="Email"
                                className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded text-sm placeholder-gray-400 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 font-roboto"
                              />
                              <button
                                onClick={() => handleAddContact(group.id)}
                                disabled={!newContactEmail}
                                className={`w-8 h-8 rounded flex items-center justify-center transition-all flex-shrink-0 ${
                                  newContactEmail
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {/* Bouton Ajouter destinataire - Mobile */}
                            <button
                              onClick={() => setShowAddContactModal({ groupId: group.id, isOpen: true })}
                              className="md:hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium text-sm font-roboto"
                            >
                              <Plus className="w-4 h-4" />
                              Ajouter un destinataire
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400 mb-3 font-roboto">Aucun groupe</p>
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium font-roboto"
                >
                  + Créer un groupe
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Modal Ajouter destinataire - Mobile */}
      {showAddContactModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:hidden font-roboto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden animate-scaleIn font-roboto">
            {/* Header */}
            <div 
              className="p-4 text-white flex items-center justify-between font-roboto"
              style={{
                background: `conic-gradient(
                  from 195.77deg at 84.44% -1.66%,
                  #FE9736 0deg,
                  #F4664C 76.15deg,
                  #F97E41 197.31deg,
                  #E3AB8D 245.77deg,
                  #FE9736 360deg
                )`
              }}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <h3 className="text-lg font-semibold font-roboto">Ajouter un destinataire</h3>
              </div>
              <button
                onClick={() => {
                  setShowAddContactModal({ groupId: '', isOpen: false });
                  setNewContactName('');
                  setNewContactEmail('');
                }}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 font-roboto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-roboto">Nom (optionnel)</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Nom du destinataire"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 font-roboto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-roboto">Email <span className="text-red-500 font-roboto">*</span></label>
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 font-roboto"
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex gap-2 font-roboto">
              <button
                onClick={() => {
                  setShowAddContactModal({ groupId: '', isOpen: false });
                  setNewContactName('');
                  setNewContactEmail('');
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors font-roboto"
              >
                Annuler
              </button>
              <button
                onClick={() => handleAddContact(showAddContactModal.groupId, true)}
                disabled={!newContactEmail}
                className={`flex-1 px-4 py-2.5 rounded-lg text-white font-medium text-sm transition-all font-roboto ${
                  newContactEmail
                    ? ''
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
                style={newContactEmail ? {
                  background: `conic-gradient(
                    from 195.77deg at 84.44% -1.66%,
                    #FE9736 0deg,
                    #F4664C 76.15deg,
                    #F97E41 197.31deg,
                    #E3AB8D 245.77deg,
                    #FE9736 360deg
                  )`
                } : {}}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal du dictionnaire */}
      {showDictionaryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-roboto">Dictionnaire personnalisé</h2>
                    <p className="text-blue-100 text-sm font-roboto">
                      {customDictionary.length} mot{customDictionary.length > 1 ? 's' : ''} enregistré{customDictionary.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDictionaryModal(false);
                    setDictionarySearch('');
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Barre de recherche */}
              {customDictionary.length > 5 && (
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
                  <input
                    type="text"
                    value={dictionarySearch}
                    onChange={(e) => setDictionarySearch(e.target.value)}
                    placeholder="Rechercher un mot..."
                    className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 font-roboto"
                  />
                </div>
              )}
            </div>

            {/* Liste des mots */}
            <div className="flex-1 overflow-y-auto p-4">
              {customDictionary.length > 0 ? (
                <div className="space-y-2">
                  {customDictionary
                    .filter(entry => 
                      !dictionarySearch || 
                      entry.incorrect_word.toLowerCase().includes(dictionarySearch.toLowerCase()) ||
                      entry.correct_word.toLowerCase().includes(dictionarySearch.toLowerCase())
                    )
                    .map((entry, index) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div className="flex-1 grid grid-cols-2 gap-6 min-w-0">
                          <div className="min-w-0">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider font-roboto">Incorrect</span>
                            <p className="text-gray-800 font-medium font-roboto">{entry.incorrect_word}</p>
                          </div>
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="flex-1">
                              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider font-roboto">Correction</span>
                              <p className="text-green-700 font-semibold font-roboto">{entry.correct_word}</p>
                            </div>
                            <span className="text-green-500 font-roboto">→</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteWord(entry.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-lg transition-all ml-4 opacity-50 group-hover:opacity-100"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  
                  {/* Message si recherche sans résultat */}
                  {dictionarySearch && customDictionary.filter(entry => 
                    entry.incorrect_word.toLowerCase().includes(dictionarySearch.toLowerCase()) ||
                    entry.correct_word.toLowerCase().includes(dictionarySearch.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium font-roboto">Aucun résultat pour "{dictionarySearch}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium text-gray-600 font-roboto">Dictionnaire vide</p>
                  <p className="text-sm mt-1 font-roboto">Ajoutez des mots via le formulaire ci-dessus</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <button
                onClick={() => {
                  setShowDictionaryModal(false);
                  setDictionarySearch('');
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-roboto"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
