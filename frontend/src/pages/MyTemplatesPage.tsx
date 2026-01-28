import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import { getDisplayName } from '../types';
import type { Template, Pagination as PaginationType } from '../types';
import { Pagination } from '../components/Pagination';
import './MyTemplatesPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }
  return url;
}

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

interface TemplateCardProps {
  template: Template;
  onStartRanking: () => void;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
}

function TemplateCard({ template, onStartRanking, t, language, clockFormat }: TemplateCardProps) {
  const maxTiers = 5;
  const maxCols = 5;
  const maxCards = 5;

  const sortedTiers = [...template.tiers].sort((a, b) => a.orderIndex - b.orderIndex);
  const sortedCols = [...template.columns].sort((a, b) => a.orderIndex - b.orderIndex);
  const sortedCards = [...template.cards].sort((a, b) => a.orderIndex - b.orderIndex);

  const visibleTiers = sortedTiers.slice(0, maxTiers);
  const extraTiers = sortedTiers.length - maxTiers;
  const visibleCols = sortedCols.slice(0, maxCols);
  const extraCols = sortedCols.length - maxCols;
  const visibleCards = sortedCards.slice(0, maxCards);
  const extraCards = sortedCards.length - maxCards;

  return (
    <div className="template-card card">
      <div className="template-header">
        <h3 className="template-title">{template.title}</h3>
        <span className={`visibility-badge ${template.isPublic ? 'public' : 'private'}`}>
          {template.isPublic ? t('template.public') : t('template.private')}
        </span>
        {template.description && <p className="template-description">{template.description}</p>}
        {template.updatedAt && (
          <span className="template-revision">
            {t('template.revision')}: {formatDate(template.updatedAt, language, clockFormat)}
          </span>
        )}
      </div>

      <div className="template-table-preview">
        <div className="preview-grid">
          {(sortedCols.length > 1 || sortedCols.some(c => c.name)) && (
            <div className="preview-header-row">
              <div className="preview-tier-label" />
              {visibleCols.map((col, i) => (
                <div key={col.id} className="preview-col-header" title={col.name || undefined}>
                  {col.name || `Col ${i + 1}`}
                </div>
              ))}
              {extraCols > 0 && <div className="preview-extra">+{extraCols}</div>}
            </div>
          )}
          {visibleTiers.map(tier => (
            <div key={tier.id} className="preview-row">
              <div
                className="preview-tier-label"
                style={{ backgroundColor: tier.color }}
                title={tier.name}
              >
                {tier.name}
              </div>
              {visibleCols.map(col => (
                <div key={col.id} className="preview-cell" />
              ))}
              {extraCols > 0 && <div className="preview-cell preview-cell-extra" />}
            </div>
          ))}
          {extraTiers > 0 && (
            <div className="preview-row preview-row-extra">
              <div className="preview-extra-tiers">
                +{extraTiers} {t('template.more')}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="template-cards-preview">
        {visibleCards.map(card => (
          <div key={card.id} className="preview-card" title={card.title}>
            {card.imageUrl ? (
              <img src={getImageUrl(card.imageUrl)!} alt={card.title} />
            ) : (
              <span>{card.title[0]}</span>
            )}
          </div>
        ))}
        {extraCards > 0 && <div className="preview-card preview-card-extra">+{extraCards}</div>}
      </div>

      <div className="template-actions">
        <Link to={`/template/${template.id}`} className="btn btn-secondary template-cta">
          {t('common.edit')}
        </Link>
        <button onClick={onStartRanking} className="btn btn-primary template-cta">
          {t('home.startRanking')}
        </button>
      </div>
    </div>
  );
}

export function MyTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const { t, language } = useI18n();
  const { getEffectiveFormat } = useClockFormatStore();
  const navigate = useNavigate();
  const clockFormat = getEffectiveFormat();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getMyTemplates({ page, limit: 12 });
      setTemplates(result.templates);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleStartRanking(template: Template) {
    if (!user) return;

    try {
      const { filledTierlist } = await api.createFilledTierlist({
        templateId: template.id,
        title: `${template.title} - ${t('home.rankingBy')} ${getDisplayName(user)}`,
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

  return (
    <div className="container my-templates-page">
      <div className="page-header">
        <h1>{t('myTemplates.title')}</h1>
        <Link to="/template/new" className="btn btn-primary">
          + {t('home.createNewTemplate')}
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <p>{t('myTemplates.empty')}</p>
          <p>{t('myTemplates.createFirst')}</p>
          <Link to="/template/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            + {t('home.createNewTemplate')}
          </Link>
        </div>
      ) : (
        <>
          <div className="templates-grid">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onStartRanking={() => handleStartRanking(template)}
                t={t}
                language={language}
                clockFormat={clockFormat}
              />
            ))}
          </div>

          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
