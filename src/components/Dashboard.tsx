import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, Clock, FileText, Calendar, BarChart3, Crown, Zap, AlertCircle, RefreshCw, Mail, Eye, Users, PieChart, ArrowUp, ArrowDown, CalendarDays, X } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalMeetings: number;
  totalMinutes: number;
  periodMeetings: number;
  periodMinutes: number;
  averageDuration: number;
  recentActivity: {
    date: string;
    meetings: number;
    minutes: number;
  }[];
  // Stats emails (7 derniers jours)
  emailsSent: number;
  emailsOpened: number;
  // Stats avancées pour l'onglet Statistiques
  emailOpenRate: number; // Taux d'ouverture en %
  totalEmailsAllTime: number;
  totalOpensAllTime: number;
  topContacts: {
    email: string;
    emailsSent: number;
    opens: number;
    openRate: number;
  }[];
  weekComparison: {
    meetingsChange: number; // % de changement vs semaine précédente
    emailsChange: number;
  };
  hourlyActivity: {
    hour: number;
    meetings: number;
  }[];
}

interface DateRange {
  start?: string;
  end?: string;
}

interface Subscription {
  plan_type: 'starter' | 'unlimited';
  minutes_quota: number | null;
  minutes_used_this_month: number;
  billing_cycle_end: string;
  is_active: boolean;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMeetings: 0,
    totalMinutes: 0,
    periodMeetings: 0,
    periodMinutes: 0,
    averageDuration: 0,
    recentActivity: [],
    emailsSent: 0,
    emailsOpened: 0,
    emailOpenRate: 0,
    totalEmailsAllTime: 0,
    totalOpensAllTime: 0,
    topContacts: [],
    weekComparison: { meetingsChange: 0, emailsChange: 0 },
    hourlyActivity: []
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'statistics'>('overview');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [appliedRange, setAppliedRange] = useState<DateRange>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const calendarRef = useRef<HTMLDivElement>(null);

