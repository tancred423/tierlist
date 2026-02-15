import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { getDisplayName } from '../utils/user';
import type { Template, CardPlacement } from '../types';
import { TierlistGrid } from '../components/TierlistGrid';
import './SharedTemplatePage.css';

export function SharedTemplatePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { t } = useI18n();

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  usePageTitle(template ? `${t('pageTitle.template')}: ${template.title}` : '');

  const loadTemplate = useCallback(async () => {
    if (!token) return;

    try {
      const { template } = await api.getTemplateByShareToken(token);
      setTemplate(template);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  function redirectToLogin() {
    const currentPath = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }

  async function handleCopy() {
    if (!token || !user) {
      redirectToLogin();
      return;
    }

    setIsCopying(true);
    try {
      const { template: newTemplate } = await api.copyTemplateByShareToken(token);
      navigate(`/template/${newTemplate.id}`);
    } catch (error) {
      console.error('Failed to copy template:', error);
      alert('Failed to copy template');
    } finally {
      setIsCopying(false);
    }
  }

  async function handleStartTierlist() {
    if (!template) return;

    if (!user) {
      redirectToLogin();
      return;
    }

    try {
      const { filledTierlist } = await api.createFilledTierlist({
        templateId: template.id,
        shareToken: token,
      });
      navigate(`/tierlist/${filledTierlist.id}`);
    } catch (error) {
      console.error('Failed to create tierlist:', error);
    }
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>Template not found</h3>
          <p>This shared template link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  const allUnrankedPlacements: CardPlacement[] = template.cards.map((card, index) => ({
    id: `placement-${card.id}`,
    filledTierlistId: '',
    cardId: card.id,
    tierId: null,
    columnId: null,
    orderIndex: index,
  }));

  const gridOverlayContent = (
    <div className="grid-overlay-content">
      <p className="grid-overlay-text">{t('template.cellBlockedVisitor')}</p>
      <button className="btn btn-primary btn-sm" onClick={handleCopy} disabled={isCopying}>
        {isCopying ? t('common.loading') : t('template.copyTemplate')}
      </button>
    </div>
  );

  return (
    <div className="shared-template-page-grid">
      <div className="shared-template-header">
        <div className="shared-template-header-info">
          <h1>{template.title}</h1>
          {template.owner && (
            <p className="text-muted">
              {t('template.by')} {getDisplayName(template.owner)}
            </p>
          )}
          {template.description && <p className="text-muted">{template.description}</p>}
        </div>
        <div className="shared-template-header-actions">
          <button onClick={handleCopy} className="btn btn-secondary btn-sm" disabled={isCopying}>
            {isCopying ? t('common.loading') : t('template.copyTemplate')}
          </button>
          <button onClick={handleStartTierlist} className="btn btn-primary btn-sm">
            {user ? t('home.startRanking') : t('auth.loginToStartRanking')}
          </button>
        </div>
      </div>

      <TierlistGrid
        template={template}
        placements={allUnrankedPlacements}
        cellsBlocked
        gridOverlay={gridOverlayContent}
        readOnly
      />
    </div>
  );
}
