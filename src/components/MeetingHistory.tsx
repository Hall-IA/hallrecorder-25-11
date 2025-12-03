import { Calendar, Clock, FileText, Trash2, Loader2, Search, X, Mail, Edit2, Check, ChevronLeft, ChevronRight, Send, PlusCircle, Tag, FolderPlus, List, LayoutGrid, Sparkles } from 'lucide-react';
import { Meeting, MeetingCategory } from '../lib/supabase';
import { useState, useMemo, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { ConfirmModal } from './ConfirmModal';
import { generateSummary } from '../services/transcription';
import { SummaryRegenerationModal } from './SummaryRegenerationModal';
import { SummaryMode } from '../services/transcription';
import { useDialog } from '../context/DialogContext';
import { HexColorPicker } from 'react-colorful';

interface MeetingHistoryProps {
  meetings: Meeting[];
  onDelete: (id: string) => void;
  onView: (meeting: Meeting) => void | Promise<void>;
  onSendEmail: (meeting: Meeting) => void;
  onUpdateMeetings: () => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
  userId?: string;
}

const ITEMS_PER_PAGE_LIST = 10;
const ITEMS_PER_PAGE_GRID = 12;

export const MeetingHistory = ({
  meetings = [],
  onDelete,
  onView,
  onSendEmail,
  onUpdateMeetings,
  isLoading = false,
  isRefreshing = false,
  userId
}: MeetingHistoryProps) => {
  // Debug: Log meetings received
  console.log('📋 MeetingHistory: Received meetings:', meetings.length, 'first:', meetings[0]?.title, 'created_at:', meetings[0]?.created_at);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('meetingViewMode');
    return (saved as 'list' | 'grid') || 'list';
  });
  const [searchTitle, setSearchTitle] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('meetingHistoryPage');
    const page = saved ? parseInt(saved, 10) : 1;
    console.log('📄 MeetingHistory: Page initiale chargée depuis localStorage:', page);
    return page;
  });
  const [sentMeetingIds, setSentMeetingIds] = useState<Set<string>>(new Set());
  const previousFiltersRef = useRef({ searchTitle: '', searchDate: '', categoryId: 'all' });
  const previousMeetingsLengthRef = useRef(meetings.length);
  const [categories, setCategories] = useState<MeetingCategory[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [categorySelectorMeetingId, setCategorySelectorMeetingId] = useState<string | null>(null);
  const [draggedMeetingId, setDraggedMeetingId] = useState<string | null>(null);
  const [dropHighlightCategoryId, setDropHighlightCategoryId] = useState<string | 'all' | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const [newCategoryColor, setNewCategoryColor] = useState<string>('#6366F1');
  const [regenerationTarget, setRegenerationTarget] = useState<Meeting | null>(null);
  const [regenerationTargetMode, setRegenerationTargetMode] = useState<SummaryMode>('detailed');
  const [showRegenerationModal, setShowRegenerationModal] = useState(false);
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [regenerationToast, setRegenerationToast] = useState<{ message: string; mode: SummaryMode } | null>(null);

  // Palette de couleurs professionnelle et douce (style Notion/Linear)
  const colorPalette = [
    '#64748B', // Slate - Gris neutre
    '#6366F1', // Indigo - Bleu violet professionnel
    '#8B5CF6', // Violet - Doux
    '#EC4899', // Rose - Subtil
    '#EF4444', // Rouge - Attention
    '#F97316', // Orange - Energie
    '#EAB308', // Jaune - Moutarde
    '#22C55E', // Vert - Succès
    '#14B8A6', // Teal - Turquoise
    '#0EA5E9', // Bleu ciel
    '#6B7280', // Gris - Neutre foncé
    '#A855F7', // Purple - Créatif
  ];
  const { showAlert, showConfirm } = useDialog();

  // Générer une couleur de vignette basée sur la catégorie ou l'ID de la réunion
  const getThumbnailGradient = (meeting: Meeting) => {
    if (meeting.category?.color) {
      const color = meeting.category.color;
      return `linear-gradient(135deg, ${color}15 0%, ${color}30 50%, ${color}15 100%)`;
    }

    // Générer une couleur basée sur l'ID de la réunion
    const hash = meeting.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorIndex = hash % colorPalette.length;
    const color = colorPalette[colorIndex];
    return `linear-gradient(135deg, ${color}15 0%, ${color}30 50%, ${color}15 100%)`;
  };

  const getThumbnailIcon = (meeting: Meeting) => {
    // Couleur de l'icône basée sur la catégorie ou l'index
    if (meeting.category?.color) {
      return meeting.category.color;
    }
    const hash = meeting.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorIndex = hash % colorPalette.length;
    return colorPalette[colorIndex];
  };

  const normalizeHex = (hex: string) => {
    let clean = (hex || '').replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map((c) => `${c}${c}`).join('');
    }
    if (clean.length !== 6) {
      clean = clean.padEnd(6, '0').slice(0, 6);
    }
    return clean;
  };

  const withAlpha = (hex: string, alpha: number) => {
    const clean = normalizeHex(hex);
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getReadableTextColor = (hex: string) => {
    const clean = normalizeHex(hex);
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? '#1F2937' : '#FFFFFF';
  };

  const getCategoryBadgeStyle = (hex: string | null | undefined): CSSProperties => {
    if (!hex) {
      return {
        background: 'linear-gradient(135deg, rgba(248,113,113,0.18) 0%, rgba(248,113,113,0.08) 100%)',
        color: '#B91C1C',
        borderColor: 'rgba(248,113,113,0.35)',
      };
    }

    const textColor = getReadableTextColor(hex);

    return {
      background: hex,
      color: textColor,
      borderColor: withAlpha(hex, 0.4),
      boxShadow: `0 6px 16px ${withAlpha(hex, 0.28)}`,
    };
  };

  const getCategoryChipClassName = (isDropTarget: boolean, isSelected: boolean, isDragging: boolean) => {
    const base = 'px-4 py-2 rounded-full text-sm font-semibold border-2 backdrop-blur-sm transition-transform transition-shadow duration-150 ease-out will-change-transform';
    if (isDropTarget) return `${base} scale-125 shadow-2xl z-30`; 
    if (isSelected) return `${base} scale-105 shadow-lg`; 
    if (isDragging) return `${base} opacity-85`;
    return `${base}`;
  };

  const getChipStyle = (category: MeetingCategory | null, isSelected: boolean, isDropTarget: boolean): CSSProperties => {
    if (!category) {
      return {
        background: isDropTarget ? 'linear-gradient(135deg, rgba(248,113,113,0.25) 0%, rgba(248,113,113,0.12) 100%)' : 'linear-gradient(135deg, rgba(248,113,113,0.18) 0%, rgba(248,113,113,0.08) 100%)',
        borderColor: isSelected || isDropTarget ? '#F97316' : 'rgba(248,113,113,0.35)',
        color: isSelected || isDropTarget ? '#B91C1C' : '#6B7280',
        boxShadow: isSelected || isDropTarget ? '0 6px 18px rgba(248,113,113,0.25)' : 'none',
      };
    }

    const base = category.color || '#F97316';
    return {
      background: isDropTarget
        ? `linear-gradient(135deg, ${withAlpha(base, 0.3)} 0%, ${withAlpha(base, 0.16)} 100%)`
        : `linear-gradient(135deg, ${withAlpha(base, 0.18)} 0%, ${withAlpha(base, 0.08)} 100%)`,
      borderColor: isSelected || isDropTarget ? base : withAlpha(base, 0.35),
      color: isSelected || isDropTarget ? base : '#6B7280',
      boxShadow: isSelected || isDropTarget ? `0 6px 18px ${withAlpha(base, 0.28)}` : 'none',
    };
  };

const previewBaseTranslate = 'translate(-110px, -34px)';
const previewBaseScale = 0.22;

  const setPreviewState = (mode: 'default' | 'inside') => {
  if (!dragPreviewRef.current) return;
  if (mode === 'inside') {
    dragPreviewRef.current.style.transform = `${previewBaseTranslate} scale(${previewBaseScale * 0.08})`;
    dragPreviewRef.current.style.opacity = '0.01';
    dragPreviewRef.current.style.filter = 'blur(8px)';
  } else {
    const baseTransform = dragPreviewRef.current.dataset.baseTransform || `${previewBaseTranslate} scale(${previewBaseScale})`;
    dragPreviewRef.current.style.transform = baseTransform;
    dragPreviewRef.current.style.opacity = dragPreviewRef.current.dataset.baseOpacity || '0.95';
    dragPreviewRef.current.style.filter = 'none';
  }
  };

  // Sauvegarder la page courante dans le localStorage
  useEffect(() => {
    console.log('💾 MeetingHistory: Sauvegarde page dans localStorage:', currentPage);
    localStorage.setItem('meetingHistoryPage', currentPage.toString());
  }, [currentPage]);

  const loadCategories = useCallback(async () => {
    if (!userId) {
      setCategories([]);
      return;
    }

    setIsCategoriesLoading(true);
    setCategoryError(null);
    try {
      const { data, error } = await supabase
        .from('meeting_categories')
        .select('id, name, created_at, color')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data || []).map((item: MeetingCategory) => ({
        ...item,
        color: item.color || '#F97316',
      })));
    } catch (error: any) {
      console.error('Erreur chargement catégories:', error);
      setCategoryError("Impossible de charger les catégories");
    } finally {
      setIsCategoriesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setCategorySelectorMeetingId(null);
  }, [meetings]);

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryFormError('Le nom ne peut pas être vide');
      return;
    }

    setCategoryFormError(null);
    try {
      const { error } = await supabase
        .from('meeting_categories')
        .insert({
          name: trimmed,
          user_id: userId,
          color: newCategoryColor,
        });

      if (error) {
        if (error.code === '23505') {
          setCategoryFormError('Une catégorie avec ce nom existe déjà');
        } else {
          setCategoryFormError(error.message || 'Erreur lors de la création');
        }
        return;
      }

      setNewCategoryName('');
      setNewCategoryColor(colorPalette[0]);
      await loadCategories();
      await onUpdateMeetings();
    } catch (error: any) {
      console.error('Erreur création catégorie:', error);
      setCategoryFormError(error.message || 'Erreur lors de la création');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!userId) return;
    const confirmed = await showConfirm({
      title: 'Supprimer cette catégorie',
      message: 'Supprimer cette catégorie ? Les réunions associées ne seront pas supprimées.',
      confirmLabel: 'Supprimer',
      variant: 'warning',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('meeting_categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId);

      if (error) throw error;

      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId('all');
      }

      await loadCategories();
      await onUpdateMeetings();
    } catch (error: any) {
      console.error('Erreur suppression catégorie:', error);
      await showAlert({
        title: 'Erreur suppression',
        message: 'Erreur lors de la suppression de la catégorie',
        variant: 'danger',
      });
    }
  };

  const handleAssignCategory = async (meetingId: string, categoryId: string | null) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ category_id: categoryId })
        .eq('id', meetingId);

      if (error) throw error;

      setCategorySelectorMeetingId(null);
      await onUpdateMeetings();
    } catch (error: any) {
      console.error('Erreur lors de l\'assignation de la catégorie:', error);
      await showAlert({
        title: 'Erreur',
        message: 'Erreur lors de l\'assignation de la catégorie',
        variant: 'danger',
      });
    }
  };

  const handleOpenCategorySelector = (meetingId: string) => {
    setCategorySelectorMeetingId(prev => (prev === meetingId ? null : meetingId));
  };

  const handleClearCategory = async (meetingId: string) => {
    await handleAssignCategory(meetingId, null);
    setDropHighlightCategoryId('all');
    setTimeout(() => setDropHighlightCategoryId(null), 800);
  };

  const getShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, meeting: Meeting) => {
    setDraggedMeetingId(meeting.id);

    try {
      event.dataTransfer.setData('text/plain', meeting.id);
      event.dataTransfer.effectAllowed = 'move';
    } catch (error) {
      console.warn('Drag start: impossible de définir les données', error);
    }

    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }

    const preview = document.createElement('div');
    preview.style.position = 'fixed';
    preview.style.top = '-9999px';
    preview.style.left = '-9999px';
    preview.style.width = '210px';
    preview.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,244,244,0.92) 100%)';
    preview.style.borderRadius = '16px';
    preview.style.boxShadow = '0 22px 45px rgba(244, 114, 182, 0.35), 0 12px 25px rgba(17, 24, 39, 0.18)';
    preview.style.pointerEvents = 'none';
    preview.style.padding = '12px 14px';
    preview.style.display = 'flex';
    preview.style.flexDirection = 'column';
    preview.style.gap = '6px';
    preview.style.opacity = '0.95';
    preview.style.transform = `${previewBaseTranslate} scale(${previewBaseScale})`;
    preview.style.transition = 'transform 120ms ease, opacity 120ms ease, filter 120ms ease';
    preview.style.filter = 'none';
    preview.style.fontFamily = 'Inter, system-ui, sans-serif';
    preview.dataset.baseOpacity = '0.95';
    preview.dataset.baseTransform = `${previewBaseTranslate} scale(${previewBaseScale})`;

    const titleEl = document.createElement('div');
    titleEl.textContent = meeting.title;
    titleEl.style.fontSize = '12.5px';
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#1F2937';
    titleEl.style.whiteSpace = 'nowrap';
    titleEl.style.overflow = 'hidden';
    titleEl.style.textOverflow = 'ellipsis';

    const metaEl = document.createElement('div');
    metaEl.textContent = `${getShortDate(meeting.created_at)} • ${formatDuration(meeting.duration)}`;
    metaEl.style.fontSize = '10.5px';
    metaEl.style.fontWeight = '500';
    const ghostBaseColor = meeting.category?.color || '#F97316';
    metaEl.style.color = ghostBaseColor;

    preview.appendChild(titleEl);
    preview.appendChild(metaEl);

    if (meeting.category?.name) {
      const chip = document.createElement('span');
      chip.textContent = meeting.category.name;
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '6px';
      chip.style.padding = '3px 8px';
      chip.style.borderRadius = '999px';
      chip.style.fontSize = '9.5px';
      chip.style.fontWeight = '600';
      chip.style.background = withAlpha(ghostBaseColor, 0.2);
      chip.style.color = ghostBaseColor;
      chip.style.border = `1px solid ${withAlpha(ghostBaseColor, 0.35)}`;
      preview.appendChild(chip);
    }

    document.body.appendChild(preview);
    dragPreviewRef.current = preview;

    try {
      event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2);
    } catch (error) {
      console.warn('setDragImage non supporté', error);
    }
  };

  const handleDragEnd = () => {
    setDraggedMeetingId(null);
    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
    setDropHighlightCategoryId(null);
  };

  const handleCategoryDrop = async (categoryId: string | null) => {
    if (!draggedMeetingId) return;
    await handleAssignCategory(draggedMeetingId, categoryId);
    setDraggedMeetingId(null);
    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
    setDropHighlightCategoryId(categoryId ?? 'all');
    setTimeout(() => setDropHighlightCategoryId(null), 800);
    setPreviewState('default');
  };

  const handleDragEnterCategory = (categoryId: string | 'all') => {
    if (!draggedMeetingId) return;
    setDropHighlightCategoryId(categoryId);
    setPreviewState('inside');
  };

  const handleDragLeaveCategory = (categoryId: string | 'all') => {
    if (!draggedMeetingId) return;
    if (dropHighlightCategoryId === categoryId) {
      setDropHighlightCategoryId(null);
      setPreviewState('default');
    }
  };

  const handleUpdateCategoryColor = async (categoryId: string, color: string) => {
    try {
      const { error } = await supabase
        .from('meeting_categories')
        .update({ color })
        .eq('id', categoryId)
        .eq('user_id', userId);

      if (error) throw error;

      await loadCategories();
      await onUpdateMeetings();
    } catch (error: any) {
      console.error('Erreur mise à jour couleur:', error);
      await showAlert({
        title: 'Erreur lors de la mise à jour',
        message: 'Erreur lors de la mise à jour de la couleur',
        variant: 'danger',
      });
    }
  };

  // Charger les IDs des réunions qui ont des emails envoyés
  useEffect(() => {
    const loadSentEmails = async () => {
      if (!meetings || meetings.length === 0) return;

      const meetingIds = meetings.map(m => m.id);
      if (meetingIds.length === 0) return;

      const { data } = await supabase
        .from('email_history')
        .select('meeting_id')
        .in('meeting_id', meetingIds)
        .eq('status', 'sent');

      if (data) {
        const ids = new Set(data.map(item => item.meeting_id).filter(Boolean) as string[]);
        setSentMeetingIds(ids);
      }
    };

    loadSentEmails();

    // Écouter les nouveaux emails envoyés en temps réel
    const channel = supabase
      .channel('email_history_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_history',
          filter: `status=eq.sent`,
        },
        (payload: any) => {
          const newMeetingId = payload.new.meeting_id;
          if (newMeetingId && meetings.some(m => m.id === newMeetingId)) {
            setSentMeetingIds(prev => new Set([...prev, newMeetingId]));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    if (!meetings || !Array.isArray(meetings)) {
      console.log('📋 MeetingHistory filteredMeetings: No meetings array');
      return [];
    }

    const filtered = meetings.filter((meeting) => {
      if (!meeting) return false;

      const normalizedSearchTitle = searchTitle.trim().toLowerCase();
      const meetingTitle = (meeting.title ?? '').toLowerCase();
      const matchesTitle = normalizedSearchTitle === ''
        ? true
        : meetingTitle.includes(normalizedSearchTitle);

      let matchesDate = true;
      if (searchDate && meeting.created_at) {
        const meetingDate = new Date(meeting.created_at).toISOString().split('T')[0];
        matchesDate = meetingDate === searchDate;
      }

      const matchesCategory = selectedCategoryId === 'all'
        ? true
        : meeting.category_id === selectedCategoryId;

      return matchesTitle && matchesDate && matchesCategory;
    });

    console.log('📋 MeetingHistory filteredMeetings:', filtered.length, 'from', meetings.length, 'filters:', { searchTitle, searchDate, selectedCategoryId });
    return filtered;
  }, [meetings, searchTitle, searchDate, selectedCategoryId]);

  // Pagination - nombre d'items selon le mode de vue
  const itemsPerPage = viewMode === 'grid' ? ITEMS_PER_PAGE_GRID : ITEMS_PER_PAGE_LIST;
  const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);

  // Ajuster la page courante si elle dépasse le nombre total de pages ou lors du changement de mode
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage, viewMode]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMeetings = filteredMeetings.slice(startIndex, endIndex);

  // Debug: Log pagination state
  console.log('📄 MeetingHistory PAGINATION: page', currentPage, '/', totalPages, 'showing', paginatedMeetings.length, 'first displayed:', paginatedMeetings[0]?.title);

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

  // Reset page quand les filtres changent RÉELLEMENT (pas au montage/remontage)
  useEffect(() => {
    const previousFilters = previousFiltersRef.current;
    const filtersChanged =
      previousFilters.searchTitle !== searchTitle ||
      previousFilters.searchDate !== searchDate ||
      previousFilters.categoryId !== selectedCategoryId;

    const isInitializing = previousFilters.searchTitle === '' &&
                          previousFilters.searchDate === '' &&
                          previousFilters.categoryId === 'all' &&
                          searchTitle === '' &&
                          searchDate === '' &&
                          selectedCategoryId === 'all';

    if (filtersChanged && !isInitializing) {
      console.log('🔄 MeetingHistory: Filtres RÉELLEMENT changés, reset à page 1');
      setCurrentPage(1);
    }

    previousFiltersRef.current = { searchTitle, searchDate, categoryId: selectedCategoryId };
  }, [searchTitle, searchDate, selectedCategoryId]);

  // Reset page à 1 quand les données changent (synchronisation avec la sidebar)
  const previousFirstMeetingIdRef = useRef(meetings[0]?.id);
  useEffect(() => {
    const previousLength = previousMeetingsLengthRef.current;
    const currentLength = meetings.length;
    const previousFirstId = previousFirstMeetingIdRef.current;
    const currentFirstId = meetings[0]?.id;

    // Si de nouvelles réunions ont été ajoutées OU si la première réunion a changé, retourner à la page 1
    const lengthChanged = currentLength !== previousLength && previousLength > 0;
    const firstMeetingChanged = currentFirstId !== previousFirstId && previousFirstId !== undefined;

    if (lengthChanged || firstMeetingChanged) {
      console.log('🔄 MeetingHistory: Données changées, reset à page 1', { lengthChanged, firstMeetingChanged, currentFirstId, previousFirstId });
      setCurrentPage(1);
    }

    previousMeetingsLengthRef.current = currentLength;
    previousFirstMeetingIdRef.current = currentFirstId;
  }, [meetings.length, meetings[0]?.id]);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSummaryBadge = (meeting: Meeting) => {
    const mode = (meeting.summary_mode as SummaryMode) ?? 'detailed';
    if (meeting.summary_regenerated) {
      return {
        label: `Résumé ${mode === 'short' ? 'court' : 'détaillé'} (régénéré)`,
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    }
    if (mode === 'short') {
      return {
        label: 'Résumé court',
        className: 'bg-orange-100 text-orange-700 border-orange-200',
      };
    }
    return {
      label: 'Résumé détaillé',
      className: 'bg-green-100 text-green-700 border-green-200',
    };
  };

  const canRegenerateSummary = (meeting: Meeting) => {
    return !meeting.summary_regenerated;
  };

  const getTargetMode = (meeting: Meeting): SummaryMode => {
    const current = (meeting.summary_mode as SummaryMode) ?? 'detailed';
    return current === 'short' ? 'detailed' : 'short';
  };

  const handleEditTitle = (meeting: Meeting) => {
    setEditingId(meeting.id);
    setEditedTitle(meeting.title);
  };

  const handleSaveTitle = async (meetingId: string) => {
    if (!editedTitle.trim()) {
      await showAlert({
        title: 'Validation',
        message: 'Le titre ne peut pas être vide',
        variant: 'warning',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ title: editedTitle.trim() })
        .eq('id', meetingId);

      if (error) throw error;

      setEditingId(null);
      onUpdateMeetings(); // Recharger les réunions
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      await showAlert({
        title: 'Erreur lors de la mise à jour',
        message: 'Erreur lors de la mise à jour du titre',
        variant: 'danger',
      });
    }
  };

  const openRegenerationModal = (meeting: Meeting) => {
    setRegenerationTarget(meeting);
    setRegenerationTargetMode(getTargetMode(meeting));
    setRegenerationError(null);
    setShowRegenerationModal(true);
  };

  const closeRegenerationModal = () => {
    if (isRegeneratingSummary) return;
    setShowRegenerationModal(false);
    setRegenerationTarget(null);
    setRegenerationError(null);
  };

  const handleConfirmRegeneration = async () => {
    if (!regenerationTarget) return;
    setIsRegeneratingSummary(true);
    setRegenerationError(null);

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, transcript, summary_mode, summary_regenerated, user_id, title')
        .eq('id', regenerationTarget.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Réunion introuvable.');
      }

      if (!data.transcript || data.transcript.trim().length === 0) {
        throw new Error('La transcription complète est introuvable pour cette réunion.');
      }

      if (data.summary_regenerated) {
        throw new Error('Le résumé a déjà été régénéré pour cette réunion.');
      }

      const targetMode = regenerationTargetMode || 'detailed';

      const [detailedResult, shortResult] = await Promise.all([
        generateSummary(data.transcript, data.user_id, 0, 'detailed'),
        generateSummary(data.transcript, data.user_id, 0, 'short'),
      ]);

      const detailedSummary = detailedResult.summary || '';
      const shortSummary = shortResult.summary || '';
      const finalTitle = detailedResult.title?.trim() || shortResult.title?.trim() || regenerationTarget.title;

      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          title: finalTitle,
          summary: targetMode === 'short' ? shortSummary : detailedSummary,
          summary_detailed: detailedSummary,
          summary_short: shortSummary,
          summary_mode: targetMode,
          summary_regenerated: true,
        })
        .eq('id', regenerationTarget.id);

      if (updateError) throw updateError;

      setRegenerationError(null);
      setShowRegenerationModal(false);
      setRegenerationTarget(null);
      onUpdateMeetings();
      setRegenerationToast({
        message: `Résumé ${targetMode === 'detailed' ? 'détaillé' : 'court'} régénéré avec succès.`,
        mode: targetMode,
      });
      setTimeout(() => setRegenerationToast(null), 4000);
    } catch (err: any) {
      console.error('Erreur régénération résumé:', err);
      setRegenerationError(err.message || 'Une erreur est survenue lors de la régénération.');
    } finally {
      setIsRegeneratingSummary(false);
    }
  };
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedTitle('');
  };

  const handleDeleteClick = (meetingId: string) => {
    setMeetingToDelete(meetingId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (meetingToDelete) {
      setDeletingId(meetingToDelete);
      // Attendre la fin de l'animation (300ms)
      setTimeout(() => {
        onDelete(meetingToDelete);
        setDeletingId(null);
        setMeetingToDelete(null);
      }, 300);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 md:py-16">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-coral-100 to-sunset-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-coral-500 animate-spin" />
        </div>
        <p className="text-cocoa-600 text-base md:text-lg font-medium">Chargement des réunions...</p>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 md:py-16">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-coral-100 to-sunset-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <Calendar className="w-10 h-10 md:w-12 md:h-12 text-coral-500" />
        </div>
        <p className="text-cocoa-600 text-base md:text-lg font-medium">Aucune réunion enregistrée</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      {isRefreshing && meetings.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-cocoa-500 bg-white border border-orange-100 rounded-xl px-4 py-2 shadow-sm animate-fadeIn">
          <Loader2 className="w-4 h-4 animate-spin text-coral-500" />
          Mise à jour des réunions...
        </div>
      )}
      <div className={`bg-gradient-to-r from-white via-[#fff7f0] to-[#ffeede] border-2 border-[#ffd7b7] rounded-xl md:rounded-2xl p-4 md:p-5 sticky top-4 z-30 transition-shadow animate-fadeInDown ${draggedMeetingId ? 'shadow-xl shadow-coral-200/30' : 'shadow-inner shadow-orange-100/30'}`}>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-coral-500" />
            <h3 className="font-bold text-cocoa-800 text-base md:text-lg">Filtres de recherche</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle vue liste/grille */}
            <div className="flex items-center bg-white border-2 border-coral-200 rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  setViewMode('list');
                  localStorage.setItem('meetingViewMode', 'list');
                }}
                className={`p-2 transition-all duration-300 ${
                  viewMode === 'list'
                    ? 'bg-coral-500 text-white'
                    : 'text-coral-600 hover:bg-coral-50'
                }`}
                title="Vue liste"
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setViewMode('grid');
                  localStorage.setItem('meetingViewMode', 'grid');
                }}
                className={`p-2 transition-all duration-300 ${
                  viewMode === 'grid'
                    ? 'bg-coral-500 text-white'
                    : 'text-coral-600 hover:bg-coral-50'
                }`}
                title="Vue grille"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => {
                console.log('🔄 Rechargement manuel des réunions depuis l\'historique');
                onUpdateMeetings();
              }}
              disabled={isLoading}
              className="p-2 hover:bg-coral-50 rounded-lg transition-colors group disabled:opacity-50"
              title="Rafraîchir la liste"
            >
              <svg
                className={`w-5 h-5 text-coral-600 transition-transform ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher par titre..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              className="w-full px-4 py-2.5 md:py-3 pr-10 border-2 border-orange-200 rounded-lg md:rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all text-sm md:text-base"
            />
            {searchTitle && (
              <button
                onClick={() => setSearchTitle('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-400 hover:text-coral-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full px-4 py-2.5 md:py-3 pr-10 border-2 border-orange-200 rounded-lg md:rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all text-sm md:text-base"
            />
            {searchDate && (
              <button
                onClick={() => setSearchDate('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-400 hover:text-coral-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {(searchTitle || searchDate) && (
          <div className="mt-3 flex items-center justify-between text-sm text-cocoa-600">
            <span>
              {filteredMeetings.length} réunion{filteredMeetings.length !== 1 ? 's' : ''} trouvée{filteredMeetings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => {
                setSearchTitle('');
                setSearchDate('');
              }}
              className="text-coral-500 hover:text-coral-600 font-medium transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

    <div className={`relative bg-gradient-to-br from-white via-peach-50/50 to-coral-50/30 border-2 border-coral-200 rounded-xl md:rounded-2xl p-4 md:p-5 sticky top-[120px] z-20 transition-all duration-300 overflow-hidden animate-fadeInDown delay-100 ${draggedMeetingId ? 'shadow-2xl shadow-coral-500/30 scale-[1.02]' : 'shadow-lg'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-coral-100/20 pointer-events-none"></div>
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-xl shadow-lg">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold bg-gradient-to-r from-coral-600 to-sunset-600 bg-clip-text text-transparent text-base md:text-lg">Catégories</h3>
        </div>
        <button
          onClick={() => setShowManageCategories(true)}
          className="group relative flex items-center gap-2 text-sm font-semibold text-coral-600 hover:text-coral-700 transition-all duration-300 px-3 py-2 rounded-lg hover:bg-coral-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-coral-100/0 via-coral-100/50 to-coral-100/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          <FolderPlus className="relative w-4 h-4" />
          <span className="relative">Gérer</span>
        </button>
      </div>

      {categoryError && (
        <div className="mb-3 text-sm text-red-600">{categoryError}</div>
      )}

      <div className="relative flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategoryId('all')}
          draggable={Boolean(draggedMeetingId)}
          onDragOver={(e) => draggedMeetingId && e.preventDefault()}
          onDragEnter={(e) => {
            if (!draggedMeetingId) return;
            e.preventDefault();
            handleDragEnterCategory('all');
          }}
          onDragLeave={() => handleDragLeaveCategory('all')}
          onDrop={(e) => {
            if (!draggedMeetingId) return;
            e.preventDefault();
            handleCategoryDrop(null);
          }}
          className={`${getCategoryChipClassName(dropHighlightCategoryId === 'all', selectedCategoryId === 'all', Boolean(draggedMeetingId))} transition-all duration-300 hover:shadow-lg`}
          style={getChipStyle(null, selectedCategoryId === 'all', dropHighlightCategoryId === 'all')}
        >
          Toutes
        </button>
        {isCategoriesLoading ? (
          <div className="flex items-center gap-2 text-xs text-cocoa-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
          </div>
        ) : categories.length === 0 ? (
          <span className="text-xs text-cocoa-500">Aucune catégorie pour le moment</span>
        ) : (
          categories.map((category, index) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
              draggable={Boolean(draggedMeetingId)}
              onDragOver={(e) => draggedMeetingId && e.preventDefault()}
              onDragEnter={(e) => {
                if (!draggedMeetingId) return;
                e.preventDefault();
                handleDragEnterCategory(category.id);
              }}
              onDragLeave={() => handleDragLeaveCategory(category.id)}
              onDrop={(e) => {
                if (!draggedMeetingId) return;
                e.preventDefault();
                handleCategoryDrop(category.id);
              }}
              className={`${getCategoryChipClassName(dropHighlightCategoryId === category.id, selectedCategoryId === category.id, Boolean(draggedMeetingId))} transition-all duration-300 hover:shadow-lg animate-fadeInRight`}
              style={{
                ...getChipStyle(category, selectedCategoryId === category.id, dropHighlightCategoryId === category.id),
                animationDelay: `${(index + 1) * 50}ms`
              }}
            >
              {category.name}
            </button>
          ))
        )}
      </div>
    </div>

      {draggedMeetingId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1200] max-w-[90vw] px-3 animate-fadeInUp">
          <div className="relative bg-gradient-to-br from-white via-peach-50 to-coral-50 backdrop-blur-md border-2 border-coral-300 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2 overflow-x-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-coral-100/30 pointer-events-none rounded-2xl"></div>
            <span className="relative text-xs font-semibold bg-gradient-to-r from-coral-600 to-sunset-600 bg-clip-text text-transparent mr-2 whitespace-nowrap">Déposer dans :</span>
            <button
              onClick={() => handleCategoryDrop(null)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => {
                if (!draggedMeetingId) return;
                e.preventDefault();
                handleDragEnterCategory('all');
              }}
              onDragLeave={() => handleDragLeaveCategory('all')}
              onDrop={(e) => {
                e.preventDefault();
                handleCategoryDrop(null);
              }}
              className={getCategoryChipClassName(dropHighlightCategoryId === 'all', selectedCategoryId === 'all', Boolean(draggedMeetingId))}
              style={getChipStyle(null, selectedCategoryId === 'all', dropHighlightCategoryId === 'all')}
            >
              Toutes
            </button>
            {categories.map((category) => (
              <button
                key={`floating-${category.id}`}
                onClick={() => handleCategoryDrop(category.id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => {
                  if (!draggedMeetingId) return;
                  e.preventDefault();
                  handleDragEnterCategory(category.id);
                }}
                onDragLeave={() => handleDragLeaveCategory(category.id)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleCategoryDrop(category.id);
                }}
                className={getCategoryChipClassName(dropHighlightCategoryId === category.id, selectedCategoryId === category.id, Boolean(draggedMeetingId))}
                style={getChipStyle(category, selectedCategoryId === category.id, dropHighlightCategoryId === category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredMeetings.length === 0 ? (
        <div className="text-center py-12 md:py-16">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-coral-100 to-sunset-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
            <Search className="w-10 h-10 md:w-12 md:h-12 text-coral-500" />
          </div>
          <p className="text-cocoa-600 text-base md:text-lg font-medium">Aucune réunion trouvée</p>
          <p className="text-cocoa-500 text-sm md:text-base mt-2">Essayez de modifier vos critères de recherche</p>
        </div>
      ) : viewMode === 'grid' ? (
        <>
        {/* Vue grille */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {paginatedMeetings.map((meeting, index) => {
            const summaryBadge = getSummaryBadge(meeting);
            const showRegenerateButton = canRegenerateSummary(meeting);
            const targetMode = getTargetMode(meeting);

            return (
            <div
              key={meeting.id}
              className={`group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden transition-all duration-200 ease-out animate-fadeInUp hover:shadow-xl ${
                deletingId === meeting.id ? 'animate-slideOut opacity-0 scale-95' : ''
              } ${draggedMeetingId === meeting.id ? 'scale-95 opacity-70 shadow-lg border-coral-300' : 'hover:border-coral-300'}`}
              style={{
                zIndex: draggedMeetingId === meeting.id ? 20 : undefined,
                cursor: draggedMeetingId === meeting.id ? 'grabbing' : 'pointer',
                animationDelay: `${index * 30}ms`
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, meeting)}
              onDragEnd={handleDragEnd}
              onClick={() => editingId !== meeting.id && onView(meeting)}
            >
              {/* Preview placeholder - personnalisé avec couleur */}
              <div
                className="h-32 flex items-center justify-center border-b-2 border-gray-200 transition-all duration-300 relative overflow-hidden"
                style={{
                  background: getThumbnailGradient(meeting)
                }}
              >
                {/* Pattern de fond subtil */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-20 h-20 rounded-full blur-2xl" style={{ background: getThumbnailIcon(meeting) }}></div>
                  <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full blur-3xl" style={{ background: getThumbnailIcon(meeting) }}></div>
                </div>
                <FileText
                  className="w-12 h-12 transition-all duration-300 relative z-10"
                  style={{ color: getThumbnailIcon(meeting) }}
                />
              </div>

              {/* Contenu */}
              <div className="p-4">
                {/* Catégorie en haut si existe */}
                {meeting.category && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border mb-2"
                    style={getCategoryBadgeStyle(meeting.category.color)}
                  >
                    <Tag className="w-3 h-3" />
                    {meeting.category.name}
                  </span>
                )}

                {/* Titre */}
                {editingId === meeting.id ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(meeting.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-full px-2 py-1 border-2 border-coral-300 rounded-lg font-semibold text-gray-900 text-sm focus:outline-none focus:border-coral-500 mb-2"
                    autoFocus
                  />
                ) : (
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
                    {meeting.title}
                    {sentMeetingIds.has(meeting.id) && (
                      <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        <Send className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </h3>
                )}

                {/* Date et durée */}
                <div className="flex flex-col gap-1 mb-3">
                  <span className="text-xs text-gray-600 font-medium">
                    {formatDate(meeting.created_at)}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                    <Clock className="w-3 h-3 text-orange-500" />
                    <span>{formatDuration(meeting.duration)}</span>
                  </div>
                </div>


                {/* Actions */}
                <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {editingId === meeting.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveTitle(meeting.id);
                        }}
                        className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        title="Enregistrer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Annuler"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTitle(meeting);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendEmail(meeting);
                        }}
                        className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Envoyer par email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(meeting.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
          })}
        </div>
        </>
      ) : (
        <>
        {/* Vue liste */}
        <div className="space-y-2 md:space-y-3">
          {paginatedMeetings.map((meeting, index) => {
            const summaryBadge = getSummaryBadge(meeting);
            const showRegenerateButton = canRegenerateSummary(meeting);
            const targetMode = getTargetMode(meeting);

            return (
        <div
          key={meeting.id}
          className={`relative bg-gradient-to-br from-white to-orange-50/30 border-2 border-orange-100 rounded-xl md:rounded-2xl overflow-hidden transition-all duration-200 ease-out animate-fadeInUp ${
            deletingId === meeting.id ? 'animate-slideOut opacity-0 scale-95' : ''
          } ${draggedMeetingId === meeting.id ? 'scale-95 opacity-70 shadow-lg border-coral-200' : 'hover:border-coral-300 hover:shadow-xl'}`}
          style={{
            zIndex: draggedMeetingId === meeting.id ? 20 : undefined,
            cursor: draggedMeetingId === meeting.id ? 'grabbing' : 'grab',
            animationDelay: `${index * 50}ms`
          }}
          draggable
          onDragStart={(e) => handleDragStart(e, meeting)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 md:p-5">
            <div
              className={`flex items-center gap-3 md:gap-4 flex-1 min-w-0 ${editingId !== meeting.id ? 'cursor-pointer hover:bg-orange-50/50' : ''} transition-colors -m-4 md:-m-5 p-4 md:p-5 rounded-l-xl md:rounded-l-2xl w-full sm:w-auto`}
              onClick={() => editingId !== meeting.id && onView(meeting)}
            >
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>

              <div className="flex-1 min-w-0">
                {editingId === meeting.id ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(meeting.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-full px-3 py-2 border-2 border-coral-300 rounded-lg font-bold text-cocoa-800 text-base md:text-lg focus:outline-none focus:border-coral-500 focus:ring-2 focus:ring-coral-200"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2 mb-1 md:mb-1.5">
                    <h3 className="font-bold text-cocoa-800 text-base md:text-lg truncate">
                      {meeting.title}
                    </h3>
                    {sentMeetingIds.has(meeting.id) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex-shrink-0">
                        <Send className="w-3 h-3" />
                        Envoyé
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-5">
                  <span className="text-xs md:text-sm text-cocoa-600 font-medium truncate">
                    {formatDate(meeting.created_at)}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs md:text-sm text-cocoa-600 font-medium">
                    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-sunset-500" />
                    <span>{formatDuration(meeting.duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0 sm:ml-auto">
              <div className="flex items-center gap-2">
                {editingId === meeting.id ? (
                  <>
                    <button
                      onClick={() => handleSaveTitle(meeting.id)}
                      className="p-2 md:p-2.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg md:rounded-xl transition-colors"
                      title="Enregistrer"
                    >
                      <Check className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-2 md:p-2.5 text-cocoa-400 hover:text-cocoa-600 hover:bg-cocoa-50 rounded-lg md:rounded-xl transition-colors"
                      title="Annuler"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTitle(meeting);
                      }}
                      className="p-2 md:p-2.5 text-cocoa-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg md:rounded-xl transition-colors"
                      title="Modifier le titre"
                    >
                      <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendEmail(meeting);
                      }}
                      className="p-2 md:p-2.5 text-cocoa-400 hover:text-sunset-500 hover:bg-sunset-50 rounded-lg md:rounded-xl transition-colors"
                      title="Envoyer par email"
                    >
                      <Mail className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(meeting.id);
                      }}
                      className="p-2 md:p-2.5 text-cocoa-400 hover:text-coral-500 hover:bg-coral-50 rounded-lg md:rounded-xl transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </>
                )}
              </div>
              {meeting.category && (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border animate-fadeInRight transition-all duration-300"
                  style={getCategoryBadgeStyle(meeting.category.color)}
                >
                  <Tag className="w-3.5 h-3.5" />
                  {meeting.category.name}
                </span>
              )}
            </div>
          </div>
          <div className="px-4 md:px-5 pb-4 md:pb-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {!meeting.category && (
                <span className="text-xs text-cocoa-500">Aucune catégorie</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenCategorySelector(meeting.id);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-coral-600 hover:text-coral-700"
              >
                <PlusCircle className="w-4 h-4" />
                {meeting.category ? 'Changer de catégorie' : 'Ajouter à une catégorie'}
              </button>
              {meeting.category && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearCategory(meeting.id);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cocoa-500 hover:text-cocoa-700"
                >
                  <X className="w-4 h-4" />
                  Retirer
                </button>
              )}
            </div>

            {categorySelectorMeetingId === meeting.id && (
              <div
                className="mt-1 border-2 border-orange-100 rounded-xl bg-white shadow-md p-3 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                {categories.length === 0 ? (
                  <p className="text-xs text-cocoa-500">
                    Aucune catégorie disponible. Cliquez sur <strong>Gérer</strong> pour en créer une.
                  </p>
                ) : (
                  categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        handleAssignCategory(meeting.id, category.id);
                        setDropHighlightCategoryId(category.id);
                        setTimeout(() => setDropHighlightCategoryId(null), 800);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg border border-orange-100 hover:border-coral-300 hover:bg-coral-50 text-sm font-medium text-cocoa-700"
                    >
                      {category.name}
                      {meeting.category_id === category.id && (
                        <span className="ml-2 text-xs text-coral-500">(actuelle)</span>
                      )}
                    </button>
                  ))
                )}
                {meeting.category && (
                  <button
                    onClick={() => handleClearCategory(meeting.id)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-red-100 hover:border-red-300 hover:bg-red-50 text-sm font-medium text-red-600"
                  >
                    Retirer la catégorie
                  </button>
                )}
                <button
                  onClick={() => setShowManageCategories(true)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-coral-100 hover:border-coral-300 hover:bg-coral-50 text-sm font-medium text-coral-700"
                >
                  Gérer les catégories
                </button>
              </div>
            )}
          </div>
        </div>
      );
      })}
        </div>
        </>
      )}

      {/* Pagination commune aux deux vues */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-2 animate-fadeInUp delay-300">
          <div className="text-sm text-cocoa-600">
            Page {currentPage} sur {totalPages} • {filteredMeetings.length} réunion{filteredMeetings.length !== 1 ? 's' : ''}
          </div>
          <nav className="flex items-center gap-2" aria-label="Pagination des réunions">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-10 w-10 flex items-center justify-center rounded-full border border-coral-200 text-coral-700 hover:bg-coral-100 hover:border-coral-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {paginationRange.map((item, index) => (
                item === 'dots' ? (
                  <span key={`dots-${index}`} className="w-10 text-center text-sm font-medium text-cocoa-400">...</span>
                ) : (
                  <button
                    key={`page-${item}`}
                    onClick={() => setCurrentPage(item)}
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 ${
                      currentPage === item
                        ? 'bg-gradient-to-r from-coral-500 to-sunset-500 text-white shadow-lg shadow-coral-500/30'
                        : 'border border-coral-200 text-coral-700 hover:bg-coral-100 hover:border-coral-300'
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
              className="h-10 w-10 flex items-center justify-center rounded-full border border-coral-200 text-coral-700 hover:bg-coral-100 hover:border-coral-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        </div>
      )}

      <SummaryRegenerationModal
        isOpen={showRegenerationModal}
        meetingTitle={regenerationTarget?.title || 'cette réunion'}
        isProcessing={isRegeneratingSummary}
        errorMessage={regenerationError}
        targetMode={regenerationTargetMode}
        onCancel={closeRegenerationModal}
        onConfirm={handleConfirmRegeneration}
      />

      {regenerationToast && (
        <div className="fixed bottom-6 right-6 z-[1300] animate-fadeInUp">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-emerald-200 bg-white">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-cocoa-900">{regenerationToast.message}</p>
              <p className="text-xs text-cocoa-500">
                Résumé {regenerationToast.mode === 'detailed' ? 'détaillé' : 'court'} maintenant disponible.
              </p>
            </div>
          </div>
        </div>
      )}

    {showManageCategories && (
      <div className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
        <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-zoomIn">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Tag className="w-5 h-5 text-gray-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Gestion des catégories</h4>
            </div>
            <button
              onClick={() => {
                setShowManageCategories(false);
                setCategoryFormError(null);
                setNewCategoryName('');
              }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nouvelle catégorie
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (categoryFormError) setCategoryFormError(null);
                    }}
                    placeholder="Nom de la catégorie"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all bg-white text-sm"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Color picker section */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Couleur</label>
                <div className="flex items-start gap-4">
                  {/* Color preview */}
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-200 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: newCategoryColor }}
                  />
                  {/* Presets */}
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {colorPalette.map((color) => (
                        <button
                          key={`preset-${color}`}
                          type="button"
                          onClick={() => setNewCategoryColor(color)}
                          className={`w-6 h-6 rounded-md transition-all ${newCategoryColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {/* Color picker */}
                    <div className="color-picker-container">
                      <HexColorPicker color={newCategoryColor} onChange={setNewCategoryColor} style={{ width: '100%', height: '120px' }} />
                    </div>
                    <input
                      type="text"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                      className="mt-2 w-full px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-md focus:outline-none focus:border-indigo-400"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              {categoryFormError && (
                <p className="text-sm text-red-600">{categoryFormError}</p>
              )}
            </form>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {isCategoriesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Chargement des catégories...
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Aucune catégorie créée pour le moment.</p>
              ) : (
                categories.map((category, index) => (
                  <div
                    key={category.id}
                    className="relative flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-all duration-200 bg-white shadow-sm animate-fadeInLeft"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-md flex-shrink-0"
                          style={{ backgroundColor: category.color || '#6366F1' }}
                        />
                        <p className="font-medium text-gray-900 truncate">{category.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-7">
                        Créée le {new Date(category.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      <div className="mt-2 ml-7 flex flex-wrap items-center gap-1.5">
                        {colorPalette.map((color) => (
                          <button
                            key={`palette-${category.id}-${color}`}
                            type="button"
                            onClick={() => handleUpdateCategoryColor(category.id, color)}
                            className={`w-5 h-5 rounded transition-all duration-150 ${category.color === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                      title="Supprimer la catégorie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Supprimer cette réunion ?"
        message="Êtes-vous sûr de vouloir supprimer cette réunion ? Cette action est irréversible."
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setMeetingToDelete(null);
        }}
        confirmText="OK"
        cancelText="Annuler"
        isDangerous={true}
      />
    </div>
  );
};
