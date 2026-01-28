import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import type { FilledTierlist, CardPlacement, PlacementData } from '../types';
import { TierlistGrid } from '../components/TierlistGrid';
import { ShareModal } from '../components/ShareModal';
import './TierlistEditorPage.css';

function formatDate(dateString: string, language: string, clockFormat: '12h' | '24h'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: clockFormat === '12h',
  });
}

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

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlacementsRef = useRef<PlacementData[] | null>(null);

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
    };
  }, []);

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

  async function handleDeleteRanking(tierlistId: string) {
    if (!confirm(t('tierlist.deleteConfirm'))) return;

    try {
      await api.deleteFilledTierlist(tierlistId);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete ranking:', error);
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
      console.error('Failed to copy ranking:', error);
      setIsCopying(false);
    }
  }

  async function handleCreateTemplate(tierlistId: string) {
    setIsCreatingTemplate(true);
    try {
      const { template } = await api.createTemplateFromRanking(tierlistId);
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
            {t('home.basedOn')} "{tierlist.template.title}"{' '}
            {tierlist.template.owner
              ? `${t('template.by')} ${tierlist.template.owner.username}`
              : ''}
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
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' && t('tierlist.saving')}
              {saveStatus === 'saved' && t('tierlist.saved')}
              {saveStatus === 'error' && t('tierlist.saveError')}
            </span>
          )}
          {isCoOwner && (
            <>
              <button
                onClick={() => handleCopy(tierlist.id)}
                className="btn btn-secondary"
                disabled={isCopying}
              >
                {isCopying ? t('tierlist.copying') : t('tierlist.copyRanking')}
              </button>
              <button onClick={() => handleLeave(tierlist.id)} className="btn btn-secondary">
                {t('tierlist.leave')}
              </button>
            </>
          )}
          {isOwner && (
            <>
              <button onClick={() => handleDeleteRanking(tierlist.id)} className="btn btn-danger">
                {t('common.delete')}
              </button>
              {tierlist.templateSnapshot && (
                <button
                  onClick={() => handleCreateTemplate(tierlist.id)}
                  className="btn btn-secondary"
                  disabled={isCreatingTemplate}
                >
                  {isCreatingTemplate
                    ? t('tierlist.creatingTemplate')
                    : t('tierlist.createTemplate')}
                </button>
              )}
              <button onClick={() => setShowShareModal(true)} className="btn btn-secondary">
                {t('common.share')}
              </button>
            </>
          )}
        </div>
      </div>

      <TierlistGrid
        template={tierlist.template}
        placements={placements}
        onPlacementsChange={handlePlacementsChange}
        readOnly={!canEdit}
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
