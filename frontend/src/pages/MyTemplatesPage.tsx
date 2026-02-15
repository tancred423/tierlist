import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { SORT_OPTIONS, SORT_LABEL_KEYS } from '../types';
import type { Template, Pagination as PaginationType, SortOption } from '../types';
import { formatDate } from '../utils/format';
import { Pagination } from '../components/Pagination';
import { PreviewGrid, PreviewCardBar } from '../components/PreviewGrid';
import './MyTemplatesPage.css';

interface TemplateCardProps {
  template: Template;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
}

function TemplateCard({ template, t, language, clockFormat }: TemplateCardProps) {
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
    <Link to={`/template/${template.id}`} className="template-card card template-card-link">
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
        <PreviewGrid
          tiers={visibleTiers}
          columns={visibleCols}
          extraTiers={extraTiers}
          extraCols={extraCols}
          moreLabel={t('template.more')}
        />
      </div>

      <div className="template-cards-preview">
        <PreviewCardBar cards={visibleCards} extraCards={extraCards} />
      </div>
    </Link>
  );
}

export function MyTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const { t, language } = useI18n();
  const { getEffectiveFormat } = useClockFormatStore();
  const clockFormat = getEffectiveFormat();
  const { user, setUser } = useAuthStore();
  const [sort, setSort] = useState<SortOption>(user?.templateSort || 'updated_desc');
  usePageTitle(t('myTemplates.title'));

  const handleSortChange = useCallback(
    async (newSort: SortOption) => {
      setSort(newSort);
      setPage(1);
      try {
        const { user: updatedUser } = await api.updateProfile({ templateSort: newSort });
        setUser(updatedUser);
      } catch {
        // Ignore
      }
    },
    [setUser],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getMyTemplates({ page, limit: 12, sort });
      setTemplates(result.templates);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, sort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        <div className="page-header-actions">
          {templates.length > 0 && (
            <div className="sort-dropdown">
              <select
                id="template-sort"
                value={sort}
                onChange={e => handleSortChange(e.target.value as SortOption)}
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {t(SORT_LABEL_KEYS[opt])}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Link to="/template/new" className="btn btn-secondary btn-sm">
            + {t('home.createNewTemplate')}
          </Link>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <p>{t('myTemplates.empty')}</p>
          <p>{t('myTemplates.createFirst')}</p>
        </div>
      ) : (
        <>
          <div className="templates-grid">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
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
