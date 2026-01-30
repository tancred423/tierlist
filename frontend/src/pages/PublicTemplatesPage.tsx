import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import { getDisplayName } from '../types';
import type { Template, Pagination as PaginationType } from '../types';
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
  onStartRanking: () => void;
  onCopy?: () => void;
  onToggleLike: () => void;
  liked: boolean;
  isLoggedIn: boolean;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
}

function TemplateCard({
  template,
  onStartRanking,
  onCopy,
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
    <div className="template-card card">
      <div className="template-header">
        <div className="template-header-top">
          <h3 className="template-title">{template.title}</h3>
          <button
            className={`like-btn ${liked ? 'active' : ''}`}
            onClick={() => isLoggedIn && onToggleLike()}
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

      <div className="template-actions">
        {isLoggedIn && onCopy && (
          <button onClick={onCopy} className="btn btn-secondary template-cta">
            {t('template.copy')}
          </button>
        )}
        <button onClick={onStartRanking} className="btn btn-primary template-cta">
          {isLoggedIn ? t('home.startRanking') : t('auth.loginToStartRanking')}
        </button>
      </div>
    </div>
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
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { user, login } = useAuthStore();
  const { t, language } = useI18n();
  const { getEffectiveFormat } = useClockFormatStore();
  const navigate = useNavigate();
  const clockFormat = getEffectiveFormat();

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

  function loginWithRedirect() {
    localStorage.setItem('auth_redirect', '/public-templates');
    login();
  }

  async function handleStartRanking(template: Template) {
    if (!user) {
      loginWithRedirect();
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

  async function handleCopyTemplate(template: Template) {
    if (!user) {
      loginWithRedirect();
      return;
    }

    try {
      const { template: newTemplate } = await api.copyTemplate(template.id);
      navigate(`/template/${newTemplate.id}`);
    } catch (error) {
      console.error('Failed to copy template:', error);
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
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <p>{search ? t('publicTemplates.empty') : t('publicTemplates.empty')}</p>
          {!search && <p>{t('publicTemplates.beFirst')}</p>}
        </div>
      ) : (
        <>
          <div className="templates-grid">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onStartRanking={() => handleStartRanking(template)}
                onCopy={() => handleCopyTemplate(template)}
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
      )}
    </div>
  );
}
