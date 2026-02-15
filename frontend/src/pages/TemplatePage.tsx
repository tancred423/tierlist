import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { getDisplayName } from '../types';
import type { Template, CardPlacement } from '../types';
import { TierlistGrid } from '../components/TierlistGrid';
import { MoreIcon } from '../components/icons/MoreIcon';
import './TemplatePage.css';

const DEFAULT_TIERS = [
  { name: 'S', color: '#ff7f7f' },
  { name: 'A', color: '#ffbf7f' },
  { name: 'B', color: '#ffff7f' },
  { name: 'C', color: '#7fff7f' },
  { name: 'D', color: '#7fbfff' },
  { name: 'F', color: '#ff7fff' },
];

export function TemplatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const { t } = useI18n();

  const isNew = !id || id === 'new';

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const isCreatingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);
  const metadataDirtyRef = useRef(false);
  const templateRef = useRef<Template | null>(null);
  templateRef.current = template;

  usePageTitle(title ? `${t('pageTitle.template')}: ${title}` : '');

  const isOwner = !!user && !!template && template.ownerId === user.id;

  const createNewTemplate = useCallback(async () => {
    try {
      const { template: newTemplate } = await api.createTemplate({
        title: t('template.newTemplate'),
        tiers: DEFAULT_TIERS.map(tier => ({ name: tier.name, color: tier.color })),
        columns: [{ name: '' }],
      });
      await api.createCard(newTemplate.id, {
        title: t('template.defaultCardTitle'),
        description: t('template.defaultCardDescription'),
      });
      navigate(`/template/${newTemplate.id}`, { replace: true });
    } catch (error) {
      console.error('Failed to create template:', error);
      navigate('/');
    }
  }, [navigate, t]);

  const loadTemplate = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      const { template: loaded } = await api.getTemplate(id);
      setTemplate(loaded);
      setTitle(loaded.title);
      setDescription(loaded.description || '');
      setIsPublic(loaded.isPublic);
      isLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to load template:', error);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (isNew) {
      if (!isCreatingRef.current) {
        isCreatingRef.current = true;
        createNewTemplate();
      }
    } else {
      loadTemplate();
    }
  }, [isNew, createNewTemplate, loadTemplate]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const autoSaveMetadata = useCallback(
    async (saveTitle: string, saveDesc: string, savePublic: boolean) => {
      if (!id || !templateRef.current || !isLoadedRef.current) return;
      if (!saveTitle.trim()) return;
      setSaveStatus('saving');
      try {
        await api.updateTemplate(id, {
          title: saveTitle,
          description: saveDesc || undefined,
          isPublic: savePublic,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [id],
  );

  useEffect(() => {
    if (!isLoadedRef.current || !templateRef.current || !isOwner) return;
    if (!metadataDirtyRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(() => {
      autoSaveMetadata(title, description, isPublic);
    }, 800);
  }, [title, description, isPublic, autoSaveMetadata, isOwner]);

  const allUnrankedPlacements: CardPlacement[] = template
    ? template.cards.map((card, index) => ({
        id: `placement-${card.id}`,
        filledTierlistId: '',
        cardId: card.id,
        tierId: null,
        columnId: null,
        orderIndex: index,
      }))
    : [];

  async function handleTierEdit(tierId: string, updates: { name: string; color: string }) {
    if (!template) return;
    setSaveStatus('saving');
    try {
      await api.updateTier(tierId, updates);
      setTemplate(prev =>
        prev
          ? {
              ...prev,
              tiers: prev.tiers.map(t => (t.id === tierId ? { ...t, ...updates } : t)),
            }
          : prev,
      );
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleTierAdd() {
    if (!template) return;
    setSaveStatus('saving');
    try {
      const { tier } = await api.addTier(template.id, {
        name: `Tier ${template.tiers.length + 1}`,
        color: '#888888',
        orderIndex: template.tiers.length,
      });
      setTemplate(prev => (prev ? { ...prev, tiers: [...prev.tiers, tier] } : prev));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleTierDelete(tierId: string) {
    if (!template || template.tiers.length <= 1) return;
    if (!confirm(t('template.deleteTierConfirm'))) return;
    setSaveStatus('saving');
    try {
      await api.deleteTier(tierId);
      setTemplate(prev =>
        prev ? { ...prev, tiers: prev.tiers.filter(t => t.id !== tierId) } : prev,
      );
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleTierReorder(tierIds: string[]) {
    if (!template) return;
    setSaveStatus('saving');
    try {
      await api.reorderTiers(
        template.id,
        tierIds.map((id, i) => ({ id, orderIndex: i })),
      );
      setTemplate(prev => {
        if (!prev) return prev;
        const tierMap = new Map(prev.tiers.map(t => [t.id, t]));
        return {
          ...prev,
          tiers: tierIds.map((tid, i) => ({ ...tierMap.get(tid)!, orderIndex: i })),
        };
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleColumnEdit(colId: string, updates: { name: string; color?: string }) {
    if (!template) return;
    setSaveStatus('saving');
    try {
      await api.updateColumn(colId, updates);
      setTemplate(prev =>
        prev
          ? {
              ...prev,
              columns: prev.columns.map(c =>
                c.id === colId
                  ? { ...c, name: updates.name || null, color: updates.color || null }
                  : c,
              ),
            }
          : prev,
      );
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleColumnAdd() {
    if (!template) return;
    setSaveStatus('saving');
    try {
      const { column } = await api.addColumn(template.id, {
        name: '',
        orderIndex: template.columns.length,
      });
      setTemplate(prev => (prev ? { ...prev, columns: [...prev.columns, column] } : prev));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleColumnDelete(colId: string) {
    if (!template || template.columns.length <= 1) return;
    if (!confirm(t('template.deleteColumnConfirm'))) return;
    setSaveStatus('saving');
    try {
      await api.deleteColumn(colId);
      setTemplate(prev =>
        prev ? { ...prev, columns: prev.columns.filter(c => c.id !== colId) } : prev,
      );
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleColumnReorder(colIds: string[]) {
    if (!template) return;
    setSaveStatus('saving');
    try {
      await api.reorderColumns(
        template.id,
        colIds.map((id, i) => ({ id, orderIndex: i })),
      );
      setTemplate(prev => {
        if (!prev) return prev;
        const colMap = new Map(prev.columns.map(c => [c.id, c]));
        return {
          ...prev,
          columns: colIds.map((cid, i) => ({ ...colMap.get(cid)!, orderIndex: i })),
        };
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleCardReorder(cardIds: string[]) {
    if (!template) return;
    setSaveStatus('saving');
    try {
      await api.reorderCards(
        template.id,
        cardIds.map((id, i) => ({ id, orderIndex: i })),
      );
      setTemplate(prev => {
        if (!prev) return prev;
        const cardMap = new Map(prev.cards.map(c => [c.id, c]));
        return {
          ...prev,
          cards: cardIds.map((cid, i) => ({ ...cardMap.get(cid)!, orderIndex: i })),
        };
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  async function handleCardAdd(data: { title: string; imageUrl?: string; description?: string }) {
    if (!template) return;
    setSaveStatus('saving');
    try {
      const { card } = await api.createCard(template.id, data);
      setTemplate(prev => (prev ? { ...prev, cards: [...prev.cards, card] } : prev));
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to add card:', error);
      setSaveStatus('error');
    }
  }

  async function handleCardEdit(
    cardId: string,
    data: { title: string; imageUrl?: string; description?: string },
  ) {
    setSaveStatus('saving');
    try {
      const { card } = await api.updateCard(cardId, data);
      setTemplate(prev =>
        prev ? { ...prev, cards: prev.cards.map(c => (c.id === card.id ? card : c)) } : prev,
      );
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to update card:', error);
      setSaveStatus('error');
    }
  }

  async function handleCardDelete(cardId: string) {
    if (!template || template.cards.length <= 1) return;
    if (!confirm(t('card.deleteConfirm'))) return;
    setSaveStatus('saving');
    try {
      await api.deleteCard(cardId);
      setTemplate(prev =>
        prev ? { ...prev, cards: prev.cards.filter(c => c.id !== cardId) } : prev,
      );
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to delete card:', error);
      setSaveStatus('error');
    }
  }

  async function handleStartTierlist() {
    if (!template) return;
    if (!user) {
      localStorage.setItem('auth_redirect', `/template/${id}`);
      login();
      return;
    }
    try {
      const generatedTitle =
        `${template.title} - ${t('home.rankingBy')} ${getDisplayName(user)}`.slice(0, 255);
      const { filledTierlist } = await api.createFilledTierlist({
        templateId: template.id,
        title: generatedTitle,
      });
      navigate(`/tierlist/${filledTierlist.id}`);
    } catch (error) {
      console.error('Failed to create tierlist:', error);
    }
  }

  async function handleCopyTemplate() {
    if (!template) return;
    if (!user) {
      localStorage.setItem('auth_redirect', `/template/${id}`);
      login();
      return;
    }
    setIsCopying(true);
    try {
      const { template: newTemplate } = await api.copyTemplate(template.id);
      navigate(`/template/${newTemplate.id}`);
    } catch (error) {
      console.error('Failed to copy template:', error);
    } finally {
      setIsCopying(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!template) return;
    if (!confirm(t('template.deleteConfirm'))) return;
    try {
      await api.deleteTemplate(template.id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert(t('errors.failedToDelete'));
    }
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isNew && !template) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>{t('errors.failedToLoad')}</h3>
        </div>
      </div>
    );
  }

  if (!template) return null;

  const gridOverlayContent = (
    <div className="grid-overlay-content">
      <p>{t('template.cellBlockedTitle')}</p>
      <p className="grid-overlay-text">
        {isOwner ? t('template.cellBlockedOwner') : t('template.cellBlockedVisitor')}
      </p>
      <button className="btn btn-primary btn-sm" onClick={handleStartTierlist}>
        {user ? t('home.startRanking') : t('auth.loginToStartRanking')}
      </button>
      <p className="grid-overlay-text">{t('template.cellBlockedCopyHint')}</p>
      <button
        className="btn btn-secondary btn-sm"
        onClick={handleCopyTemplate}
        disabled={isCopying}
      >
        {isCopying ? t('common.loading') : t('template.copyTemplate')}
      </button>
    </div>
  );

  return (
    <div className="template-page">
      <div className="template-page-header">
        <div className="template-page-header-info">
          {isOwner ? (
            <input
              type="text"
              value={title}
              onChange={e => {
                metadataDirtyRef.current = true;
                setTitle(e.target.value);
              }}
              className="template-title-input"
              maxLength={255}
              placeholder={t('template.templateTitle')}
            />
          ) : (
            <>
              <h1 className="template-page-title">{template.title}</h1>
              {template.owner && (
                <p className="text-muted">
                  {t('template.by')} {getDisplayName(template.owner)}
                </p>
              )}
            </>
          )}
        </div>
        <div className="template-page-header-actions">
          {isOwner && (
            <>
              <span className={`save-status-pill ${saveStatus}`}>
                {saveStatus === 'saving' && `⟳ ${t('tierlist.saving')}`}
                {saveStatus === 'saved' && `✓ ${t('tierlist.saved')}`}
                {saveStatus === 'error' && `✕ ${t('tierlist.saveError')}`}
              </span>
              <button
                type="button"
                className={`visibility-btn ${isPublic ? 'is-public' : 'is-private'}`}
                onClick={() => {
                  metadataDirtyRef.current = true;
                  setIsPublic(!isPublic);
                }}
              >
                {isPublic ? '🌍' : '🔒'} {isPublic ? t('template.public') : t('template.private')}
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
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleCopyTemplate();
                      }}
                      disabled={isCopying}
                    >
                      {isCopying ? t('common.loading') : t('template.copyTemplate')}
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDeleteTemplate();
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {!isOwner && (
            <>
              <button
                onClick={handleCopyTemplate}
                className="btn btn-secondary btn-sm"
                disabled={isCopying}
              >
                {isCopying ? t('common.loading') : t('template.copyTemplate')}
              </button>
              <button onClick={handleStartTierlist} className="btn btn-primary btn-sm">
                {user ? t('home.startRanking') : t('auth.loginToStartRanking')}
              </button>
            </>
          )}
        </div>
      </div>
      {isOwner ? (
        <div className="template-page-description">
          <textarea
            value={description}
            onChange={e => {
              const val = e.target.value;
              if (val.split('\n').length > 3) return;
              metadataDirtyRef.current = true;
              setDescription(val);
            }}
            className="template-desc-input"
            placeholder={t('template.descriptionPlaceholder')}
            rows={3}
            maxLength={2000}
          />
        </div>
      ) : (
        template.description && (
          <div className="template-page-description">
            <p className="text-muted">{template.description}</p>
          </div>
        )
      )}

      <TierlistGrid
        template={template}
        placements={allUnrankedPlacements}
        cellsBlocked
        gridOverlay={gridOverlayContent}
        onTierEdit={isOwner ? handleTierEdit : undefined}
        onTierAdd={isOwner ? handleTierAdd : undefined}
        onTierDelete={isOwner ? handleTierDelete : undefined}
        onTierReorder={isOwner ? handleTierReorder : undefined}
        onColumnEdit={isOwner ? handleColumnEdit : undefined}
        onColumnAdd={isOwner ? handleColumnAdd : undefined}
        onColumnDelete={isOwner ? handleColumnDelete : undefined}
        onColumnReorder={isOwner ? handleColumnReorder : undefined}
        onCardAdd={isOwner ? handleCardAdd : undefined}
        onCardEdit={isOwner ? handleCardEdit : undefined}
        onCardDelete={isOwner && template.cards.length > 1 ? handleCardDelete : undefined}
        onCardReorder={isOwner ? handleCardReorder : undefined}
        readOnly={!isOwner}
      />
    </div>
  );
}
