import { Calendar, Clock, FileText, Trash2, Loader2, Search, X, Mail, Edit2, Check, ChevronLeft, ChevronRight, Send, PlusCircle, Tag, FolderPlus, List, LayoutGrid, Sparkles, ChevronDown } from 'lucide-react';
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
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);

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

  // Fermer le dropdown des catégories quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showCategoriesDropdown && !target.closest('.categories-dropdown-container')) {
        setShowCategoriesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoriesDropdown]);

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
    <div className="bg-white overflow-hidden">
      {/* Header */}
      <div className="px-0 md:px-6 py-4 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Historique
        </h2>
      </div>


      {/* Filters Bar */}
      <div className="px-0 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-gray-50/50">
        {/* Ligne 1: Recherche et actions */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 md:py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 bg-white"
            />
            {searchTitle && (
              <button
                onClick={() => setSearchTitle('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Actions - Date, Edit, Refresh, View toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Date filter */}
            <div className="relative flex-1 md:flex-none">
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full md:w-auto px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 bg-white"
              />
              {/* Placeholder simulé pour mobile */}
              {!searchDate && (
                <span className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                  jj/mm/aaaa
                </span>
              )}
              {searchDate && (
                <button
                  onClick={() => setSearchDate('')}
                  className="absolute -right-1 -top-1 sm:-right-2 sm:-top-2 p-0.5 bg-gray-500 text-white rounded-full hover:bg-gray-600"
                >
                  <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              )}
            </div>

            {/* Edit button - Icon seulement sur mobile */}
            <button
              onClick={() => setShowManageCategories(true)}
              className="flex px-2 py-2 sm:px-3 sm:py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors items-center gap-1.5"
              title="Gérer les catégories"
            >
              <Edit2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">Édit</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={() => {
                console.log('🔄 Rechargement manuel des réunions depuis l\'historique');
                onUpdateMeetings();
              }}
              disabled={isLoading}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Rafraîchir"
            >
              <svg
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* View toggle - Visible sur mobile */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => {
                  setViewMode('list');
                  localStorage.setItem('meetingViewMode', 'list');
                }}
                className={`p-1 sm:p-1.5 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vue liste"
              >
                <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode('grid');
                  localStorage.setItem('meetingViewMode', 'grid');
                }}
                className={`p-1 sm:p-1.5 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vue grille"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Ligne 2: Category chips - Dropdown sur mobile, scrollable sur desktop */}
        <div className="flex items-center gap-2">
          {/* Version Desktop - Scrollable horizontal */}
          <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
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
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                selectedCategoryId === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Toutes
            </button>
            {!isCategoriesLoading && categories.map((category) => (
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
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  selectedCategoryId === category.id
                    ? 'text-white'
                    : 'text-gray-600 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategoryId === category.id ? category.color : `${category.color}20`,
                  color: selectedCategoryId === category.id ? '#fff' : category.color
                }}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Version Mobile - Dropdown */}
          <div className="md:hidden relative flex-1 categories-dropdown-container">
            <button
              onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {selectedCategoryId === 'all' ? (
                <span className="text-sm font-medium text-gray-700">Mes catégories</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: categories.find(c => c.id === selectedCategoryId)?.color || '#gray' }}
                  />
                  <span 
                    className="text-sm font-medium"
                    style={{ color: categories.find(c => c.id === selectedCategoryId)?.color || '#gray' }}
                  >
                    {categories.find(c => c.id === selectedCategoryId)?.name || 'Catégorie'}
                  </span>
                </div>
              )}
              <ChevronDown 
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                  showCategoriesDropdown ? 'rotate-180' : ''
                } ${!showCategoriesDropdown ? 'animate-pulse' : ''}`}
              />
            </button>

            {/* Dropdown content */}
            {showCategoriesDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      setSelectedCategoryId('all');
                      setShowCategoriesDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                      selectedCategoryId === 'all'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Toutes
                  </button>
                  {!isCategoriesLoading && categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setShowCategoriesDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                        selectedCategoryId === category.id
                          ? 'text-white'
                          : 'text-gray-600 hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: selectedCategoryId === category.id ? category.color : `${category.color}20`,
                        color: selectedCategoryId === category.id ? '#fff' : category.color
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Edit button - Visible uniquement sur mobile */}
          <button
            onClick={() => setShowManageCategories(true)}
            className="md:hidden p-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center flex-shrink-0"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Filter status */}
        {(searchTitle || searchDate || selectedCategoryId !== 'all') && (
          <div className="mt-3 px-3 md:px-0 flex items-center justify-between text-xs text-gray-500">
            <span>
              {filteredMeetings.length} réunion{filteredMeetings.length !== 1 ? 's' : ''} trouvée{filteredMeetings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => {
                setSearchTitle('');
                setSearchDate('');
                setSelectedCategoryId('all');
              }}
              className="text-orange-500 hover:text-orange-600 font-medium"
            >
              Réinitialiser
            </button>
          </div>
        )}

        {categoryError && (
          <div className="mt-2 px-3 md:px-0 text-xs text-red-600">{categoryError}</div>
        )}
      </div>

      {/* Refreshing indicator */}
      {isRefreshing && meetings.length > 0 && (
        <div className="px-0 md:px-6 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2 text-sm text-orange-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          Mise à jour des réunions...
        </div>
      )}

      {/* Floating drop zone for drag & drop */}
      {draggedMeetingId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1200] max-w-[90vw] px-3 animate-fadeInUp">
          <div className="bg-white backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-gray-500 mr-2 whitespace-nowrap">Déposer dans :</span>
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
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                dropHighlightCategoryId === 'all'
                  ? 'bg-orange-500 text-white scale-110'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sans catégorie
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
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  dropHighlightCategoryId === category.id ? 'scale-110' : ''
                }`}
                style={{
                  backgroundColor: dropHighlightCategoryId === category.id ? category.color : `${category.color}20`,
                  color: dropHighlightCategoryId === category.id ? '#fff' : category.color
                }}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-0 md:p-6">
        {filteredMeetings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">Aucune réunion trouvée</p>
            <p className="text-gray-400 text-sm mt-1">Essayez de modifier vos critères de recherche</p>
          </div>
        ) : viewMode === 'grid' ? (
        <>
        {/* Vue grille */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 md:gap-5">
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
        {/* Vue liste - Style table */}
        <div className="overflow-hidden">
          {/* Table rows */}
          <div className="divide-y divide-gray-100">
            {paginatedMeetings.map((meeting, index) => (
              <div
                key={meeting.id}
                className={`flex items-center gap-2 md:gap-4 py-3 px-0 md:px-2 hover:bg-gray-50 transition-all duration-150 rounded-lg group ${
                  deletingId === meeting.id ? 'opacity-0 scale-95' : ''
                } ${draggedMeetingId === meeting.id ? 'scale-98 opacity-70 bg-orange-50' : ''}`}
                style={{
                  cursor: draggedMeetingId === meeting.id ? 'grabbing' : 'auto',
                }}
                draggable={window.innerWidth >= 768}
                onDragStart={(e) => window.innerWidth >= 768 && handleDragStart(e, meeting)}
                onDragEnd={handleDragEnd}
              >
                {/* File icon - Caché sur mobile */}
                <div
                  className="hidden md:flex flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => onView(meeting)}
                >
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>

                {/* Date - Caché sur mobile */}
                <div className="hidden md:flex flex-shrink-0 w-24 text-sm text-gray-600">
                  {new Date(meeting.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </div>

                {/* Title - clickable - Avec date sur mobile */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => editingId !== meeting.id && onView(meeting)}
                >
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
                      className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:border-orange-500"
                      autoFocus
                    />
                  ) : (
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate hover:text-orange-600 transition-colors min-w-0">
                          {meeting.title}
                        </span>
                        {sentMeetingIds.has(meeting.id) && (
                          <>
                            {/* Version desktop */}
                            <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              <Send className="w-3 h-3" />
                              Envoyé
                            </span>
                            {/* Version mobile - icon seulement */}
                            <span className="sm:hidden flex-shrink-0 inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-600 rounded-full" title="Envoyé">
                              <Send className="w-3 h-3" />
                            </span>
                          </>
                        )}
                      </div>
                      {/* Date sur mobile uniquement */}
                      <span className="md:hidden text-xs text-gray-500">
                        {new Date(meeting.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Category badge - Caché sur mobile */}
                <div className="hidden md:flex flex-shrink-0 w-auto md:w-32">
                  {meeting.category ? (
                    <span
                      className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: `${meeting.category.color}20`,
                        color: meeting.category.color
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCategorySelector(meeting.id);
                      }}
                    >
                      {meeting.category.name}
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCategorySelector(meeting.id);
                      }}
                      className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
                    >
                      + Catégorie
                    </button>
                  )}
                </div>

                {/* Actions - Certains cachés sur mobile */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {editingId === meeting.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveTitle(meeting.id);
                        }}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Enregistrer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                        title="Annuler"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Edit button - Caché sur mobile */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTitle(meeting);
                        }}
                        className="hidden md:block p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Mail button - Caché sur mobile */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendEmail(meeting);
                        }}
                        className="hidden md:block p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                        title="Envoyer par email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(meeting.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Category selector popup */}
          {categorySelectorMeetingId && (
            <div className="fixed inset-0 z-50" onClick={() => setCategorySelectorMeetingId(null)}>
              <div
                className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px]"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">Choisir une catégorie</div>
                {categories.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-2">
                    Aucune catégorie disponible
                  </p>
                ) : (
                  categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        handleAssignCategory(categorySelectorMeetingId, category.id);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      ></span>
                      {category.name}
                    </button>
                  ))
                )}
                {paginatedMeetings.find(m => m.id === categorySelectorMeetingId)?.category && (
                  <button
                    onClick={() => handleClearCategory(categorySelectorMeetingId)}
                    className="w-full text-left px-2 py-1.5 rounded text-sm text-red-600 hover:bg-red-50 mt-1 border-t border-gray-100 pt-2"
                  >
                    Retirer la catégorie
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        </>
      )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-6 px-2">
            <div className="text-xs sm:text-sm text-cocoa-600 order-2 sm:order-1">
              Page {currentPage} sur {totalPages} • {filteredMeetings.length} réunion{filteredMeetings.length !== 1 ? 's' : ''}
            </div>
            <nav className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2" aria-label="Pagination des réunions">
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
      </div>

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
