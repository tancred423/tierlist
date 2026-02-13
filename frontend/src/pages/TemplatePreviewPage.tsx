import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import { getDisplayName } from '../types';
import type { Template, CardPlacement } from '../types';
import { TierlistGrid } from '../components/TierlistGrid';
import './TemplatePreviewPage.css';

export function TemplatePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const { t } = useI18n();

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  const loadTemplate = useCallback(async () => {
    if (!id) return;

    try {
      const { template } = await api.getTemplate(id);
      setTemplate(template);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const isOwner = user && template && template.ownerId === user.id;

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

  async function handleStartTierlist() {
    if (!template) return;

    if (!user) {
      localStorage.setItem('auth_redirect', `/template/${id}/preview`);
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
      localStorage.setItem('auth_redirect', `/template/${id}/preview`);
      login();
      return;
    }

    setIsCopying(true);
    try {
      const { template: newTemplate } = await api.copyTemplate(template.id);
      navigate(`/template/${newTemplate.id}/edit`);
    } catch (error) {
      console.error('Failed to copy template:', error);
    } finally {
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

  if (!template) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>{t('errors.failedToLoad')}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="template-preview-page">
      <div className="preview-header">
        <div className="preview-header-info">
          <h1>{template.title}</h1>
          {template.owner && (
            <p className="text-muted">
              {t('template.by')} {getDisplayName(template.owner)}
            </p>
          )}
          {template.description && <p className="text-muted">{template.description}</p>}
        </div>
        <div className="preview-header-actions">
          {isOwner ? (
            <Link to={`/template/${template.id}/edit`} className="btn btn-secondary btn-sm">
              {t('common.edit')}
            </Link>
          ) : (
            <button
              onClick={handleCopyTemplate}
              className="btn btn-secondary btn-sm"
              disabled={isCopying}
            >
              {isCopying ? t('common.loading') : t('template.copyTemplate')}
            </button>
          )}
        </div>
      </div>

      <div className="preview-grid-wrapper">
        <TierlistGrid
          template={template}
          placements={allUnrankedPlacements}
          onPlacementsChange={() => {}}
          readOnly
        />
        <div className="preview-modal-anchor">
          <div className="preview-modal card">
            <p className="preview-modal-text">{t('template.previewHint')}</p>
            <button onClick={handleStartTierlist} className="btn btn-primary">
              {user ? t('home.startRanking') : t('auth.loginToStartRanking')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
