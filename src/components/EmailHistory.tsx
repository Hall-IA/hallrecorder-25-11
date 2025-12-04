import { useState, useEffect, useMemo } from 'react';
import { Mail, Calendar, User, Paperclip, CheckCircle, XCircle, Trash2, ExternalLink, Search, Filter, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDialog } from '../context/DialogContext';

interface EmailOpenEvent {
  id: string;
  recipient_email: string | null;
  opened_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface EmailHistoryItem {
  id: string;
  meeting_id: string | null;
  recipients: string;
  cc_recipients: string | null;
  subject: string;
  method: string;
  html_body: string | null;
  attachments_count: number;
  total_attachments_size: number | null;
  status: string;
  error_message: string | null;
  message_id: string | null;
  sent_at: string;
  tracking_id?: string;
  open_count?: number;
  first_opened_at?: string | null;
  email_open_events?: EmailOpenEvent[];
}

interface EmailHistoryProps {
  userId: string;
  onViewMeeting?: (meetingId: string) => void;
}

const ITEMS_PER_PAGE = 10;

export const EmailHistory = ({ userId, onViewMeeting }: EmailHistoryProps) => {
  const [emails, setEmails] = useState<EmailHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<EmailHistoryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openRecipientsEmailId, setOpenRecipientsEmailId] = useState<string | null>(null);
  const { showAlert, showConfirm } = useDialog();
  
  // États des filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<'all' | 'gmail' | 'smtp'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadEmailHistory();

