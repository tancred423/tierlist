import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { getDisplayName } from '../types';
import type { Pagination as PaginationType, Template } from '../types';
import { Pagination } from '../components/Pagination';
import './PublicTemplatesPage.css';

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

interface TemplateWithLikes extends Template {
  likeCount: number;
}

interface TemplateCardProps {
  template: TemplateWithLikes;
  onToggleLike: () => void;
  liked: boolean;
  isLoggedIn: boolean;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
}

function TemplateCard({
  template,
  onToggleLike,
  liked,
  isLoggedIn,
  t,
  language,
  clockFormat,
}: TemplateCardProps) {
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
        <div className="template-header-top">
          <h3 className="template-title">{template.title}</h3>
          <button
            className={`like-btn ${liked ? 'active' : ''}`}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (isLoggedIn) onToggleLike();
            }}
            title={
              !isLoggedIn
                ? t('auth.loginToStartRanking')
                : liked
                  ? t('publicTemplates.removeVote')
                  : t('publicTemplates.upvote')
            }
            disabled={!isLoggedIn}
          >
            <span className="like-icon">{liked ? '♥' : '♡'}</span>
            <span className="like-count">{template.likeCount}</span>
          </button>
        </div>
        {template.owner && (
          <span className="template-author">
            {t('template.by')} {getDisplayName(template.owner)}
          </span>
        )}
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
    </Link>
  );
}

type SortOption = 'popular' | 'newest' | 'oldest';

export function PublicTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithLikes[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<SortOption>('popular');
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const { t, language } = useI18n();
  const { getEffectiveFormat } = useClockFormatStore();
  const clockFormat = getEffectiveFormat();
  usePageTitle(t('publicTemplates.title'));

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getPublicTemplates({ page, limit: 12, search, sort });
      setTemplates(result.templates);
      setPagination(result.pagination);

      if (user) {
        const likes = new Set<string>();
        for (const template of result.templates) {
          try {
            const likeResult = await api.getTemplateLike(template.id);
            if (likeResult.liked) {
              likes.add(template.id);
            }
          } catch {
            // Ignore - template may not exist or user not logged in
          }
        }
        setUserLikes(likes);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, sort, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function handleSortChange(newSort: SortOption) {
    setPage(1);
    setSort(newSort);
  }

  async function handleToggleLike(templateId: string) {
    if (!user) return;

    try {
      const result = await api.toggleTemplateLike(templateId);
      setUserLikes(prev => {
        const newSet = new Set(prev);
        if (result.liked) {
          newSet.add(templateId);
        } else {
          newSet.delete(templateId);
        }
        return newSet;
      });
      setTemplates(prev =>
        prev.map(t => (t.id === templateId ? { ...t, likeCount: result.likeCount } : t)),
      );
    } catch (error) {
      console.error('Failed to toggle like:', error);
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
    <div className="container public-templates-page">
      <div className="page-header">
        <h1>{t('publicTemplates.title')}</h1>
        <div className="page-controls">
          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              className="form-input search-input"
              placeholder={t('publicTemplates.search')}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </form>
          <select
            className="form-input sort-select"
            value={sort}
            onChange={e => handleSortChange(e.target.value as SortOption)}
          >
            <option value="popular">{t('publicTemplates.sortPopular')}</option>
            <option value="newest">{t('publicTemplates.sortNewest')}</option>
            <option value="oldest">{t('publicTemplates.sortOldest')}</option>
          </select>
          {user && (
            <button
              className={`btn ${showLikedOnly ? 'btn-primary' : 'btn-secondary'} liked-filter-btn`}
              onClick={() => setShowLikedOnly(!showLikedOnly)}
              title={t('publicTemplates.showLikedOnly')}
            >
              <span className="liked-filter-icon">{showLikedOnly ? '♥' : '♡'}</span>
              {t('publicTemplates.showLikedOnly')}
            </button>
          )}
        </div>
      </div>

      {(() => {
        const displayTemplates = showLikedOnly
          ? templates.filter(t => userLikes.has(t.id))
          : templates;

        if (templates.length === 0) {
          return (
            <div className="empty-state">
              <p>{t('publicTemplates.empty')}</p>
              {!search && <p>{t('publicTemplates.beFirst')}</p>}
            </div>
          );
        }

        if (displayTemplates.length === 0 && showLikedOnly) {
          return (
            <div className="empty-state">
              <p>{t('publicTemplates.noLikedTemplates')}</p>
            </div>
          );
        }

        return (
          <>
            <div className="templates-grid">
              {displayTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onToggleLike={() => handleToggleLike(template.id)}
                  liked={userLikes.has(template.id)}
                  isLoggedIn={!!user}
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
        );
      })()}
    </div>
  );
}