  const loadStats = useCallback(async (range?: DateRange) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger l'abonnement
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // On va calculer les vraies minutes utilisées ce mois depuis les meetings
      // et mettre à jour l'abonnement après

      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('duration, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!meetings || meetings.length === 0) {
        setIsLoading(false);
        return;
      }

      const now = new Date();
      
      // Utiliser le billing_cycle_start au lieu de startOfMonth pour respecter le cycle de facturation
      const cycleStart = subData?.billing_cycle_start 
        ? new Date(subData.billing_cycle_start)
        : new Date(now.getFullYear(), now.getMonth(), 1);

      const totalMeetings = meetings.length;
      const totalSeconds = meetings.reduce((sum, m) => sum + (m.duration || 0), 0);
      const totalMinutesAll = Math.round(totalSeconds / 60);

      // Filtrer les meetings du cycle en cours (pas du mois calendaire)
      const thisMonthMeetings = meetings.filter(m =>
        new Date(m.created_at) >= cycleStart
      );
      const thisMonthSeconds = thisMonthMeetings.reduce((sum, m) => sum + (m.duration || 0), 0);

      const startFilter = range?.start ? new Date(range.start) : null;
      const endFilter = range?.end ? new Date(range.end) : null;
      if (startFilter) startFilter.setHours(0, 0, 0, 0);
      if (endFilter) endFilter.setHours(23, 59, 59, 999);

      const rangeActive = !!(startFilter || endFilter);
      const filteredMeetings = rangeActive
        ? meetings.filter((m) => {
            const meetingDate = new Date(m.created_at);
            return (!startFilter || meetingDate >= startFilter) && (!endFilter || meetingDate <= endFilter);
          })
        : thisMonthMeetings;

      const periodSeconds = filteredMeetings.reduce((sum, m) => sum + (m.duration || 0), 0);

      const averageDuration = filteredMeetings.length > 0
        ? Math.round(periodSeconds / filteredMeetings.length / 60)
        : 0;

      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const activitySource = rangeActive
        ? filteredMeetings
        : meetings.filter(m => new Date(m.created_at) >= last7Days);

      const activityByDate = activitySource.reduce((acc, meeting) => {
        const date = new Date(meeting.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { meetings: 0, seconds: 0 };
        }
        acc[date].meetings += 1;
        acc[date].seconds += meeting.duration || 0;
        return acc;
      }, {} as Record<string, { meetings: number; seconds: number }>);

      const recentActivity = Object.entries(activityByDate)
        .map(([date, data]) => ({
          date,
          meetings: data.meetings,
          minutes: Math.round(data.seconds / 60)
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);

      // Charger les stats d'emails selon la période sélectionnée (ou 7 derniers jours par défaut)
      let emailQuery = supabase
        .from('email_history')
        .select('id, status, first_opened_at, recipients, sent_at')
        .eq('user_id', user.id);

      // Appliquer le filtre de période aux emails
      if (startFilter) {
        emailQuery = emailQuery.gte('sent_at', startFilter.toISOString());
      }
      if (endFilter) {
        emailQuery = emailQuery.lte('sent_at', endFilter.toISOString());
      }

      const { data: emailStats } = await emailQuery;

      const emailsSent = emailStats?.filter(e => e.status === 'sent').length || 0;
      const emailsOpened = emailStats?.filter(e => e.first_opened_at !== null && e.status === 'sent').length || 0;

      // Stats avancées pour l'onglet Statistiques (filtrées par période)
      const periodEmails = emailStats?.filter(e => e.status === 'sent') || [];
      const totalEmailsAllTime = periodEmails.length;
      const totalOpensAllTime = periodEmails.filter(e => e.first_opened_at !== null).length;
      const emailOpenRate = totalEmailsAllTime > 0 ? Math.round((totalOpensAllTime / totalEmailsAllTime) * 100) : 0;

      // Top contacts (les plus fréquents) - basés sur la période filtrée
      const contactMap = new Map<string, { sent: number; opened: number }>();
      periodEmails.forEach(email => {
        const recipients = email.recipients?.split(',').map((r: string) => r.trim().toLowerCase()) || [];
        recipients.forEach((recipient: string) => {
          if (!recipient) return;
          const current = contactMap.get(recipient) || { sent: 0, opened: 0 };
          current.sent += 1;
          if (email.first_opened_at) current.opened += 1;
          contactMap.set(recipient, current);
        });
      });

      const topContacts = Array.from(contactMap.entries())
        .map(([email, data]) => ({
          email,
          emailsSent: data.sent,
          opens: data.opened,
          openRate: data.sent > 0 ? Math.round((data.opened / data.sent) * 100) : 0
        }))
        .sort((a, b) => b.emailsSent - a.emailsSent)
        .slice(0, 5);

      // Comparaison avec la période précédente (même durée)
      // Calculer la durée de la période sélectionnée
      const periodDuration = (startFilter && endFilter)
        ? endFilter.getTime() - startFilter.getTime()
        : 7 * 24 * 60 * 60 * 1000; // 7 jours par défaut

      const previousPeriodEnd = startFilter || last7Days;
      const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDuration);

      const thisWeekMeetings = filteredMeetings.length;
      const lastWeekMeetings = meetings.filter(m => {
        const d = new Date(m.created_at);
        return d >= previousPeriodStart && d < previousPeriodEnd;
      }).length;
      const meetingsChange = lastWeekMeetings > 0
        ? Math.round(((thisWeekMeetings - lastWeekMeetings) / lastWeekMeetings) * 100)
        : thisWeekMeetings > 0 ? 100 : 0;

      // Emails de la période précédente
      const { data: lastPeriodEmails } = await supabase
        .from('email_history')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .gte('sent_at', previousPeriodStart.toISOString())
        .lt('sent_at', previousPeriodEnd.toISOString());

      const lastPeriodEmailCount = lastPeriodEmails?.length || 0;
      const emailsChange = lastPeriodEmailCount > 0
        ? Math.round(((emailsSent - lastPeriodEmailCount) / lastPeriodEmailCount) * 100)
        : emailsSent > 0 ? 100 : 0;

      // Activité par heure (basée sur la période filtrée)
      const hourlyMap = new Map<number, number>();
      filteredMeetings.forEach(m => {
        const hour = new Date(m.created_at).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      });
      const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        meetings: hourlyMap.get(hour) || 0
      }));

      setStats({
        totalMeetings,
        totalMinutes: totalMinutesAll,
        periodMeetings: filteredMeetings.length,
        periodMinutes: Math.round(periodSeconds / 60),
        averageDuration,
        recentActivity,
        emailsSent,
        emailsOpened,
        emailOpenRate,
        totalEmailsAllTime,
        totalOpensAllTime,
        topContacts,
        weekComparison: { meetingsChange, emailsChange },
        hourlyActivity
      });

      // ✅ Utiliser minutes_used_this_month DIRECTEMENT depuis la DB
      // NE PAS recalculer ! Le trigger SQL gère automatiquement ce champ
      if (subData) {
        setSubscription(subData); // Garder minutes_used_this_month tel quel depuis la DB
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialiser avec le filtre "month" au premier chargement
  useEffect(() => {
    // Si appliedRange est vide au démarrage, appliquer le filtre "month"
    if (!appliedRange.start && !appliedRange.end) {
      const now = new Date();
      const formatLocalDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      // Début du mois en cours
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setAppliedRange({ start: formatLocalDate(startOfMonth), end: formatLocalDate(now) });
    } else {
      loadStats(appliedRange);
    }
  }, [appliedRange, loadStats]);

  // Fermer le calendrier quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePeriodFilter = (period: 'today' | 'week' | 'month' | 'year') => {
    setPeriodFilter(period);
    setShowCalendar(false);
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Formater les dates en local (pas UTC) pour éviter les décalages de fuseau horaire
    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const range = {
      start: formatLocalDate(start),
      end: formatLocalDate(now)
    };

    setAppliedRange(range);
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setPeriodFilter('custom');
      setAppliedRange({ start: customStartDate, end: customEndDate });
      setShowCalendar(false);
    }
  };

  const formatDateRange = () => {
    if (!appliedRange.start || !appliedRange.end) return '';
    const start = new Date(appliedRange.start);
    const end = new Date(appliedRange.end);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('fr-FR', options)} - ${end.toLocaleDateString('fr-FR', options)}`;
  };

  const handleRefresh = () => {
    if (periodFilter && periodFilter !== 'custom') {
      handlePeriodFilter(periodFilter);
    } else if (periodFilter === 'custom' && appliedRange.start && appliedRange.end) {
      loadStats(appliedRange);
    } else {
      handlePeriodFilter('month');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-peach-50 via-white to-coral-50 flex items-center justify-center">
        <div className="text-cocoa-600">Chargement des statistiques...</div>
      </div>
    );
  }

  const minutesRemaining = subscription?.plan_type === 'starter' && subscription?.minutes_quota
    ? subscription.minutes_quota - subscription.minutes_used_this_month
    : null;

  const usagePercentage = subscription?.plan_type === 'starter' && subscription?.minutes_quota
     ? (subscription.minutes_used_this_month / subscription.minutes_quota) * 100
     : 0;
 
   // Quota atteint si >= 99% OU si minutes_used >= quota (pour gérer les arrondis)
   const isQuotaReached = subscription?.plan_type === 'starter' && subscription?.minutes_quota && 
     (subscription.minutes_used_this_month >= subscription.minutes_quota || usagePercentage >= 99);
   const isNearLimit = subscription?.plan_type === 'starter' && usagePercentage >= 80 && !isQuotaReached;
   const rangeActive = !!appliedRange.start || !!appliedRange.end;
   const periodLabel = rangeActive ? 'Période sélectionnée' : 'Ce cycle';

  const usageChartData = stats.recentActivity
    .map((item) => ({
      date: new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      meetings: item.meetings,
      minutes: item.minutes,
    }))
    .reverse();
 
  return (
    <div className="h-full bg-white p-4 md:p-6 lg:p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header - Design minimaliste */}
        <div className="flex flex-col gap-4">
          {/* Ligne 1: Titre et bouton statistiques */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Tableau de bord</h1>

            {/* Lien Statistiques - Desktop uniquement */}
            <button
              onClick={() => setActiveTab(activeTab === 'overview' ? 'statistics' : 'overview')}
              className="hidden md:flex text-sm text-blue-600 hover:text-blue-700 font-medium items-center gap-1"
            >
              <PieChart className="w-4 h-4" />
              {activeTab === 'overview' ? 'Statistiques' : 'Aperçu'}
            </button>
          </div>

          {/* Ligne 2: Filtres de période - Scrollable sur mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            <div className="flex items-center w-fit gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
              <button
                onClick={() => handlePeriodFilter('today')}
                className={`px-2 md:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  periodFilter === 'today'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => handlePeriodFilter('week')}
                className={`px-2 md:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  periodFilter === 'week'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Semaine
              </button>
              <button
                onClick={() => handlePeriodFilter('month')}
                className={`px-2 md:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  periodFilter === 'month'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Mois
              </button>
              <button
                onClick={() => handlePeriodFilter('year')}
                className={`px-2 md:px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  periodFilter === 'year'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Année
              </button>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className={`px-2 md:px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                  periodFilter === 'custom'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{periodFilter === 'custom' ? formatDateRange() : 'Personnalisé'}</span>
              </button>
            </div>

            {/* Bouton Actualiser */}
            <button
              onClick={handleRefresh}
              className=" w-fit flex items-center gap-1.5 px-3 py-1.5 md:py-2 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
          </div>

          {/* Bouton Statistiques - Mobile uniquement */}
          <button
            onClick={() => setActiveTab(activeTab === 'overview' ? 'statistics' : 'overview')}
            className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium rounded-lg transition-colors text-sm"
          >
            <PieChart className="w-4 h-4" />
            {activeTab === 'overview' ? 'Voir les Statistiques' : 'Voir l\'Aperçu'}
          </button>
        </div>

        {/* Dropdown calendrier - position fixe */}
        <div className="relative" ref={calendarRef}>
          {showCalendar && (
            <div className="absolute right-0 top-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 min-w-[280px]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Période personnalisée</h4>
                <button
                  onClick={() => setShowCalendar(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleCustomDateApply}
                  disabled={!customStartDate || !customEndDate}
                  className="w-full py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Appliquer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'overview' ? (
          <>
        {/* Carte d'abonnement */}
        {subscription && (
          <div className={`mb-8 rounded-2xl shadow-xl border-2 p-6 animate-fadeInUp delay-150 ${
            subscription.plan_type === 'unlimited'
              ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-300'
              : 'bg-gradient-to-br from-coral-50 via-peach-50 to-sunset-50 border-coral-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {subscription.plan_type === 'unlimited' ? (
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl shadow-lg">
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                ) : (
                  <div className="p-3 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl shadow-lg">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-cocoa-900">
                    {subscription.plan_type === 'unlimited' ? 'Formule Illimitée' : 'Formule Starter'}
                  </h2>
                  <p className="text-cocoa-600">
                    {subscription.plan_type === 'unlimited' ? '49€/mois' : '39€/mois - 600 minutes'}
                  </p>
                </div>
              </div>
              {isQuotaReached && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">Quota atteint</span>
                </div>
              )}
              {isNearLimit && (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 border border-orange-300 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-semibold text-orange-700">Quota bientôt atteint</span>
                </div>
              )}
            </div>

            {subscription.plan_type === 'starter' && subscription.minutes_quota && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-cocoa-700">Minutes utilisées ce mois</span>
                  <span className="text-lg font-bold text-coral-600">
                    {subscription.minutes_used_this_month} / {subscription.minutes_quota} min
                  </span>
                </div>
                <div className="w-full bg-coral-100 rounded-full h-4 shadow-inner">
                  <div
                    className={`h-4 rounded-full transition-all duration-500 shadow-sm ${
                      isQuotaReached
                        ? 'bg-gradient-to-r from-red-600 to-red-500'
                        : isNearLimit
                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                        : 'bg-gradient-to-r from-coral-500 to-sunset-500'
                    }`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-cocoa-600">
                    {minutesRemaining !== null && minutesRemaining > 0
                      ? `${minutesRemaining} minutes restantes`
                      : 'Quota atteint'}
                  </span>
                  <span className="text-cocoa-500">
                    Renouvellement le {new Date(subscription.billing_cycle_end).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            )}

            {subscription.plan_type === 'unlimited' && (
              <div className="bg-white/50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="font-semibold text-cocoa-900">Réunions illimitées</p>
                    <p className="text-sm text-cocoa-600">
                      {subscription.minutes_used_this_month} minutes utilisées ce mois
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cartes statistiques - Design épuré */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Réunions */}
          <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Réunions</span>
              <FileText className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.periodMeetings}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.totalMeetings} au total</p>
          </div>

          {/* Temps enregistré */}
          <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Temps enregistré</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.periodMinutes} min</p>
            <p className="text-xs text-gray-500 mt-1">{stats.totalMinutes} min au total</p>
          </div>

          {/* Emails envoyés */}
          <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Emails envoyés</span>
              <Mail className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.emailsSent}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.emailsOpened} ouvert{stats.emailsOpened > 1 ? 's' : ''}</p>
          </div>

          {/* Durée moyenne */}
          <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Durée moyenne</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.averageDuration} min</p>
            <p className="text-xs text-gray-500 mt-1">par réunion</p>
          </div>
        </div>

        {/* Section inférieure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {/* Activité récente */}
          <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-700">Activité récente</h2>
              <span className="text-xs text-gray-400">
                {periodFilter === 'today' ? "Aujourd'hui" :
                 periodFilter === 'week' ? '7 derniers jours' :
                 periodFilter === 'month' ? 'Ce mois-ci' :
                 periodFilter === 'year' ? 'Cette année' :
                 formatDateRange()}
              </span>
            </div>

            {stats.recentActivity.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune activité</p>
              </div>
            ) : (
              <div className="space-y-1">
                {stats.recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-2.5 px-3 hover:bg-white rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{formatDate(activity.date)}</p>
                        <p className="text-xs text-gray-400">{activity.meetings} réunion{activity.meetings > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-600">{activity.minutes} min</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Graphique d'évolution */}
          <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-700">Évolution</h2>
              <span className="text-xs text-gray-400">Minutes par jour</span>
            </div>

            <div>
              {usageChartData.length === 0 ? (
                <div className="text-center py-6">
                  <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Aucune donnée</p>
                </div>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={usageChartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="minutes" orientation="right" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} width={35} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '12px' }}
                        labelStyle={{ color: '#374151', fontWeight: 500 }}
                        formatter={(value, name) => [name === 'minutes' ? `${value} min` : `${value} réunion${Number(value) > 1 ? 's' : ''}`, name === 'minutes' ? 'Minutes' : 'Réunions']}
                      />
                      <Area
                        type="monotone"
                        dataKey="minutes"
                        stroke="#6b7280"
                        strokeWidth={1.5}
                        fill="url(#minutesGradient)"
                        yAxisId="minutes"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

          </>
        ) : (
          /* Onglet Statistiques */
          <div className="space-y-6 animate-fadeIn">
            {/* Cartes de performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Taux d'ouverture */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <Eye className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className={`flex items-center gap-1 text-sm font-medium ${
                    stats.weekComparison.emailsChange >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {stats.weekComparison.emailsChange >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    {Math.abs(stats.weekComparison.emailsChange)}%
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.emailOpenRate}%</p>
                <p className="text-sm text-gray-500 mt-1">Taux d'ouverture</p>
              </div>

              {/* Emails envoyés */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Mail className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalEmailsAllTime}</p>
                <p className="text-sm text-gray-500 mt-1">Emails envoyés ({periodLabel.toLowerCase()})</p>
              </div>

              {/* Emails ouverts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Eye className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOpensAllTime}</p>
                <p className="text-sm text-gray-500 mt-1">Emails ouverts ({periodLabel.toLowerCase()})</p>
              </div>

              {/* Comparaison réunions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                  <span className={`flex items-center gap-1 text-sm font-medium ${
                    stats.weekComparison.meetingsChange >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {stats.weekComparison.meetingsChange >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    {Math.abs(stats.weekComparison.meetingsChange)}%
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.periodMeetings}</p>
                <p className="text-sm text-gray-500 mt-1">Réunions cette période</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Contacts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-coral-100 rounded-lg">
                    <Users className="w-5 h-5 text-coral-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Top Contacts</h3>
                </div>
                {stats.topContacts.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Aucun contact pour le moment</p>
                ) : (
                  <div className="space-y-4">
                    {stats.topContacts.map((contact, index) => (
                      <div key={contact.email} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                            index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{contact.email}</p>
                            <p className="text-xs text-gray-500">{contact.emailsSent} emails envoyés</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-sm ${contact.openRate >= 50 ? 'text-emerald-600' : 'text-gray-600'}`}>
                            {contact.openRate}%
                          </p>
                          <p className="text-xs text-gray-400">ouverture</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activité par heure */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-200">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Heures productives</h3>
                      <p className="text-xs text-gray-400">Activité par créneau horaire</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"></span>
                    Réunions
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.hourlyActivity.filter(h => h.hour >= 6 && h.hour <= 22)}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorHourlyPro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                          <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="0"
                        stroke="#f1f5f9"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="hour"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickFormatter={(h) => h % 3 === 0 ? `${h}h` : ''}
                        interval={0}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickCount={4}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                          padding: '12px 16px',
                        }}
                        formatter={(value: number) => [
                          <span key="val" className="font-semibold text-gray-900">{value} réunion{value > 1 ? 's' : ''}</span>,
                          ''
                        ]}
                        labelFormatter={(hour) => (
                          <span className="text-sm font-medium text-gray-600">{hour}h - {Number(hour) + 1}h</span>
                        )}
                        cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                      />
                      <Area
                        type="monotoneX"
                        dataKey="meetings"
                        stroke="url(#strokeGradient)"
                        fill="url(#colorHourlyPro)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{
                          r: 6,
                          fill: '#6366f1',
                          stroke: 'white',
                          strokeWidth: 3,
                          filter: 'drop-shadow(0 2px 4px rgba(99,102,241,0.4))'
                        }}
                      />
                      <defs>
                        <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1"/>
                          <stop offset="50%" stopColor="#8b5cf6"/>
                          <stop offset="100%" stopColor="#a855f7"/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Résumé de la période */}
            <div className="bg-gradient-to-r from-coral-500 to-sunset-500 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Performance - {periodFilter === 'today' ? "Aujourd'hui" : periodFilter === 'week' ? 'Cette semaine' : 'Cette année'}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/20 rounded-xl p-4">
                  <p className="text-2xl font-bold">{stats.emailsSent}</p>
                  <p className="text-sm text-white/80">Emails envoyés</p>
                </div>
                <div className="bg-white/20 rounded-xl p-4">
                  <p className="text-2xl font-bold">{stats.emailsOpened}</p>
                  <p className="text-sm text-white/80">Emails ouverts</p>
                </div>
                <div className="bg-white/20 rounded-xl p-4">
                  <p className="text-2xl font-bold">{stats.periodMeetings}</p>
                  <p className="text-sm text-white/80">Réunions</p>
                </div>
                <div className="bg-white/20 rounded-xl p-4">
                  <p className="text-2xl font-bold">{stats.periodMinutes}min</p>
                  <p className="text-sm text-white/80">Temps total</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