    // Temps réel : écouter les nouvelles ouvertures et mettre à jour SILENCIEUSEMENT
    const channel = supabase
      .channel('email-tracking-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_open_events',
        },
        (payload) => {
          console.log('📬 Nouvelle ouverture détectée en temps réel:', payload);
          const newEvent = payload.new as EmailOpenEvent & { email_history_id: string };

          // Mise à jour silencieuse : ajouter l'event aux données locales
          setEmails(prevEmails => prevEmails.map(email => {
            // Chercher l'email correspondant (par id direct ou dans le groupe)
            const isMatch = email.id === newEvent.email_history_id;
            if (!isMatch) return email;

            // Ajouter le nouvel event en tête de liste (plus récent)
            const updatedEvents = [
              {
                id: newEvent.id,
                recipient_email: newEvent.recipient_email,
                opened_at: newEvent.opened_at,
                ip_address: newEvent.ip_address,
                user_agent: newEvent.user_agent,
              },
              ...(email.email_open_events || []),
            ];

            return {
              ...email,
              email_open_events: updatedEvents,
              open_count: (email.open_count || 0) + 1,
              first_opened_at: email.first_opened_at || newEvent.opened_at,
            };
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (openRecipientsEmailId && expandedEmail !== openRecipientsEmailId) {
      setOpenRecipientsEmailId(null);
    }
  }, [expandedEmail, openRecipientsEmailId]);

  const loadEmailHistory = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('email_history')
        .select('*, email_open_events(id, recipient_email, opened_at, ip_address, user_agent)')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Trier les events par date décroissante pour chaque email
      const dataWithSortedEvents = (data || []).map(email => ({
        ...email,
        email_open_events: (email.email_open_events || []).sort(
          (a: EmailOpenEvent, b: EmailOpenEvent) =>
            new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
        ),
      }));

      // 🎯 GROUPER les emails par tracking_id (envoi individuel)
      const groupedEmails = groupEmailsByTrackingId(dataWithSortedEvents);
      setEmails(groupedEmails);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 🎯 Fonction pour grouper les emails par tracking_id
  const groupEmailsByTrackingId = (emails: EmailHistoryItem[]): EmailHistoryItem[] => {
    console.log('🔍 Groupement emails - Total reçus:', emails.length);
    
    const grouped = new Map<string, EmailHistoryItem>();

    emails.forEach(email => {
      const trackingId = email.tracking_id || email.id; // Fallback sur id si pas de tracking_id
      
      console.log('📧 Email:', {
        id: email.id,
        tracking_id: email.tracking_id,
        recipient: email.recipients,
        subject: email.subject.substring(0, 50)
      });
      
      if (grouped.has(trackingId)) {
        // Fusionner avec l'email existant
        const existing = grouped.get(trackingId)!;
        console.log('🔄 Fusion avec email existant, tracking_id:', trackingId);
        
        // Combiner les destinataires
        const allRecipients = [
          ...parseRecipientList(existing.recipients),
          ...parseRecipientList(email.recipients),
        ];
        existing.recipients = Array.from(new Set(allRecipients)).join(', ');
        
        // Combiner les CC
        if (email.cc_recipients) {
          const allCC = [
            ...parseRecipientList(existing.cc_recipients || ''),
            ...parseRecipientList(email.cc_recipients),
          ];
          existing.cc_recipients = Array.from(new Set(allCC)).filter(c => c).join(', ');
        }
        
        // Combiner les events d'ouverture
        existing.email_open_events = [
          ...(existing.email_open_events || []),
          ...(email.email_open_events || []),
        ];
        
        // Utiliser la date la plus récente
        if (new Date(email.sent_at) > new Date(existing.sent_at)) {
          existing.sent_at = email.sent_at;
        }
        
        console.log('✅ Après fusion, recipients:', existing.recipients);
      } else {
        // Premier email de ce groupe
        console.log('➕ Nouvel email, tracking_id:', trackingId);
        grouped.set(trackingId, { ...email });
      }
    });

    const result = Array.from(grouped.values()).sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    
    console.log('✅ Groupement terminé - Total groupés:', result.length);
    result.forEach(email => {
      console.log('📬 Email groupé:', email.subject.substring(0, 50), '→', email.recipients);
    });
    
    return result;
  };

  const handleDelete = async (emailId: string) => {
    const confirmed = await showConfirm({
      title: 'Supprimer l\'email',
      message: 'Supprimer cet email de l\'historique ?',
      confirmLabel: 'Supprimer',
      variant: 'warning',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('email_history')
        .delete()
        .eq('id', emailId);

      if (error) throw error;

      setEmails(emails.filter(e => e.id !== emailId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      await showAlert({
        title: 'Erreur',
        message: 'Erreur lors de la suppression',
        variant: 'danger',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Il y a moins d\'une heure';
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatExactDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getMethodBadge = (method: string) => {
    const badges = {
      gmail: { color: 'bg-gray-100 text-gray-600', label: 'Gmail' },
      smtp: { color: 'bg-gray-100 text-gray-600', label: 'SMTP' },
      local: { color: 'bg-gray-100 text-gray-600', label: 'Local' }
    };
    const badge = badges[method as keyof typeof badges] || badges.local;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const parseRecipientList = (list: string | null) => {
    if (!list) return [] as string[];
    return list
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  const buildRecipientStatuses = (email: EmailHistoryItem) => {
    const toRecipients = parseRecipientList(email.recipients).map(address => ({ email: address, type: 'À' }));
    const ccRecipients = parseRecipientList(email.cc_recipients).map(address => ({ email: address, type: 'CC' }));
    const recipients = [...toRecipients, ...ccRecipients];

    // Regrouper TOUTES les ouvertures par destinataire
    const openedMap = new Map<string, EmailOpenEvent[]>();
    (email.email_open_events || []).forEach(evt => {
      if (evt.recipient_email) {
        const key = evt.recipient_email.trim().toLowerCase();
        if (!openedMap.has(key)) {
          openedMap.set(key, []);
        }
        openedMap.get(key)!.push(evt);
      }
    });

    return recipients.map(rec => {
      const key = rec.email.trim().toLowerCase();
      const opens = openedMap.get(key) || [];
      return {
        ...rec,
        opens, // Toutes les ouvertures
        openCount: opens.length,
        firstOpenedAt: opens.length > 0 ? opens[opens.length - 1].opened_at : null, // Plus ancienne
        lastOpenedAt: opens.length > 0 ? opens[0].opened_at : null, // Plus récente
      };
    });
  };

  // Calculer le total d'ouvertures pour un email
  const getTotalOpenCount = (email: EmailHistoryItem) => {
    return email.open_count || (email.email_open_events?.length || 0);
  };

  // Retirer le pixel de tracking du HTML pour la prévisualisation
  const sanitizeHtmlForPreview = (html: string | null): string => {
    if (!html) return '';
    // Retirer les images de tracking (1x1 pixels avec email-open-tracker dans l'URL)
    return html
      .replace(/<img[^>]*email-open-tracker[^>]*>/gi, '')
      .replace(/<img[^>]*width=["']?1["']?[^>]*height=["']?1["']?[^>]*>/gi, '')
      .replace(/<img[^>]*height=["']?1["']?[^>]*width=["']?1["']?[^>]*>/gi, '');
  };

  // Fonction de filtrage
  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      // Filtre de recherche (sujet, destinataires)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSubject = email.subject.toLowerCase().includes(query);
        const matchesRecipients = email.recipients.toLowerCase().includes(query);
        const matchesCC = email.cc_recipients?.toLowerCase().includes(query);
        if (!matchesSubject && !matchesRecipients && !matchesCC) return false;
      }

      // Filtre de méthode
      if (filterMethod !== 'all' && email.method !== filterMethod) return false;

      // Filtre de statut
      if (filterStatus !== 'all' && email.status !== filterStatus) return false;

      // Filtre de date
      if (filterDateRange !== 'all') {
        const emailDate = new Date(email.sent_at);
        const now = new Date();
        const diffMs = now.getTime() - emailDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (filterDateRange === 'today' && diffHours > 24) return false;
        if (filterDateRange === 'week' && diffHours > 24 * 7) return false;
        if (filterDateRange === 'month' && diffHours > 24 * 30) return false;
      }

      return true;
    });
  }, [emails, searchQuery, filterMethod, filterStatus, filterDateRange]);

  // Pagination
  const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEmails = filteredEmails.slice(startIndex, endIndex);

  const paginationRange = useMemo(() => {
    if (totalPages <= 1) {
      return [1] as Array<number | 'dots'>;
    }

    const range: Array<number | 'dots'> = [];
    const lastPage = totalPages;
    const delta = 1;

    const addPage = (page: number) => {
      if (!range.includes(page)) {
        range.push(page);
      }
    };

    addPage(1);

    const left = Math.max(2, currentPage - delta);
    const right = Math.min(lastPage - 1, currentPage + delta);

    if (left > 2) {
      range.push('dots');
    }

    for (let page = left; page <= right; page++) {
      addPage(page);
    }

    if (right < lastPage - 1) {
      range.push('dots');
    }

    if (lastPage > 1) {
      addPage(lastPage);
    }

    return range;
  }, [currentPage, totalPages]);

  // Reset page quand les filtres changent
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMethod, filterStatus, filterDateRange]);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterMethod('all');
    setFilterStatus('all');
    setFilterDateRange('all');
  };

  const hasActiveFilters = searchQuery || filterMethod !== 'all' || filterStatus !== 'all' || filterDateRange !== 'all';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-coral-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-medium">Aucun email envoyé</p>
        <p className="text-gray-400 text-sm mt-2">
          Vos emails apparaîtront ici après l'envoi
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec compteur et bouton filtres */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h3 className="text-lg sm:text-xl font-bold text-cocoa-900">
          Historique des emails <span className="text-sm sm:text-base">({filteredEmails.length}/{emails.length})</span>
        </h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl text-sm font-semibold transition-all ${
            hasActiveFilters
              ? 'bg-coral-500 text-white hover:bg-coral-600'
              : 'bg-coral-100 text-coral-700 hover:bg-coral-200'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtres</span>
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-white text-coral-600 rounded-full text-xs font-bold">
              {[searchQuery, filterMethod !== 'all', filterStatus !== 'all', filterDateRange !== 'all'].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Panneau de filtres */}
      {showFilters && (
        <div className="bg-gradient-to-br from-coral-50 to-sunset-50 rounded-2xl p-3 sm:p-6 border-2 border-coral-200 space-y-4 animate-slideDown">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cocoa-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par sujet, destinataire..."
              className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 text-sm rounded-xl border-2 border-coral-200 focus:border-coral-500 focus:ring-2 focus:ring-coral-200 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-cocoa-400 hover:text-cocoa-600"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>

          {/* Filtres rapides */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Méthode */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-cocoa-700 mb-2">
                Méthode d'envoi
              </label>
              <div className="relative">
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value as any)}
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm rounded-xl border-2 border-coral-200 focus:border-coral-500 focus:ring-2 focus:ring-coral-200 outline-none transition-all bg-white text-cocoa-800 font-semibold cursor-pointer hover:border-coral-300 hover:shadow-md appearance-none pr-10"
                >
                  <option value="all">Toutes</option>
                  <option value="gmail">Gmail</option>
                  <option value="smtp">SMTP</option>
                </select>
                <svg className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-coral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Statut */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-cocoa-700 mb-2">
                Statut
              </label>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm rounded-xl border-2 border-coral-200 focus:border-coral-500 focus:ring-2 focus:ring-coral-200 outline-none transition-all bg-white text-cocoa-800 font-semibold cursor-pointer hover:border-coral-300 hover:shadow-md appearance-none pr-10"
                >
                  <option value="all">Tous</option>
                  <option value="sent">Envoyés</option>
                  <option value="failed">Échecs</option>
                </select>
                <svg className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-coral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Période */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-cocoa-700 mb-2">
                Période
              </label>
              <div className="relative">
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value as any)}
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm rounded-xl border-2 border-coral-200 focus:border-coral-500 focus:ring-2 focus:ring-coral-200 outline-none transition-all bg-white text-cocoa-800 font-semibold cursor-pointer hover:border-coral-300 hover:shadow-md appearance-none pr-10"
                >
                  <option value="all">Toutes</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois</option>
                </select>
                <svg className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-coral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Bouton réinitialiser */}
          {hasActiveFilters && (
            <div className="flex justify-center sm:justify-end">
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 text-sm bg-white text-coral-600 rounded-xl font-semibold hover:bg-coral-50 transition-all border-2 border-coral-200"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Réinitialiser les filtres</span>
                <span className="sm:hidden">Réinitialiser</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Message si aucun résultat */}
      {filteredEmails.length === 0 && emails.length > 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-gray-200">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">Aucun email trouvé</p>
          <p className="text-gray-400 text-sm mt-2">
            Essayez de modifier vos filtres
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-6 py-2 bg-coral-500 text-white rounded-xl font-semibold hover:bg-coral-600 transition-all"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      <div className="space-y-3">
        {paginatedEmails.map((email) => {
          const recipientStatuses = buildRecipientStatuses(email);
          const totalRecipients = recipientStatuses.length;
          const openedRecipientsCount = recipientStatuses.filter(r => r.openCount > 0).length;
          const totalOpenCount = getTotalOpenCount(email);

          return (
            <div
              key={email.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-3 sm:p-4 cursor-pointer"
                onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Sujet */}
                    <div className="flex items-center gap-2 mb-2">
                      {email.status === 'sent' ? (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
                      )}
                      <h4 className="font-semibold text-sm sm:text-base text-cocoa-900 truncate">
                        {email.subject}
                      </h4>
                    </div>

                    {/* Destinataires */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-cocoa-600 mb-2">
                      <User className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">
                        {email.recipients}
                        {email.cc_recipients && ` +${email.cc_recipients.split(',').length} CC`}
                      </span>
                    </div>

                    {/* Métadonnées */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-cocoa-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span className="hidden sm:inline">{formatDate(email.sent_at)}</span>
                        <span className="sm:hidden">{new Date(email.sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                      </div>
                      {email.attachments_count > 0 && (
                        <div className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          <span className="hidden sm:inline">{email.attachments_count} PJ ({formatSize(email.total_attachments_size)})</span>
                          <span className="sm:hidden">{email.attachments_count}</span>
                        </div>
                      )}
                      {getMethodBadge(email.method)}
                      {/* Badge de suivi - différent selon la méthode d'envoi */}
                      {email.method === 'local' ? (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                          Suivi indisponible
                        </span>
                      ) : totalRecipients > 0 && openedRecipientsCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-green-100 text-green-700">
                          <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          {openedRecipientsCount}/{totalRecipients}
                          {totalOpenCount > 1 && (
                            <span className="ml-1 px-1 sm:px-1.5 bg-green-500 text-white text-[9px] sm:text-xs rounded">
                              {totalOpenCount}×
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                    {/* Bouton suivi - uniquement si méthode != local */}
                    {email.method !== 'local' && totalRecipients > 0 && openedRecipientsCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenRecipientsEmailId(prev => prev === email.id ? null : email.id);
                        }}
                        className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors text-[10px] sm:text-xs font-medium"
                        title="Voir le suivi des destinataires"
                      >
                        <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Lu</span>
                        {totalOpenCount > 1 && (
                          <span className="px-1 sm:px-1.5 py-0.5 bg-green-500 text-white text-[9px] sm:text-xs rounded-full">
                            {totalOpenCount}×
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(email.id);
                      }}
                      className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Détails étendus */}
              {expandedEmail === email.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                  {email.cc_recipients && (
                    <div>
                      <span className="text-xs font-semibold text-cocoa-700">CC:</span>
                      <p className="text-sm text-cocoa-600 mt-1">{email.cc_recipients}</p>
                    </div>
                  )}

                  {email.error_message && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <span className="text-xs font-semibold text-red-700">Erreur:</span>
                      <p className="text-sm text-red-600 mt-1">{email.error_message}</p>
                    </div>
                  )}

                  {email.message_id && (
                    <div>
                      <span className="text-xs font-semibold text-cocoa-700">ID Message:</span>
                      <p className="text-xs text-cocoa-500 mt-1 font-mono">{email.message_id}</p>
                    </div>
                  )}

                  {/* Section suivi des destinataires */}
                  {email.method === 'local' ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Eye className="w-4 h-4" />
                        <span className="text-sm font-medium">Suivi des ouvertures non disponible</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        Les emails envoyés via l'application locale ne supportent pas le suivi des ouvertures.
                        Utilisez Gmail ou SMTP pour bénéficier du suivi.
                      </p>
                    </div>
                  ) : totalRecipients > 0 && (
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenRecipientsEmailId(prev => prev === email.id ? null : email.id);
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm font-semibold transition-colors ${
                          openedRecipientsCount > 0
                            ? 'border-green-200 text-green-700 hover:bg-green-50'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        Suivi des destinataires
                        {totalOpenCount > 0 && (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                            {totalOpenCount} ouverture{totalOpenCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </button>
                      {openRecipientsEmailId === email.id && (
                        <div className="mt-3 bg-white rounded-lg border border-gray-200">
                          {/* Version desktop - Tableau */}
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr className="text-left text-xs uppercase text-cocoa-500 tracking-wide">
                                  <th className="py-3 px-4">Destinataire</th>
                                  <th className="py-3 px-4">Type</th>
                                  <th className="py-3 px-4">Ouvertures</th>
                                  <th className="py-3 px-4">Historique</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recipientStatuses.map((recipient) => (
                                  <tr key={`${email.id}-${recipient.type}-${recipient.email}`} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4 font-medium text-cocoa-800">{recipient.email}</td>
                                    <td className="py-3 px-4 text-cocoa-500">{recipient.type}</td>
                                    <td className="py-3 px-4">
                                      {recipient.openCount > 0 ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-600 font-semibold">
                                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                          {recipient.openCount}×
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-gray-500 font-semibold">
                                          <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                          0
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      {recipient.openCount > 0 ? (
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                          {recipient.opens.map((open, idx) => (
                                            <div key={open.id || idx} className="flex items-center gap-2 text-xs">
                                              <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                                              <span className={idx === 0 ? 'text-emerald-600 font-medium' : 'text-cocoa-500'}>
                                                {formatExactDateTime(open.opened_at)}
                                              </span>
                                              {idx === 0 && (
                                                <span className="text-emerald-500 text-xs">(dernière)</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">Pas encore ouvert</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Version mobile - Cartes */}
                          <div className="sm:hidden space-y-3 p-3">
                            {recipientStatuses.map((recipient) => (
                              <div key={`${email.id}-${recipient.type}-${recipient.email}`} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                {/* Email et type */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-cocoa-800 truncate">{recipient.email}</p>
                                    <p className="text-xs text-cocoa-500 mt-0.5">{recipient.type}</p>
                                  </div>
                                  {/* Badge ouvertures */}
                                  {recipient.openCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-emerald-600 font-semibold text-xs flex-shrink-0">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                      {recipient.openCount}×
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-1 text-gray-500 font-semibold text-xs flex-shrink-0">
                                      <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                      0
                                    </span>
                                  )}
                                </div>
                                {/* Historique */}
                                {recipient.openCount > 0 ? (
                                  <div className="space-y-1 max-h-24 overflow-y-auto mt-2 pt-2 border-t border-gray-200">
                                    {recipient.opens.map((open, idx) => (
                                      <div key={open.id || idx} className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${idx === 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                                        <span className={`text-[10px] ${idx === 0 ? 'text-emerald-600 font-medium' : 'text-cocoa-500'}`}>
                                          {formatExactDateTime(open.opened_at)}
                                        </span>
                                        {idx === 0 && (
                                          <span className="text-emerald-500 text-[10px]">(dernière)</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 italic mt-2 pt-2 border-t border-gray-200">Pas encore ouvert</p>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Résumé */}
                          <div className="px-3 py-2 sm:px-4 sm:py-3 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
                            <span className="text-cocoa-600">
                              <strong>{openedRecipientsCount}</strong> sur <strong>{totalRecipients}</strong> destinataires ont ouvert
                            </span>
                            <span className="text-emerald-600 font-semibold">
                              Total : {totalOpenCount} ouverture{totalOpenCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                 <div className="flex flex-wrap gap-3">
                   {email.meeting_id && onViewMeeting && (
                     <button
                       onClick={() => onViewMeeting(email.meeting_id!)}
                       className="inline-flex items-center gap-2 text-sm text-coral-600 hover:text-coral-700 font-medium hover:underline"
                     >
                       <ExternalLink className="w-4 h-4" />
                       Voir la réunion associée
                     </button>
                   )}

                   {email.html_body && (
                     <button
                       onClick={() => setPreviewEmail(email)}
                       className="inline-flex items-center gap-2 text-sm text-sunset-600 hover:text-sunset-700 font-medium hover:underline"
                     >
                       <Mail className="w-4 h-4" />
                       Prévisualiser l'email
                     </button>
                   )}
                 </div>
               </div>
             )}
           </div>
         );
       })}
     </div>

     {/* Pagination */}
     {totalPages > 1 && (
       <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-6 px-2">
         <div className="text-xs sm:text-sm text-cocoa-600 order-2 sm:order-1">
           Page {currentPage} sur {totalPages} • {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
         </div>
         <nav className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2" aria-label="Pagination des emails">
           <button
             onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
             disabled={currentPage === 1}
             className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-full border border-coral-200 text-coral-700 hover:bg-coral-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
             aria-label="Page précédente"
           >
             <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
           </button>
           <div className="flex items-center gap-0.5 sm:gap-1">
             {paginationRange.map((item, index) => (
               item === 'dots' ? (
                 <span key={`dots-${index}`} className="px-1 sm:px-2 text-xs sm:text-sm font-medium text-cocoa-400">...</span>
               ) : (
                 <button
                   key={`page-${item}`}
                   onClick={() => setCurrentPage(item)}
                   className={`min-w-[2rem] sm:min-w-[2.5rem] h-8 sm:h-10 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                     currentPage === item
                       ? 'bg-coral-500 text-white shadow-md'
                       : 'border border-coral-200 text-coral-700 hover:bg-coral-100'
                   }`}
                   aria-current={currentPage === item ? 'page' : undefined}
                 >
                   {item}
                 </button>
               )
             ))}
           </div>
           <button
             onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
             disabled={currentPage === totalPages}
             className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-full border border-coral-200 text-coral-700 hover:bg-coral-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
             aria-label="Page suivante"
           >
             <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
           </button>
         </nav>
       </div>
     )}

     {/* Modal de prévisualisation */}
     {previewEmail && (
       <div 
         className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
         onClick={() => setPreviewEmail(null)}
       >
         <div 
           className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
           onClick={(e) => e.stopPropagation()}
         >
           {/* Header */}
           <div className="p-6 border-b border-coral-100 bg-gradient-to-r from-coral-50 to-sunset-50">
             <div className="flex items-start justify-between gap-4">
               <div className="flex-1">
                 <h3 className="text-xl font-bold text-cocoa-900 mb-2">
                   {previewEmail.subject}
                 </h3>
                 <div className="space-y-1 text-sm text-cocoa-600">
                   <div className="flex items-center gap-2">
                     <span className="font-semibold">À:</span>
                     <span>{previewEmail.recipients}</span>
                   </div>
                   {previewEmail.cc_recipients && (
                     <div className="flex items-center gap-2">
                       <span className="font-semibold">CC:</span>
                       <span>{previewEmail.cc_recipients}</span>
                     </div>
                   )}
                   <div className="flex items-center gap-3">
                     <span>{formatDate(previewEmail.sent_at)}</span>
                     {getMethodBadge(previewEmail.method)}
                     {previewEmail.first_opened_at && (
                       <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-600 font-semibold">
                         <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                         Ouvert {formatExactDateTime(previewEmail.first_opened_at)}{previewEmail.first_opened_recipient ? ` • ${previewEmail.first_opened_recipient}` : ''}
                       </span>
                     )}
                     {previewEmail.attachments_count > 0 && (
                       <span className="flex items-center gap-1">
                         <Paperclip className="w-3 h-3" />
                         {previewEmail.attachments_count} PJ
                       </span>
                     )}
                   </div>
                 </div>
               </div>
               <button
                 onClick={() => setPreviewEmail(null)}
                 className="text-cocoa-400 hover:text-cocoa-600 transition-colors"
               >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>
           </div>

           {/* Corps de l'email - pixel de tracking retiré pour éviter les faux positifs */}
           <div className="flex-1 overflow-y-auto p-6">
             <div
               className="prose prose-sm max-w-none"
               dangerouslySetInnerHTML={{ __html: sanitizeHtmlForPreview(previewEmail.html_body) }}
             />
           </div>

           {/* Footer */}
           <div className="p-4 border-t border-coral-100 bg-gray-50 flex justify-end">
             <button
               onClick={() => setPreviewEmail(null)}
               className="px-6 py-2 bg-coral-500 text-white rounded-xl font-semibold hover:bg-coral-600 transition-colors"
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

