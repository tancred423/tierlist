import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import type { FilledTierlist, CardPlacement, PlacementData } from '../types';
import { TierlistGrid } from '../components/TierlistGrid';
import './SharedTierlistPage.css';

interface SharedTierlistPageProps {
  mode: 'view' | 'edit';
}

export function SharedTierlistPage({ mode }: SharedTierlistPageProps) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { t } = useI18n();

  const [tierlist, setTierlist] = useState<FilledTierlist | null>(null);
  const [placements, setPlacements] = useState<CardPlacement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlacementsRef = useRef<PlacementData[] | null>(null);

  const loadTierlist = useCallback(async () => {
    if (!token) return;

    try {
      let result;
      if (mode === 'view') {
        result = await api.getFilledTierlistByViewToken(token);
      } else {
        result = await api.getFilledTierlistByEditToken(token);
      }

      setTierlist(result.filledTierlist);
      setPlacements(result.filledTierlist.placements);
      setCanEdit(result.canEdit);
    } catch (err) {
      console.error('Failed to load tierlist:', err);
      setError(
        mode === 'view'
          ? t('share.viewNotAvailable') ||
              'This tierlist is not available for viewing. The owner may have disabled sharing.'
          : t('share.editNotAvailable') ||
              'This tierlist is not available for editing. The owner may have disabled sharing.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, mode, t]);

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
      if (!tierlist) return;

      setSaveStatus('saving');
      try {
        await api.updatePlacements(tierlist.id, placementData);
        setSaveStatus('saved');
      } catch (error) {
        console.error('Failed to save placements:', error);
        setSaveStatus('error');
      }
    },
    [tierlist],
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

  function redirectToLogin() {
    const currentPath = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }

  async function handleCopy(tierlistId: string) {
    if (!user) {
      redirectToLogin();
      return;
    }

    setIsCopying(true);
    try {
      const { filledTierlist: newList } = await api.copyFilledTierlist(tierlistId);
      navigate(`/tierlist/${newList.id}`);
    } catch (error) {
      console.error('Failed to copy ranking:', error);
      setIsCopying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !tierlist) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>Unable to Access Tierlist</h3>
          <p>{error || 'This tierlist could not be found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-tierlist-page">
      <div className="page-header">
        <div className="header-info">
          <h1>{tierlist.title}</h1>
          <p className="text-muted">
            {t('template.by')} {tierlist.owner?.username} • {t('home.basedOn')} "
            {tierlist.template.title}"
            {mode === 'view' && <span className="view-badge">{t('tierlist.viewOnly')}</span>}
            {mode === 'edit' && canEdit && <span className="edit-badge">{t('home.coOwner')}</span>}
          </p>
        </div>
        <div className="header-actions">
          {canEdit && (
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' && t('tierlist.saving')}
              {saveStatus === 'saved' && t('tierlist.saved')}
              {saveStatus === 'error' && t('tierlist.saveError')}
            </span>
          )}
          <button
            onClick={() => handleCopy(tierlist.id)}
            className="btn btn-secondary"
            disabled={isCopying}
          >
            {isCopying ? t('tierlist.copying') : t('tierlist.copyRanking')}
          </button>
          {mode === 'edit' && canEdit && (
            <button onClick={() => handleLeave(tierlist.id)} className="btn btn-secondary">
              {t('tierlist.leave')}
            </button>
          )}
        </div>
      </div>

      <TierlistGrid
        template={tierlist.template}
        placements={placements}
        onPlacementsChange={handlePlacementsChange}
        readOnly={!canEdit}
      />
    </div>
  );
}
