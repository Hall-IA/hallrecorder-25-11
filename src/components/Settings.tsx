import { useState, useEffect } from 'react';
import { Save, Upload, X, Mail, BookOpen, Plus, Trash2, Sparkles, Eye, Search } from 'lucide-react';
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

  const handleAddContact = async (groupId: string) => {
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
  const handleSaveSummaryMode = async () => {
    setIsSavingSummaryMode(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          default_summary_mode: defaultSummaryMode || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      onDefaultSummaryModeChange?.(defaultSummaryMode ? (defaultSummaryMode as SummaryMode) : null);
      
      await showAlert({
        title: 'Sauvegardé !',
        message: 'Le mode de résumé par défaut a été enregistré',
        variant: 'success',
      });
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
    <div className="h-full bg-gradient-to-br from-peach-50 via-white to-coral-50 p-4 md:p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-cocoa-900 mb-8 animate-fadeInDown">
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
                <h3 className="text-2xl font-bold text-cocoa-900 mb-2">Paramètres sauvegardés !</h3>
                <p className="text-cocoa-600 mb-6">Vos paramètres ont été enregistrés avec succès et seront utilisés dans tous vos emails.</p>
                <button
                  onClick={() => setShowSaveSuccess(false)}
                  className="px-6 py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold hover:from-coral-600 hover:to-sunset-600 transition-all shadow-md"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

      <div className="space-y-6">
        {/* Résumé par défaut */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 animate-fadeInUp delay-200">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <h3 className="text-xl font-bold text-cocoa-900 mb-1">Mode de résumé par défaut</h3>
              <p className="text-sm text-cocoa-600">
                Choisissez la version générée automatiquement quand l&apos;enregistrement s&apos;arrête.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!defaultSummaryMode && (
                <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                  Aucun mode sélectionné
                </span>
              )}
              <button
                onClick={handleSaveSummaryMode}
                disabled={isSavingSummaryMode}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold hover:from-coral-600 hover:to-sunset-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingSummaryMode ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm">Sauvegarde...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span className="text-sm">Sauvegarder</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <button
              type="button"
              onClick={() => setDefaultSummaryMode('detailed')}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${defaultSummaryMode === 'detailed'
                ? 'border-coral-400 bg-gradient-to-br from-coral-50 to-orange-50 shadow-lg'
                : 'border-cocoa-100 bg-white hover:border-coral-200'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-coral-500" />
                <span className="font-semibold text-cocoa-900">Résumé détaillé</span>
              </div>
              <p className="text-sm text-cocoa-600">
                Compte-rendu complet avec tous les détails importants de votre réunion.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setDefaultSummaryMode('short')}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${defaultSummaryMode === 'short'
                ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 shadow-lg'
                : 'border-cocoa-100 bg-white hover:border-orange-200'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                <span className="font-semibold text-cocoa-900">Résumé court</span>
              </div>
              <p className="text-sm text-cocoa-600">
                L'essentiel en quelques lignes, parfait pour les réunions courtes ou un aperçu rapide.
              </p>
            </button>
          </div>
        </div>

        {/* Choix de la méthode d'envoi email */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 animate-fadeInUp delay-300">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="text-xl font-bold text-cocoa-900 mb-1">Méthode d'envoi email</h3>
              <p className="text-sm text-cocoa-600">
                Choisissez comment vous souhaitez envoyer vos emails de compte-rendu
              </p>
            </div>
            <button
              onClick={handleSaveEmailMethod}
              disabled={isSavingEmailMethod}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold hover:from-coral-600 hover:to-sunset-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingEmailMethod ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="text-sm">Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="text-sm">Sauvegarder</span>
                </>
              )}
            </button>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 bg-gradient-to-br from-peach-50 to-coral-50 rounded-xl border-2 border-coral-200 cursor-pointer hover:border-coral-300 transition-all">
              <input
                type="radio"
                name="emailMethod"
                value="gmail"
                checked={emailMethod === 'gmail'}
                onChange={(e) => setEmailMethod(e.target.value as 'gmail' | 'local' | 'smtp')}
                className="mt-1 w-5 h-5 text-coral-600 border-gray-300 focus:ring-coral-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#EA4335"/>
                  </svg>
                  <span className="font-semibold text-cocoa-800">Mon compte Gmail</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Recommandé</span>
                </div>
                <p className="text-sm text-cocoa-600 mt-1">
                  Envoi automatique depuis votre compte Gmail
                </p>
                {gmailConnected && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">✓ Connecté</span>
                    <span className="text-cocoa-600">{gmailEmail}</span>
                  </div>
                )}
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 bg-gradient-to-br from-peach-50 to-coral-50 rounded-xl border-2 border-coral-200 cursor-pointer hover:border-coral-300 transition-all">
              <input
                type="radio"
                name="emailMethod"
                value="local"
                checked={emailMethod === 'local'}
                onChange={(e) => setEmailMethod(e.target.value as 'gmail' | 'local' | 'smtp')}
                className="mt-1 w-5 h-5 text-coral-600 border-gray-300 focus:ring-coral-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-cocoa-800">Mon application email</span>
                </div>
                <p className="text-sm text-cocoa-600 mt-1">
                  Ouvre Outlook, Thunderbird ou votre application habituelle
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 bg-gradient-to-br from-peach-50 to-coral-50 rounded-xl border-2 border-coral-200 cursor-pointer hover:border-coral-300 transition-all">
              <input
                type="radio"
                name="emailMethod"
                value="smtp"
                checked={emailMethod === 'smtp'}
                onChange={(e) => setEmailMethod(e.target.value as 'gmail' | 'local' | 'smtp')}
                className="mt-1 w-5 h-5 text-coral-600 border-gray-300 focus:ring-coral-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <span className="font-semibold text-cocoa-800">Autre messagerie</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Avancé</span>
                </div>
                <p className="text-sm text-cocoa-600 mt-1">
                  Utilisez Outlook professionnel, Yahoo Mail ou une autre messagerie
                </p>
              </div>
            </label>
          </div>

          {/* Configuration Gmail */}
          {emailMethod === 'gmail' && !gmailConnected && (
            <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 space-y-4">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#EA4335"/>
                </svg>
                <h4 className="font-bold text-cocoa-900">Connecter votre compte Gmail</h4>
              </div>
              <p className="text-sm text-cocoa-700">
                Pour utiliser l'envoi direct via Gmail, vous devez d'abord connecter votre compte Gmail.
                Vos emails seront envoyés directement depuis votre compte Gmail sans limite de longueur.
              </p>
              <button
                onClick={async () => {
                  setIsConnectingGmail(true);
                  try {
                    // Récupérer le token d'accès de la session Supabase
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      throw new Error('Session non trouvée');
                    }

                    // Stocker le token dans une variable globale accessible par la popup
                    (window as any).__gmailAuthToken = session.access_token;

                    const clientId = import.meta.env.VITE_GMAIL_CLIENT_ID;
                    const redirectUri = `${window.location.origin}/gmail-callback`;
                    const scope = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';

                    // Encoder le token dans le state
                    const state = btoa(JSON.stringify({ token: session.access_token }));

                    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

                    window.open(authUrl, '_blank', 'width=500,height=600');
                  } catch (error) {
                    console.error('Erreur lors de la connexion Gmail:', error);
                    await showAlert({
                      title: 'Erreur de connexion Gmail',
                      message: 'Erreur lors de la connexion Gmail',
                      variant: 'danger',
                    });
                  } finally {
                    setIsConnectingGmail(false);
                  }
                }}
                disabled={isConnectingGmail}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {isConnectingGmail ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Connexion...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="white"/>
                    </svg>
                    Connecter mon compte Gmail
                  </>
                )}
              </button>
            </div>
          )}

          {emailMethod === 'gmail' && gmailConnected && (
            <div className="mt-4 p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 space-y-3">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <h4 className="font-bold text-cocoa-900">Gmail connecté</h4>
              </div>
              <p className="text-sm text-cocoa-700">
                Votre compte Gmail <strong>{gmailEmail}</strong> est connecté. Vos emails seront envoyés directement via Gmail.
              </p>
              <button
                onClick={async () => {
                  const confirmed = await showConfirm({
                    title: 'Déconnecter Gmail',
                    message: 'Voulez-vous vraiment déconnecter votre compte Gmail ?',
                    confirmLabel: 'Déconnecter',
                    variant: 'warning',
                  });
                  if (!confirmed) return;

                  await supabase
                    .from('user_settings')
                    .update({
                      gmail_connected: false,
                      gmail_email: null,
                      gmail_access_token: null,
                      gmail_refresh_token: null,
                      gmail_token_expiry: null,
                    })
                    .eq('user_id', userId);

                  setGmailConnected(false);
                  setGmailEmail('');
                  await showAlert({
                    title: 'Gmail déconnecté',
                    message: 'Compte Gmail déconnecté',
                    variant: 'info',
                  });
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all text-sm"
              >
                Déconnecter Gmail
              </button>
            </div>
          )}

          {emailMethod === 'smtp' && (
            <div className="mt-4 p-5 bg-gradient-to-br from-peach-50 to-coral-50 rounded-xl border-2 border-coral-200 space-y-4">
              <h4 className="font-bold text-cocoa-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-coral-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Configuration de votre messagerie
              </h4>
              <p className="text-sm text-cocoa-600 mb-3">
                Entrez les paramètres de votre compte email professionnel ou personnel
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Serveur email *
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-2 border-2 border-coral-200 rounded-xl focus:ring-2 focus:ring-coral-500 focus:border-coral-500 bg-white text-cocoa-800"
                  />
                  <p className="text-xs text-cocoa-500 mt-1">Ex: smtp.gmail.com, smtp.office365.com</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Port *
                  </label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                    placeholder="587"
                    className="w-full px-4 py-2 border-2 border-coral-200 rounded-xl focus:ring-2 focus:ring-coral-500 focus:border-coral-500 bg-white text-cocoa-800"
                  />
                  <p className="text-xs text-cocoa-500 mt-1">Généralement 587 ou 465</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Email / Utilisateur *
                  </label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-2 border-2 border-coral-200 rounded-xl focus:ring-2 focus:ring-coral-500 focus:border-coral-500 bg-white text-cocoa-800"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-semibold text-cocoa-700">
                      Mot de passe *
                    </label>
                    {hasExistingPassword && !isPasswordModified && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
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
                      onChange={(e) => {
                        setSmtpPassword(e.target.value);
                        setIsPasswordModified(true);
                      }}
                      onFocus={() => {
                        // Vider le placeholder au focus si mot de passe existe
                        if (hasExistingPassword && !isPasswordModified) {
                          setSmtpPassword('');
                        }
                      }}
                      placeholder={hasExistingPassword && !isPasswordModified ? "••••••••••••" : "Nouveau mot de passe"}
                      autoComplete="new-password"
                      data-form-type="other"
                      className="w-full px-4 py-2 pr-12 border-2 border-coral-200 rounded-xl focus:ring-2 focus:ring-coral-500 focus:border-coral-500 bg-white text-cocoa-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-400 hover:text-cocoa-600 transition-colors"
                      title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-cocoa-500 mt-1">
                    Pour Gmail: utilisez un mot de passe d'application
                  </p>
                </div>
              </div>

              {/* Nom de l'expéditeur */}
              <div className="mt-4 p-4 bg-white rounded-xl border-2 border-blue-200">
                <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                  Nom de l'expéditeur (optionnel)
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Ex: Mon Entreprise, Support Client..."
                  className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-cocoa-800"
                />
                <p className="text-xs text-cocoa-500 mt-2">
                  📧 Ce nom sera affiché aux destinataires. Si vide, seule votre adresse email sera visible.
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-gradient-to-br from-peach-50 to-coral-50 rounded-lg border border-coral-200">
                <input
                  type="checkbox"
                  id="smtp-secure"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="w-4 h-4 text-coral-600 border-gray-300 rounded focus:ring-coral-500"
                />
                <label htmlFor="smtp-secure" className="text-sm text-cocoa-700 cursor-pointer">
                  Utiliser une connexion sécurisée (TLS/SSL) - Recommandé
                </label>
              </div>

              {/* Bouton Tester la connexion */}
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleTestSmtpConnection}
                  disabled={isTestingSmtp || !smtpHost || !smtpUser}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                    isTestingSmtp
                      ? 'bg-gray-400 text-white cursor-wait'
                      : !smtpHost || !smtpUser
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
                  }`}
                >
                  {isTestingSmtp ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Test en cours...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Tester la connexion SMTP</span>
                    </>
                  )}
                </button>

                {/* Résultat du test */}
                {smtpTestResult && (
                  <div className={`p-4 rounded-xl border-2 ${
                    smtpTestResult.success
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-red-50 border-red-300 text-red-800'
                  }`}>
                    <p className="font-semibold">{smtpTestResult.message}</p>
                    {smtpTestResult.success && (
                      <p className="text-sm mt-1">Vous pouvez maintenant enregistrer vos paramètres.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>⚠️ Important:</strong> Pour Gmail, vous devez créer un "Mot de passe d'application" 
                  dans les paramètres de sécurité de votre compte Google. Les mots de passe normaux ne fonctionnent pas.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 animate-fadeInUp delay-300">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="text-xl font-bold text-cocoa-900 mb-1">Signature Email</h3>
              <p className="text-sm text-cocoa-600">
                Cette signature sera ajoutée automatiquement en bas de tous les emails de compte-rendu
              </p>
            </div>
            <button
              onClick={handleSaveSignature}
              disabled={isSavingSignature}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl font-semibold hover:from-coral-600 hover:to-sunset-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingSignature ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="text-sm">Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="text-sm">Sauvegarder</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                Logo de signature (optionnel)
              </label>
              <div className="flex items-start gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Aperçu du logo"
                      className="w-32 h-32 object-contain rounded-lg border-2 border-coral-200 bg-white p-2"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
                <label className="inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <div className="inline-flex min-w-[180px] items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-coral-500 to-sunset-500 text-white rounded-xl hover:from-coral-600 hover:to-sunset-600 transition-all cursor-pointer font-semibold shadow-md hover:shadow-lg">
                    <Upload className="w-5 h-5" />
                    {logoPreview ? 'Changer le logo' : 'Ajouter un logo'}
                  </div>
                </label>
              </div>
              <p className="text-xs text-cocoa-600 mt-2">
                Le logo sera affiché dans votre signature email (formats acceptés : PNG, JPG, SVG)
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                Informations de signature
              </label>
              <textarea
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Jean Dupont&#10;Directeur Commercial&#10;Mon Entreprise SA&#10;Tél : +33 1 23 45 67 89&#10;www.exemple.com"
                rows={6}
                className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-coral-500 text-cocoa-800 resize-none font-mono text-sm"
              />
              <p className="text-xs text-cocoa-600 mt-2">
                Saisissez toutes les informations que vous souhaitez voir apparaître dans votre signature (nom, poste, entreprise, téléphone, site web, etc.). Les retours à la ligne seront préservés.
              </p>

              {/* Aperçu de la signature */}
              {(signatureText || logoPreview) && (
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Aperçu de la signature
                  </label>
                  <div className="bg-gradient-to-br from-peach-50 to-coral-50 rounded-lg p-4 border-2 border-coral-200">
                    {signatureText && (
                      <pre className="whitespace-pre-wrap text-cocoa-800 font-sans text-sm mb-3">{signatureText}</pre>
                    )}
                    {logoPreview && (
                      <div className="mt-3 pt-3 border-t border-coral-200">
                        <img 
                          src={logoPreview} 
                          alt="Logo de signature" 
                          className="max-w-[80px] h-auto"
                          style={{ maxWidth: '80px', height: 'auto' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dictionnaire personnalisé */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 animate-fadeInUp delay-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-cocoa-900">Dictionnaire personnalisé</h3>
              <p className="text-sm text-cocoa-600">Enregistrez les termes spécifiques à corriger automatiquement</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Mot incorrect
                  </label>
                  <input
                    type="text"
                    value={newIncorrectWord}
                    onChange={(e) => setNewIncorrectWord(e.target.value)}
                    placeholder="ex: hallia, olia"
                    className="w-full px-4 py-2 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-cocoa-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Correction
                  </label>
                  <input
                    type="text"
                    value={newCorrectWord}
                    onChange={(e) => setNewCorrectWord(e.target.value)}
                    placeholder="ex: Hallia, OLIA"
                    className="w-full px-4 py-2 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-cocoa-800"
                  />
                </div>
              </div>
              <button
                onClick={handleAddWord}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Ajouter au dictionnaire
              </button>
            </div>

            {/* Bouton pour voir les mots */}
            <button
              onClick={() => setShowDictionaryModal(true)}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <Eye className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-700">
                Voir le dictionnaire
              </span>
              {customDictionary.length > 0 && (
                <span className="px-2.5 py-0.5 bg-blue-500 text-white text-sm font-bold rounded-full">
                  {customDictionary.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Groupes de destinataires */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 animate-fadeInUp delay-400">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-cocoa-900">Groupes de destinataires</h3>
                <p className="text-sm text-cocoa-600">Créez des groupes de contacts pour envoyer vos emails rapidement</p>
              </div>
            </div>
            <button
              onClick={() => setIsCreatingGroup(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-purple-700 transition-all shadow-md"
            >
              <Plus className="w-5 h-5" />
              Nouveau groupe
            </button>
          </div>

          {/* Formulaire de création de groupe */}
          {isCreatingGroup && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-200 mb-4">
              <h4 className="font-semibold text-cocoa-900 mb-3">Créer un nouveau groupe</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Nom du groupe *
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Ex: Équipe commerciale"
                    className="w-full px-4 py-2 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-cocoa-700 mb-2">
                    Description (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder="Ex: Tous les membres de l'équipe commerciale"
                    className="w-full px-4 py-2 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCreateGroup}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Créer le groupe
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingGroup(false);
                      setNewGroupName('');
                      setNewGroupDescription('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-cocoa-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Liste des groupes */}
          <div className="space-y-4">
            {contactGroups.length > 0 ? (
              contactGroups.map((group) => (
                <div key={group.id} className="border-2 border-purple-200 rounded-xl p-4 bg-gradient-to-br from-white to-purple-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-cocoa-900 text-lg">{group.name}</h4>
                      {group.description && (
                        <p className="text-sm text-cocoa-600 mt-1">{group.description}</p>
                      )}
                      <p className="text-xs text-cocoa-500 mt-1">
                        {group.contacts.length} contact{group.contacts.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer le groupe"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Liste des contacts du groupe */}
                  {selectedGroup === group.id ? (
                    <div className="mt-4 space-y-3">
                      <div className="bg-white rounded-lg p-3 border border-purple-200">
                        <h5 className="font-semibold text-cocoa-900 mb-3 text-sm">Contacts du groupe</h5>
                        {group.contacts.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {group.contacts.map((contact) => (
                              <div key={contact.id} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                <div className="flex-1">
                                  <p className="font-medium text-cocoa-900 text-sm">{contact.name || 'Sans nom'}</p>
                                  <p className="text-xs text-cocoa-600">{contact.email}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteContact(contact.id)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-cocoa-500 italic mb-3">Aucun contact dans ce groupe</p>
                        )}

                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newContactName}
                            onChange={(e) => setNewContactName(e.target.value)}
                            placeholder="Nom (optionnel)"
                            className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <input
                            type="email"
                            value={newContactEmail}
                            onChange={(e) => setNewContactEmail(e.target.value)}
                            placeholder="Email *"
                            className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <button
                            onClick={() => handleAddContact(group.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            Ajouter un contact
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedGroup(null)}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Fermer
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedGroup(group.id)}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Gérer les contacts ({group.contacts.length})
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-cocoa-500">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun groupe de destinataires</p>
                <p className="text-xs mt-1">Créez votre premier groupe pour organiser vos contacts</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

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
                    <h2 className="text-xl font-bold">Dictionnaire personnalisé</h2>
                    <p className="text-blue-100 text-sm">
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
                    className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50"
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
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Incorrect</span>
                            <p className="text-gray-800 font-medium">{entry.incorrect_word}</p>
                          </div>
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="flex-1">
                              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Correction</span>
                              <p className="text-green-700 font-semibold">{entry.correct_word}</p>
                            </div>
                            <span className="text-green-500">→</span>
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
                      <p className="font-medium">Aucun résultat pour "{dictionarySearch}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium text-gray-600">Dictionnaire vide</p>
                  <p className="text-sm mt-1">Ajoutez des mots via le formulaire ci-dessus</p>
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
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
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
