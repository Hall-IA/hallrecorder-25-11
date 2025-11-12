import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Clock, FileText, Calendar, BarChart3, Crown, Zap, AlertCircle, Filter } from 'lucide-react';
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
    recentActivity: []
  });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [appliedRange, setAppliedRange] = useState<DateRange>({});

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

      setStats({
        totalMeetings,
        totalMinutes: totalMinutesAll,
        periodMeetings: filteredMeetings.length,
        periodMinutes: Math.round(periodSeconds / 60),
        averageDuration,
        recentActivity
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

  useEffect(() => {
    loadStats(appliedRange);
  }, [appliedRange, loadStats]);

  const handleApplyRange = () => {
    if (draftStartDate && draftEndDate && draftStartDate > draftEndDate) {
      alert('La date de début doit être antérieure à la date de fin.');
      return;
    }
    setAppliedRange({
      start: draftStartDate || undefined,
      end: draftEndDate || undefined,
    });
  };

  const handleResetRange = () => {
    setDraftStartDate('');
    setDraftEndDate('');
    setAppliedRange({});
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
    <div className="min-h-screen bg-gradient-to-br from-peach-50 via-white to-coral-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-cocoa-900 mb-2">Tableau de bord</h1>
            <p className="text-cocoa-600">Vue d'ensemble de votre utilisation</p>
          </div>
          <div className="bg-white border-2 border-coral-200 rounded-2xl shadow-sm px-5 py-4 flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex items-center gap-2 text-cocoa-600 font-semibold text-sm sm:min-w-[150px] self-center lg:self-end lg:pb-1">
              <Filter className="w-4 h-4 text-coral-500" />
              Filtrer par dates
            </div>
            <div className="flex flex-1 flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-cocoa-500">Du</label>
                <input
                  type="date"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                  className="border border-coral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-cocoa-500">Au</label>
                <input
                  type="date"
                  value={draftEndDate}
                  onChange={(e) => setDraftEndDate(e.target.value)}
                  className="border border-coral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400"
                />
              </div>
            </div>
            <div className="flex gap-2 sm:ml-auto self-center lg:self-end">
              <button
                onClick={handleApplyRange}
                className="group relative px-4 py-2 bg-gradient-to-r from-coral-500 to-sunset-500 text-white text-sm font-semibold rounded-xl shadow hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <span className="relative">Appliquer</span>
              </button>
              <button
                onClick={handleResetRange}
                className="px-4 py-2 border-2 border-coral-200 text-cocoa-600 text-sm font-semibold rounded-xl hover:bg-coral-50 hover:border-coral-300 transition-all duration-300 hover:scale-105"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Carte d'abonnement */}
        {subscription && (
          <div className={`mb-8 rounded-2xl shadow-xl border-2 p-6 ${
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
                    {subscription.plan_type === 'unlimited' ? '39€/mois' : '29€/mois - 600 minutes'}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group relative bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-coral-50 to-sunset-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-coral-100 to-coral-50 rounded-xl group-hover:shadow-lg transition-all duration-300">
                <FileText className="w-6 h-6 text-coral-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="relative space-y-1">
              <p className="text-sm font-medium text-cocoa-600">Total de réunions</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-coral-600 to-sunset-600 bg-clip-text text-transparent">{stats.totalMeetings}</p>
              <p className="text-xs text-cocoa-500">Depuis le début</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-lg border-2 border-sunset-200 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sunset-50 to-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-sunset-100 to-sunset-50 rounded-xl group-hover:shadow-lg transition-all duration-300">
                <Clock className="w-6 h-6 text-sunset-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="relative space-y-1">
              <p className="text-sm font-medium text-cocoa-600">Minutes utilisées</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-sunset-600 to-coral-600 bg-clip-text text-transparent">{stats.totalMinutes}</p>
              <p className="text-xs text-cocoa-500">Depuis le début</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-lg border-2 border-peach-300 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-peach-50 to-coral-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-peach-100 to-peach-50 rounded-xl group-hover:shadow-lg transition-all duration-300">
                <Calendar className="w-6 h-6 text-coral-600" />
              </div>
              <span className="text-xs font-medium text-coral-600 bg-coral-50 px-2 py-1 rounded-lg">{periodLabel}</span>
            </div>
            <div className="relative space-y-1">
              <p className="text-sm font-medium text-cocoa-600">Réunions</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-coral-600 to-peach-600 bg-clip-text text-transparent">{stats.periodMeetings}</p>
              <p className="text-xs text-cocoa-500">{stats.periodMinutes} minute{stats.periodMinutes > 1 ? 's' : ''} sur la période</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-coral-50 to-sunset-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-coral-100 to-sunset-50 rounded-xl group-hover:shadow-lg transition-all duration-300">
                <BarChart3 className="w-6 h-6 text-sunset-600" />
              </div>
            </div>
            <div className="relative space-y-1">
              <p className="text-sm font-medium text-cocoa-600">Durée moyenne</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-sunset-600 to-coral-600 bg-clip-text text-transparent">{stats.averageDuration}</p>
              <p className="text-xs text-cocoa-500">minutes par réunion</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6">
            <h2 className="text-lg font-semibold text-cocoa-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-coral-600" />
              Activité récente (7 derniers jours)
            </h2>
            {stats.recentActivity.length === 0 ? (
              <p className="text-cocoa-500 text-center py-8">Aucune activité récente</p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-peach-50 to-coral-50 hover:from-coral-100 hover:to-sunset-100 transition-all border border-coral-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-coral-500 to-sunset-500 flex items-center justify-center shadow-md">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-cocoa-900">{formatDate(activity.date)}</p>
                        <p className="text-sm text-cocoa-600">{activity.meetings} réunion{activity.meetings > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-coral-600">{activity.minutes}</p>
                      <p className="text-xs text-cocoa-500">minutes</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg border-2 border-coral-200 p-6">
            <h2 className="text-lg font-semibold text-cocoa-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-coral-600" />
              Statistiques d'utilisation
            </h2>
            <div className="space-y-4">
              <div className="border-b border-coral-200 pb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-cocoa-600">Minutes ce mois</span>
                  <span className="text-sm font-bold text-coral-600">{subscription?.minutes_used_this_month || 0} / {subscription?.minutes_quota || 600} min</span>
                </div>
                <div className="w-full bg-coral-100 rounded-full h-3 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-coral-500 to-sunset-500 h-3 rounded-full transition-all durée-500 shadow-sm"
                    style={{ width: `${Math.min(((subscription?.minutes_used_this_month || 0) / (subscription?.minutes_quota || 600)) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-cocoa-500 mt-1">Facturation basée sur l'utilisation</p>
              </div>

              <div>
                <p className="text-sm font-medium text-cocoa-600 mb-3">Activité (7 derniers jours)</p>
                {usageChartData.length === 0 ? (
                  <p className="text-xs text-cocoa-400">Aucune donnée récente</p>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={usageChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F97316" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                        <XAxis dataKey="date" stroke="#92400e" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="minutes" orientation="right" stroke="#92400e" fontSize={12} tickLine={false} axisLine={false} width={45} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', borderColor: '#fed7aa', boxShadow: '0 6px 16px rgba(249,115,22,0.12)' }}
                          labelStyle={{ color: '#92400e', fontWeight: 600 }}
                          formatter={(value, name) => [name === 'minutes' ? `${value} min` : `${value} réunion${Number(value) > 1 ? 's' : ''}`, name === 'minutes' ? 'Minutes' : 'Réunions']}  />
                        <Area
                          type="monotone"
                          dataKey="minutes"
                          stroke="#F97316"
                          strokeWidth={2.5}
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
        </div>

        <div className="mt-6 bg-gradient-to-r from-coral-50 via-peach-50 to-sunset-50 border-2 border-coral-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl shadow-md">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-cocoa-900 mb-1">Facturation à la minute</h3>
              <p className="text-sm text-cocoa-700 mb-2">
                Vous êtes facturé uniquement pour les minutes réellement utilisées.
                Ce mois-ci, vous avez utilisé <span className="font-bold text-coral-600">{subscription?.minutes_used_this_month || 0} minutes</span>
                {stats.periodMeetings > 0 && ` sur ${stats.periodMeetings} réunion${stats.periodMeetings > 1 ? 's' : ''}`}.
              </p>
              <p className="text-xs text-cocoa-600">
                Profitez d'une tarification transparente et flexible adaptée à vos besoins.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
