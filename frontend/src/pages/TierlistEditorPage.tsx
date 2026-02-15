import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { getDisplayName } from '../utils/user';
import type { FilledTierlist, CardPlacement, PlacementData } from '../types';
import { hasQuickEdits, buildEffectiveTemplate } from '../utils/tierlist';
import { formatDate } from '../utils/format';
import { TierlistGrid } from '../components/TierlistGrid';
import { ShareModal } from '../components/ShareModal';
import { ShareIcon } from '../components/icons/ShareIcon';
import { MoreIcon } from '../components/icons/MoreIcon';
import './TierlistEditorPage.css';

export function TierlistEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t, language } = useI18n();
  const { getEffectiveFormat } = useClockFormatStore();
  const clockFormat = getEffectiveFormat();

  const [tierlist, setTierlist] = useState<FilledTierlist | null>(null);
  const [placements, setPlacements] = useState<CardPlacement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showShareModal, setShowShareModal] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  usePageTitle(tierlist ? `${t('pageTitle.tierlist')}: ${tierlist.title}` : '');

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlacementsRef = useRef<PlacementData[] | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTierlist = useCallback(async () => {
    if (!id) return;

    try {
      const { filledTierlist, canEdit: editable } = await api.getFilledTierlist(id);
      setTierlist(filledTierlist);
      setPlacements(filledTierlist.placements);
      setCanEdit(editable);
    } catch (error) {
      console.error('Failed to load tierlist:', error);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadTierlist();
  }, [loadTierlist]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingPlacementsRef.current && id) {
        api.updatePlacements(id, pendingPlacementsRef.current);
        pendingPlacementsRef.current = null;
      }
    };
  }, [id]);

  const savePlacements = useCallback(
    async (placementData: PlacementData[]) => {
      if (!id) return;

      setSaveStatus('saving');
      try {
        await api.updatePlacements(id, placementData);
        setSaveStatus('saved');
      } catch (error) {
        console.error('Failed to save placements:', error);
        setSaveStatus('error');
      }
    },
    [id],
  );

  const handlePlacementsChange = useCallback(
    (newPlacements: PlacementData[]) => {
      setPlacements(newPlacements as CardPlacement[]);
      pendingPlacementsRef.current = newPlacements;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setSaveStatus('saving');
      saveTimeoutRef.current = setTimeout(() => {
        if (pendingPlacementsRef.current) {
          savePlacements(pendingPlacementsRef.current);
          pendingPlacementsRef.current = null;
        }
      }, 500);
    },
    [savePlacements],
  );

  async function handleTitleChange(newTitle: string) {
    if (!id || !tierlist) return;

    try {
      await api.updateFilledTierlist(id, { title: newTitle });
      setTierlist({ ...tierlist, title: newTitle });
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  }

  const handleDisplaySettingsChange = useCallback(
    (displaySettings: import('../types').DisplaySettings) => {
      if (!id || !tierlist) return;

      setTierlist(prev => (prev ? { ...prev, displaySettings } : prev));

      setSaveStatus('saving');
      api
        .updateFilledTierlist(id, { displaySettings })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'));
    },
    [id, tierlist],
  );

  const handleTierAdd = useCallback(() => {
    if (!tierlist) return;
    const ds = tierlist.displaySettings || {};
    const baseTiers = tierlist.template?.tiers ?? tierlist.templateSnapshot?.tiers ?? [];
    const totalTiers =
      baseTiers.length + (ds.additionalTiers?.length || 0) - (ds.hiddenTierIds?.length || 0);
    const newTier = {
      id: `qe-tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Tier ${totalTiers + 1}`,
      color: '#888888',
      orderIndex: baseTiers.length + (ds.additionalTiers?.length || 0),
    };
    const additionalTiers = [...(ds.additionalTiers || []), newTier];
    handleDisplaySettingsChange({ ...ds, additionalTiers });
  }, [tierlist, handleDisplaySettingsChange]);

  const handleTierDelete = useCallback(
    (tierId: string) => {
      if (!tierlist) return;
      if (!confirm(t('template.deleteTierConfirm'))) return;
      const ds = tierlist.displaySettings || {};
      const isAdditional = (ds.additionalTiers || []).some(t => t.id === tierId);
      const newDs = { ...ds };
      if (isAdditional) {
        newDs.additionalTiers = (ds.additionalTiers || []).filter(t => t.id !== tierId);
      } else {
        newDs.hiddenTierIds = [...(ds.hiddenTierIds || []), tierId];
      }
      const newPlacements = placements.map(p => {
        if (p.tierId === tierId) {
          return { ...p, tierId: null, columnId: null, orderIndex: 999 };
        }
        return p;
      });
      handleDisplaySettingsChange(newDs);
      handlePlacementsChange(
        newPlacements.map(p => ({
          cardId: p.cardId,
          tierId: p.tierId,
          columnId: p.columnId,
          orderIndex: p.orderIndex,
        })),
      );
    },
    [tierlist, placements, handleDisplaySettingsChange, handlePlacementsChange, t],
  );

  const handleColumnAdd = useCallback(() => {
    if (!tierlist) return;
    const ds = tierlist.displaySettings || {};
    const baseCols = tierlist.template?.columns ?? tierlist.templateSnapshot?.columns ?? [];
    const newCol = {
      id: `qe-col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: '',
      orderIndex: baseCols.length + (ds.additionalColumns?.length || 0),
    };
    const additionalColumns = [...(ds.additionalColumns || []), newCol];
    handleDisplaySettingsChange({ ...ds, additionalColumns });
  }, [tierlist, handleDisplaySettingsChange]);

  const handleColumnDelete = useCallback(
    (colId: string) => {
      if (!tierlist) return;
      if (!confirm(t('template.deleteColumnConfirm'))) return;
      const ds = tierlist.displaySettings || {};
      const isAdditional = (ds.additionalColumns || []).some(c => c.id === colId);
      const newDs = { ...ds };
      if (isAdditional) {
        newDs.additionalColumns = (ds.additionalColumns || []).filter(c => c.id !== colId);
      } else {
        newDs.hiddenColumnIds = [...(ds.hiddenColumnIds || []), colId];
      }
      const newPlacements = placements.map(p => {
        if (p.columnId === colId) {
          return { ...p, tierId: null, columnId: null, orderIndex: 999 };
        }
        return p;
      });
      handleDisplaySettingsChange(newDs);
      handlePlacementsChange(
        newPlacements.map(p => ({
          cardId: p.cardId,
          tierId: p.tierId,
          columnId: p.columnId,
          orderIndex: p.orderIndex,
        })),
      );
    },
    [tierlist, placements, handleDisplaySettingsChange, handlePlacementsChange, t],
  );

  const handleCardEdit = useCallback(
    (cardId: string, data: { title: string; imageUrl?: string; description?: string }) => {
      if (!tierlist) return;
      const ds = tierlist.displaySettings || {};
      const additionalCards = ds.additionalCards || [];
      const isAdditional = additionalCards.some(c => c.id === cardId);
      if (isAdditional) {
        const updatedCards = additionalCards.map(c =>
          c.id === cardId
            ? {
                ...c,
                title: data.title,
                imageUrl: data.imageUrl || null,
                description: data.description || null,
              }
            : c,
        );
        handleDisplaySettingsChange({ ...ds, additionalCards: updatedCards });
      } else {
        const cardOverrides = { ...(ds.cardOverrides || {}), [cardId]: data };
        handleDisplaySettingsChange({ ...ds, cardOverrides });
      }
    },
    [tierlist, handleDisplaySettingsChange],
  );

  const handleCardDelete = useCallback(
    (cardId: string) => {
      if (!tierlist) return;
      if (!confirm(t('card.deleteConfirm'))) return;
      const ds = tierlist.displaySettings || {};
      const additionalCards = ds.additionalCards || [];
      const isAdditional = additionalCards.some(c => c.id === cardId);
      const newDs = { ...ds };
      if (isAdditional) {
        newDs.additionalCards = additionalCards.filter(c => c.id !== cardId);
      } else {
        newDs.removedCardIds = [...(ds.removedCardIds || []), cardId];
      }
      const newPlacements = placements.filter(p => p.cardId !== cardId);
      handleDisplaySettingsChange(newDs);
      handlePlacementsChange(
        newPlacements.map(p => ({
          cardId: p.cardId,
          tierId: p.tierId,
          columnId: p.columnId,
          orderIndex: p.orderIndex,
        })),
      );
    },
    [tierlist, placements, handleDisplaySettingsChange, handlePlacementsChange, t],
  );

  async function handleDeleteTierlist(tierlistId: string) {
    if (!confirm(t('tierlist.deleteConfirm'))) return;

    try {
      await api.deleteFilledTierlist(tierlistId);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete tierlist:', error);
      alert(t('errors.failedToDelete'));
    }
  }

  async function handleLeave(tierlistId: string) {
    if (!confirm(t('tierlist.leaveConfirm') || 'Are you sure you want to leave as co-owner?'))
      return;

    try {
      await api.leaveFilledTierlist(tierlistId);
      navigate('/');
    } catch (error) {
      console.error('Failed to leave:', error);
    }
  }

  async function handleCopy(tierlistId: string) {
    setIsCopying(true);
    try {
      const { filledTierlist: newList } = await api.copyFilledTierlist(tierlistId);
      navigate(`/tierlist/${newList.id}`);
    } catch (error) {
      console.error('Failed to copy tierlist:', error);
      setIsCopying(false);
    }
  }

  async function handleCreateTemplate(tierlistId: string) {
    setIsCreatingTemplate(true);
    try {
      const { template } = await api.createTemplateFromTierlist(tierlistId);
      navigate(`/template/${template.id}`);
    } catch (error) {
      console.error('Failed to create template:', error);
      setIsCreatingTemplate(false);
    }
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!tierlist) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>Tierlist not found</h3>
        </div>
      </div>
    );
  }

  const isOwner = tierlist.ownerId === user?.id;
  const isCoOwner = canEdit && !isOwner;

  const effectiveTemplate = buildEffectiveTemplate(tierlist);

  return (
    <div className="tierlist-editor-page">
      <div className="editor-header">
        <div className="header-title">
          <div className="title-row">
            {isOwner ? (
              <input
                type="text"
                value={tierlist.title}
                onChange={e => handleTitleChange(e.target.value)}
                className="title-input"
                maxLength={255}
              />
            ) : (
              <h1 className="title-text">{tierlist.title}</h1>
            )}
            {isCoOwner && <span className="co-owner-badge">{t('home.coOwner')}</span>}
            {isOwner &&
              (tierlist.editShareEnabled ||
                (tierlist.coOwners && tierlist.coOwners.length > 0)) && (
                <span className="shared-badge">{t('home.shared')}</span>
              )}
          </div>
          <p className="text-muted">
            {tierlist.template?.title ? (
              <>
                {t('home.basedOn')} "{tierlist.template.title}"{' '}
                {tierlist.template.owner
                  ? `${t('template.by')} ${getDisplayName(tierlist.template.owner)}`
                  : ''}
                {hasQuickEdits(tierlist.displaySettings) && ` ${t('tierlist.edited')}`}
              </>
            ) : (
              <>
                {t('tierlist.basedOnDeleted')}
                {hasQuickEdits(tierlist.displaySettings) && ` ${t('tierlist.edited')}`}
              </>
            )}
          </p>
          {tierlist.templateSnapshot?.snapshotAt && (
            <p className="revision-info">
              {t('template.revision')}:{' '}
              {formatDate(tierlist.templateSnapshot.snapshotAt, language, clockFormat)}
            </p>
          )}
        </div>
        <div className="editor-actions">
          {canEdit && (
            <span className={`save-status-pill ${saveStatus}`}>
              {saveStatus === 'saving' && `⟳ ${t('tierlist.saving')}`}
              {saveStatus === 'saved' && `✓ ${t('tierlist.saved')}`}
              {saveStatus === 'error' && `✕ ${t('tierlist.saveError')}`}
            </span>
          )}
          {isCoOwner && (
            <>
              <button
                onClick={() => handleCopy(tierlist.id)}
                className="btn btn-secondary btn-sm"
                disabled={isCopying}
              >
                {isCopying ? t('tierlist.copying') : t('tierlist.copyRanking')}
              </button>
              <button onClick={() => handleLeave(tierlist.id)} className="btn btn-secondary btn-sm">
                {t('tierlist.leave')}
              </button>
            </>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => setShowShareModal(true)}
                className="btn-icon-action"
                title={t('common.share')}
              >
                <ShareIcon />
              </button>
              <div className="actions-menu" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="btn-icon-action"
                  title="More"
                >
                  <MoreIcon />
                </button>
                {menuOpen && (
                  <div className="actions-menu-dropdown">
                    {tierlist.templateSnapshot && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          handleCreateTemplate(tierlist.id);
                        }}
                        disabled={isCreatingTemplate}
                      >
                        {isCreatingTemplate
                          ? t('tierlist.creatingTemplate')
                          : t('tierlist.createTemplate')}
                      </button>
                    )}
                    <button
                      className="danger"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDeleteTierlist(tierlist.id);
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <TierlistGrid
        template={effectiveTemplate}
        placements={placements}
        onPlacementsChange={canEdit ? handlePlacementsChange : undefined}
        readOnly={!canEdit}
        displaySettings={tierlist.displaySettings}
        onDisplaySettingsChange={canEdit ? handleDisplaySettingsChange : undefined}
        onTierAdd={canEdit ? handleTierAdd : undefined}
        onTierDelete={canEdit ? handleTierDelete : undefined}
        onColumnAdd={canEdit ? handleColumnAdd : undefined}
        onColumnDelete={canEdit ? handleColumnDelete : undefined}
        onCardEdit={canEdit ? handleCardEdit : undefined}
        onCardDelete={canEdit ? handleCardDelete : undefined}
      />

      {showShareModal && tierlist && (
        <ShareModal
          tierlist={tierlist}
          onClose={() => setShowShareModal(false)}
          onUpdate={updates => setTierlist({ ...tierlist, ...updates })}
        />
      )}
    </div>
  );
}
