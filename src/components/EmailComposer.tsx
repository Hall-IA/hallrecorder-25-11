import { X, Plus, Trash2, Send, Paperclip, Upload, Download } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './EmailComposer.css';
import { EmailAttachment, supabase } from '../lib/supabase';
import { useDialog } from '../context/DialogContext';

interface Recipient {
  email: string;
}

interface EmailComposerProps {
  subject: string;
  initialBody: string;
  recipients: Recipient[];
  ccRecipients?: Recipient[];
  bccRecipients?: Recipient[];
  attachments?: EmailAttachment[];
  onSend: (data: {
    recipients: Recipient[];
    ccRecipients: Recipient[];
    bccRecipients: Recipient[];
    subject: string;
    htmlBody: string;
    textBody: string;
    attachments: EmailAttachment[];
    method: 'gmail' | 'smtp' | 'app';
  }) => Promise<void>;
  onClose: () => void;
  isSending: boolean;
  onMethodChange?: (method: 'gmail' | 'smtp' | 'app') => void;
}

export function EmailComposer({
  subject: initialSubject,
  initialBody,
  recipients: initialRecipients,
  ccRecipients: initialCcRecipients = [],
  bccRecipients: initialBccRecipients = [],
  attachments: initialAttachments = [],
  onSend,
  onClose,
  isSending,
  onMethodChange,
}: EmailComposerProps) {
  console.log('📧 EmailComposer render - initialBody length:', initialBody.length);
  console.log('📧 EmailComposer render - has img tag:', initialBody.includes('<img'));
  console.log('📧 EmailComposer render - has data:image:', initialBody.includes('data:image'));

  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients.length > 0 ? initialRecipients : [{ email: '' }]);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>(initialCcRecipients);
  const [bccRecipients, setBccRecipients] = useState<Recipient[]>(initialBccRecipients);
  const [showCC, setShowCC] = useState(initialCcRecipients.length > 0);
  const [showBCC, setShowBCC] = useState(initialBccRecipients.length > 0);
  const [attachments, setAttachments] = useState<EmailAttachment[]>(initialAttachments);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [emailMethod, setEmailMethod] = useState<'gmail' | 'smtp' | 'app'>('app');
  const [availableMethods, setAvailableMethods] = useState<{ gmail: boolean; smtp: boolean }>({ gmail: false, smtp: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showAlert } = useDialog();

  // Contact Groups
  const [contactGroups, setContactGroups] = useState<Array<{ id: string; name: string; contacts: Array<{ name: string; email: string }> }>>([]);
  const [showGroupSelector, setShowGroupSelector] = useState(false);

  const quillRef = useRef<ReactQuill>(null);

  // Fonction pour changer de méthode d'envoi
  const handleMethodChange = (method: 'gmail' | 'smtp' | 'app') => {
    // Vérifier si la méthode est disponible
    if (method === 'gmail' && !availableMethods.gmail) {
      showAlert({
        title: 'Gmail non configuré',
        message: 'Veuillez connecter votre compte Gmail dans les Paramètres pour utiliser cette méthode.',
        variant: 'warning',
      });
      return;
    }
    if (method === 'smtp' && !availableMethods.smtp) {
      showAlert({
        title: 'SMTP non configuré',
        message: 'Veuillez configurer votre serveur SMTP dans les Paramètres pour utiliser cette méthode.',
        variant: 'warning',
      });
      return;
    }

    setEmailMethod(method);
    onMethodChange?.(method);
  };

  // Charger la méthode d'envoi configurée et les groupes de contacts
  useEffect(() => {
    const loadEmailMethod = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_settings')
        .select('email_method, gmail_connected, smtp_host')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        // Stocker les méthodes disponibles
        setAvailableMethods({
          gmail: !!data.gmail_connected,
          smtp: !!data.smtp_host,
        });

        if (data.email_method === 'gmail' && data.gmail_connected) {
          setEmailMethod('gmail');
        } else if (data.email_method === 'smtp' && data.smtp_host) {
          setEmailMethod('smtp');
        } else {
          setEmailMethod('app');
        }
      } else {
        setEmailMethod('app');
        setAvailableMethods({ gmail: false, smtp: false });
      }
    };

    const loadContactGroups = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger les groupes
      const { data: groups } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (groups) {
        // Pour chaque groupe, charger ses contacts
        const groupsWithContacts = await Promise.all(
          groups.map(async (group) => {
            const { data: contacts } = await supabase
              .from('contacts')
              .select('name, email')
              .eq('group_id', group.id);

            return {
              ...group,
              contacts: contacts || []
            };
          })
        );

        setContactGroups(groupsWithContacts);
      }
    };

    loadEmailMethod();
    loadContactGroups();
  }, []);

  // Fonction pour construire le corps avec les pièces jointes
  const buildBodyWithAttachments = useCallback((baseBody: string, attachmentsList: EmailAttachment[]): string => {
    // Retirer toute section existante de pièces jointes
    let cleanBody = baseBody.replace(/<hr[^>]*>\s*<h2[^>]*>Documents joints<\/h2>[\s\S]*?<\/ul>\s*/g, '');

    if (attachmentsList.length === 0 || emailMethod !== 'app') {
      return cleanBody;
    }

    // Ajouter la section des pièces jointes avant "Je reste à votre disposition"
    let attachmentsHtml = `<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">

<h2 style="color: #EF6855; font-size: 1.3em; margin-bottom: 15px;">Documents joints</h2>
<ul style="list-style-type: none; padding: 0;">
`;
    attachmentsList.forEach(att => {
      attachmentsHtml += `  <li style="margin-bottom: 8px;">📎 <a href="${att.url}" style="color: #EF6855; text-decoration: none; font-weight: 500;">${att.name}</a></li>\n`;
    });
    attachmentsHtml += `</ul>\n\n`;

    // Trouver où insérer (juste avant "Je reste à votre disposition")
    const dispositionText = '<p>Je reste à votre disposition';
    const insertPosition = cleanBody.indexOf(dispositionText);

    if (insertPosition !== -1) {
      return cleanBody.slice(0, insertPosition) +
             attachmentsHtml +
             cleanBody.slice(insertPosition);
    }

    return cleanBody;
  }, [emailMethod]);

  // Mettre à jour le corps quand les pièces jointes changent
  useEffect(() => {
    const newBody = buildBodyWithAttachments(initialBody, attachments);
    setBody(newBody);
  }, [attachments, initialBody, buildBodyWithAttachments]);

  // Configuration de l'éditeur Quill
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet',
    'align',
    'link',
    'image'
  ];

  // Gestion des destinataires
  const addRecipient = () => {
    setRecipients(prev => [...prev, { email: '' }]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, value: string) => {
    setRecipients(prev => prev.map((r, i) => i === index ? { email: value } : r));
  };

  // Gestion CC
  const addCcRecipient = () => {
    setCcRecipients(prev => [...prev, { email: '' }]);
  };

  const removeCcRecipient = (index: number) => {
    setCcRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const updateCcRecipient = (index: number, value: string) => {
    setCcRecipients(prev => prev.map((r, i) => i === index ? { email: value } : r));
  };

  // Gestion BCC
  const addBccRecipient = () => {
    setBccRecipients(prev => [...prev, { email: '' }]);
  };

  const removeBccRecipient = (index: number) => {
    setBccRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const updateBccRecipient = (index: number, value: string) => {
    setBccRecipients(prev => prev.map((r, i) => i === index ? { email: value } : r));
  };

  // Gestion des groupes de contacts
  const handleSelectGroup = (groupId: string) => {
    const group = contactGroups.find(g => g.id === groupId);
    if (!group) return;

    // Ajouter tous les contacts du groupe aux destinataires
    const newRecipients = group.contacts.map(contact => ({ email: contact.email }));
    setRecipients(prev => {
      // Filtrer les champs vides et éviter les doublons
      const filteredPrev = prev.filter(r => r.email.trim() !== '');
      const existingEmails = new Set(filteredPrev.map(r => r.email.toLowerCase()));
      const uniqueNewRecipients = newRecipients.filter(r => !existingEmails.has(r.email.toLowerCase()));

      // Si tout était vide, retourner uniquement les nouveaux contacts
      if (filteredPrev.length === 0) {
        return uniqueNewRecipients;
      }

      return [...filteredPrev, ...uniqueNewRecipients];
    });
    setShowGroupSelector(false);
  };

  // Gestion des pièces jointes
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Convertir FileList en Array
    const filesArray = Array.from(files);

    console.log('📤 Upload - Nombre de fichiers:', filesArray.length);

    // Vérifier la taille de chaque fichier (limite à 10MB)
    for (const file of filesArray) {
      console.log('📤 Upload - Fichier:', file.name, 'Taille:', file.size, 'Type:', file.type);
      if (file.size > 10 * 1024 * 1024) {
        await showAlert({
          title: 'Fichier trop volumineux',
          message: `❌ Le fichier "${file.name}" est trop volumineux. Taille maximale: 10 MB`,
          variant: 'warning',
        });
        return;
      }
    }

    setIsUploadingAttachment(true);
    try {
      const newAttachments: EmailAttachment[] = [];

      // Upload tous les fichiers
      for (const file of filesArray) {
        const fileExt = file.name.split('.').pop();
        const fileName = `email-attachments/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        console.log('📤 Upload vers Supabase:', fileName, 'Taille fichier:', file.size);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meeting-attachments')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        console.log('📤 Upload result:', { data: uploadData, error: uploadError });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('meeting-attachments')
          .getPublicUrl(fileName);

        console.log('📤 URL publique:', urlData.publicUrl);

        const newAttachment: EmailAttachment = {
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type
        };

        console.log('📤 Attachment créé:', newAttachment);

        newAttachments.push(newAttachment);
      }

      console.log('✅ Upload terminé - Nombre de PJ:', newAttachments.length);

      // Ajouter tous les nouveaux fichiers aux pièces jointes existantes
      setAttachments(prev => [...prev, ...newAttachments]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement:', error);
      await showAlert({
        title: 'Erreur de téléchargement',
        message: '❌ Erreur lors du téléchargement des fichiers',
        variant: 'danger',
      });
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // Conversion HTML vers texte brut avec formatage préservé
  const htmlToPlainText = (html: string): string => {
    let text = html;

    // Remplacer les balises de titres par du texte en MAJUSCULES avec séparateurs
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n$1\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n▸ $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n▹ $1\n');

    // Préserver les listes à puces
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '  • $1\n');
    text = text.replace(/<\/ul>/gi, '\n');

    // Préserver les liens avec leur URL
    text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)');

    // Remplacer les paragraphes par des sauts de ligne
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');

    // Remplacer les <br> par des sauts de ligne
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Remplacer les <hr> par des lignes de séparation
    text = text.replace(/<hr[^>]*>/gi, '\n' + '─'.repeat(60) + '\n');

    // Préserver le gras avec des caractères Unicode
    text = text.replace(/<strong>(.*?)<\/strong>/gi, (match, p1) => {
      return p1.split('').map((char: string) => {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + (code - 65));
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
        if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7EC + (code - 48));
        return char;
      }).join('');
    });

    // Supprimer toutes les autres balises HTML
    text = text.replace(/<[^>]*>/g, '');

    // Décoder les entités HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = text;
    text = tmp.textContent || tmp.innerText || '';

    // Nettoyer les espaces multiples et les lignes vides excessives
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  };

  // Fonction pour forcer la taille du logo à 80px dans le HTML
  const fixLogoSize = (html: string): string => {
    // Remplacer tous les attributs width et max-width des images par 80px
    let fixedHtml = html;
    
    // Remplacer width="xxx" par width="80"
    fixedHtml = fixedHtml.replace(/(<img[^>]*?)width=["']?\d+["']?([^>]*?>)/gi, '$1width="80"$2');
    
    // Remplacer max-width: xxxpx par max-width: 80px dans les styles inline
    fixedHtml = fixedHtml.replace(/max-width:\s*\d+px/gi, 'max-width: 80px');
    
    // Ajouter width="80" aux images qui n'en ont pas
    fixedHtml = fixedHtml.replace(/<img(?![^>]*width=)([^>]*?)>/gi, '<img width="80"$1>');
    
    return fixedHtml;
  };

  // Envoi de l'email
  const handleSend = async () => {
    // Validation
    const validRecipients = recipients.filter(r => r.email.trim());
    if (validRecipients.length === 0) {
      await showAlert({
        title: 'Destinataires requis',
        message: '❌ Veuillez ajouter au moins un destinataire',
        variant: 'warning',
      });
      return;
    }

    if (!subject.trim()) {
      await showAlert({
        title: 'Objet requis',
        message: '❌ Veuillez saisir un objet',
        variant: 'warning',
      });
      return;
    }

    const validCcRecipients = ccRecipients.filter(r => r.email.trim());
    const validBccRecipients = bccRecipients.filter(r => r.email.trim());

    // Forcer la taille du logo à 30px dans le HTML
    const fixedHtmlBody = fixLogoSize(body);

    console.log('📤 EmailComposer - Envoi avec méthode:', emailMethod);
    await onSend({
      recipients: validRecipients,
      ccRecipients: validCcRecipients,
      bccRecipients: validBccRecipients,
      subject,
      htmlBody: fixedHtmlBody,
      textBody: htmlToPlainText(body),
      attachments,
      method: emailMethod,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#EF6855] via-[#E5503F] to-[#D64838] text-white p-3 sm:p-6 z-10 shadow-lg">
          <div className="flex flex-col gap-3">
            {/* Ligne 1: Titre et fermer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg sm:rounded-xl flex-shrink-0">
                  <Send className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-bold truncate">Nouveau message</h2>
                  <p className="text-xs sm:text-sm text-white/80 hidden sm:block">Composez et envoyez votre email</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-all flex-shrink-0"
                disabled={isSending}
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Ligne 2: Sélecteur de méthode d'envoi */}
            <div className="flex items-center gap-1 bg-white/10 rounded-lg sm:rounded-xl p-1">
              {/* Gmail */}
              <button
                onClick={() => handleMethodChange('gmail')}
                disabled={isSending}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex-1 justify-center ${
                  emailMethod === 'gmail'
                    ? 'bg-white text-red-600 shadow-md'
                    : availableMethods.gmail
                      ? 'text-white/80 hover:bg-white/20'
                      : 'text-white/40 cursor-not-allowed'
                }`}
                title={availableMethods.gmail ? 'Envoyer via Gmail' : 'Gmail non configuré'}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                </svg>
                <span className={emailMethod === 'gmail' ? '' : 'hidden sm:inline'}>Gmail</span>
              </button>

              {/* SMTP */}
              <button
                onClick={() => handleMethodChange('smtp')}
                disabled={isSending}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex-1 justify-center ${
                  emailMethod === 'smtp'
                    ? 'bg-white text-blue-600 shadow-md'
                    : availableMethods.smtp
                      ? 'text-white/80 hover:bg-white/20'
                      : 'text-white/40 cursor-not-allowed'
                }`}
                title={availableMethods.smtp ? 'Envoyer via SMTP' : 'SMTP non configuré'}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m2 7 10 7 10-7"/>
                </svg>
                <span className={emailMethod === 'smtp' ? '' : 'hidden sm:inline'}>SMTP</span>
              </button>

              {/* App locale */}
              <button
                onClick={() => handleMethodChange('app')}
                disabled={isSending}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex-1 justify-center ${
                  emailMethod === 'app'
                    ? 'bg-white text-gray-700 shadow-md'
                    : 'text-white/80 hover:bg-white/20'
                }`}
                title="Ouvrir dans l'application email"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <path d="m3 7 9 6 9-6"/>
                </svg>
                <span className={emailMethod === 'app' ? '' : 'hidden sm:inline'}>App</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5">
          {/* Destinataires */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
              <label className="text-sm font-semibold text-gray-700 sm:w-16 sm:pt-2">À:</label>
              <div className="flex-1 space-y-2">
                {recipients.map((recipient, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        placeholder="email@exemple.com"
                        value={recipient.email}
                        onChange={(e) => updateRecipient(index, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EF6855] focus:border-transparent"
                        disabled={isSending}
                        required
                      />
                      {recipients.length > 1 && (
                        <button
                          onClick={() => removeRecipient(index)}
                          disabled={isSending}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {index === recipients.length - 1 && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={addRecipient}
                          disabled={isSending}
                          className="flex items-center gap-1.5 text-xs sm:text-sm text-[#EF6855] hover:text-[#E5503F] font-medium disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Ajouter un destinataire</span>
                          <span className="sm:hidden">+ Destinataire</span>
                        </button>
                        {contactGroups.length > 0 && (
                          <button
                            onClick={() => setShowGroupSelector(true)}
                            disabled={isSending}
                            className="flex items-center gap-1.5 text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Groupe
                          </button>
                        )}
                        {!showCC && (
                          <button
                            onClick={() => {
                              setShowCC(true);
                              if (ccRecipients.length === 0) {
                                setCcRecipients([{ name: '', email: '' }]);
                              }
                            }}
                            disabled={isSending}
                            className="flex items-center gap-1.5 text-xs sm:text-sm text-[#EF6855] hover:text-[#E5503F] font-medium disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            CC
                          </button>
                        )}
                        {!showBCC && (
                          <button
                            onClick={() => {
                              setShowBCC(true);
                              if (bccRecipients.length === 0) {
                                setBccRecipients([{ name: '', email: '' }]);
                              }
                            }}
                            disabled={isSending}
                            className="flex items-center gap-1.5 text-xs sm:text-sm text-[#EF6855] hover:text-[#E5503F] font-medium disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            CCI
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CC Recipients */}
            {showCC && (
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                <label className="text-sm font-semibold text-gray-700 sm:w-16 sm:pt-2">CC:</label>
                <div className="flex-1 space-y-2">
                  {ccRecipients.map((recipient, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        placeholder="email@exemple.com"
                        value={recipient.email}
                        onChange={(e) => updateCcRecipient(index, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EF6855] focus:border-transparent"
                        disabled={isSending}
                      />
                      <button
                        onClick={() => {
                          removeCcRecipient(index);
                          if (ccRecipients.length === 1) {
                            setShowCC(false);
                          }
                        }}
                        disabled={isSending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addCcRecipient}
                    disabled={isSending}
                    className="flex items-center gap-1.5 text-xs sm:text-sm text-[#EF6855] hover:text-[#E5503F] font-medium disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Ajouter CC
                  </button>
                </div>
              </div>
            )}

            {/* BCC Recipients */}
            {showBCC && (
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                <label className="text-sm font-semibold text-gray-700 sm:w-16 sm:pt-2">CCI:</label>
                <div className="flex-1 space-y-2">
                  {bccRecipients.map((recipient, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        placeholder="email@exemple.com"
                        value={recipient.email}
                        onChange={(e) => updateBccRecipient(index, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EF6855] focus:border-transparent"
                        disabled={isSending}
                      />
                      <button
                        onClick={() => {
                          removeBccRecipient(index);
                          if (bccRecipients.length === 1) {
                            setShowBCC(false);
                          }
                        }}
                        disabled={isSending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addBccRecipient}
                    disabled={isSending}
                    className="flex items-center gap-1.5 text-xs sm:text-sm text-[#EF6855] hover:text-[#E5503F] font-medium disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Ajouter CCI
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Objet */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <label className="text-sm font-semibold text-gray-700 sm:w-16">Objet:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de l'email"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EF6855] focus:border-transparent"
              disabled={isSending}
              required
            />
          </div>

          {/* Pièces jointes */}
          <div className="border border-gray-300 rounded-lg p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-red-50">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-[#EF6855] flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate">
                  Pièces jointes {attachments.length > 0 && `(${attachments.length})`}
                </span>
              </div>
              <label className="cursor-pointer flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isSending || isUploadingAttachment}
                />
                <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#EF6855] to-[#E5503F] text-white rounded-lg hover:from-[#E5503F] hover:to-[#D64838] transition-all font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-50">
                  {isUploadingAttachment ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                      <span className="hidden sm:inline">Upload...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Ajouter des fichiers</span>
                    </>
                  )}
                </div>
              </label>
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <div key={index} className="attachment-item flex items-center justify-between bg-white p-3 rounded-lg border-2 border-orange-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Paperclip className="w-4 h-4 text-[#EF6855] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{attachment.name}</p>
                        <p className="text-xs text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[#EF6855] hover:bg-orange-100 rounded-lg transition-colors"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => removeAttachment(index)}
                        disabled={isSending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic text-center py-2">Aucune pièce jointe pour le moment</p>
            )}
          </div>

          {/* Éditeur de contenu */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Message:</label>
            <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white email-composer-quill shadow-sm" style={{ height: '400px' }}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={body}
                onChange={setBody}
                modules={modules}
                formats={formats}
                placeholder="Écrivez votre message ici..."
                style={{ height: '340px' }}
                readOnly={isSending}
              />
            </div>
          </div>
        </div>

        {/* Footer avec boutons d'action */}
        <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-5 border-t-2 border-gray-200 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-6 py-2.5 text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl font-semibold transition-all disabled:opacity-50 shadow-sm hover:shadow"
            >
              Annuler
            </button>
            {attachments.length > 0 && (
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                {attachments.length} fichier{attachments.length > 1 ? 's' : ''} joint{attachments.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="md:px-8 md:py-3 px-3 py-3 bg-gradient-to-r from-[#EF6855] via-[#E5503F] to-[#D64838] text-white text-xs rounded-xl font-bold hover:from-[#E5503F] hover:via-[#D64838] hover:to-[#C73E2E] transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform hover:scale-105"
          >
            {isSending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Envoyer le message
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de sélection de groupe */}
      {showGroupSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Sélectionner un groupe</h3>
              <button
                onClick={() => setShowGroupSelector(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {contactGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleSelectGroup(group.id)}
                  className="w-full text-left p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl border-2 border-purple-200 hover:border-purple-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{group.name}</p>
                      <p className="text-sm text-gray-600">
                        {group.contacts.length} contact{group.contacts.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <Plus className="w-5 h-5 text-purple-600" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

