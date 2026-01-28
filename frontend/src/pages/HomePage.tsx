import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import type { Template, FilledTierlist } from '../types';
import './HomePage.css';

interface TemplateCardProps {
  template: Template;
  onStartRanking: () => void;
  onCopy?: () => void;
  isLoggedIn: boolean;
  isOwned?: boolean;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
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

function TemplateCard({
  template,
  onStartRanking,
  onCopy,
  isLoggedIn,
  isOwned,
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
        <h3 className="template-title">{template.title}</h3>
        {isOwned && (
          <span className={`visibility-badge ${template.isPublic ? 'public' : 'private'}`}>
            {template.isPublic ? t('template.public') : t('template.private')}
          </span>
        )}
        {template.owner && (
          <span className="template-author">
            {t('template.by')} {template.owner.username}
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
          {sortedCols.length > 1 && (
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
              <img src={card.imageUrl} alt={card.title} />
            ) : (
              <span>{card.title[0]}</span>
            )}
          </div>
        ))}
        {extraCards > 0 && <div className="preview-card preview-card-extra">+{extraCards}</div>}
      </div>

      <div className="template-actions">
        {isOwned && (
          <Link to={`/template/${template.id}`} className="btn btn-secondary template-cta">
            {t('common.edit')}
          </Link>
        )}
        {!isOwned && isLoggedIn && onCopy && (
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

interface RankingWithCoOwner extends FilledTierlist {
  isCoOwner?: boolean;
}

interface RankingCardProps {
  ranking: RankingWithCoOwner;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
}

function RankingCard({ ranking, t, language, clockFormat }: RankingCardProps) {
  const maxTiers = 5;
  const maxCols = 5;
  const maxUnranked = 5;

  const template = ranking.template;
  if (!template) return null;

  const sortedTiers = [...template.tiers].sort((a, b) => a.orderIndex - b.orderIndex);
  const sortedCols = [...template.columns].sort((a, b) => a.orderIndex - b.orderIndex);

  const visibleTiers = sortedTiers.slice(0, maxTiers);
  const extraTiers = sortedTiers.length - maxTiers;
  const visibleCols = sortedCols.slice(0, maxCols);
  const extraCols = sortedCols.length - maxCols;

  const placements = ranking.placements || [];
  const cardMap = new Map(template.cards.map(c => [c.id, c]));

  const getCardForCell = (tierId: string, colId: string) => {
    const placement = placements.find(p => p.tierId === tierId && p.columnId === colId);
    if (placement) {
      return cardMap.get(placement.cardId);
    }
    return null;
  };

  const unrankedPlacements = placements.filter(p => !p.tierId || !p.columnId);
  const visibleUnranked = unrankedPlacements.slice(0, maxUnranked);
  const extraUnranked = unrankedPlacements.length - maxUnranked;

  const isSharedForEdit =
    ranking.editShareEnabled || (ranking.coOwners && ranking.coOwners.length > 0);

  return (
    <Link to={`/tierlist/${ranking.id}`} className="ranking-card card">
      <div className="ranking-header">
        <h4 className="ranking-title">{ranking.title}</h4>
        <div className="ranking-badges">
          {ranking.isCoOwner && <span className="coowner-badge">{t('home.coOwner')}</span>}
          {!ranking.isCoOwner && isSharedForEdit && (
            <span className="shared-badge">{t('home.shared')}</span>
          )}
        </div>
        <span className="ranking-template">
          {t('home.basedOn')} "{template.title}"{' '}
          {template.owner ? `${t('template.by')} ${template.owner.username}` : ''}
        </span>
        {ranking.templateSnapshot?.snapshotAt && (
          <span className="ranking-revision">
            {t('template.revision')}:{' '}
            {formatDate(ranking.templateSnapshot.snapshotAt, language, clockFormat)}
          </span>
        )}
      </div>

      <div className="ranking-table-preview">
        <div className="preview-grid">
          {sortedCols.length > 1 && (
            <div className="preview-header-row">
              <div className="preview-tier-label" />
              {visibleCols.map((col, i) => (
                <div key={col.id} className="preview-col-header" title={col.name || ''}>
                  {col.name || `${i + 1}`}
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
              {visibleCols.map(col => {
                const card = getCardForCell(tier.id, col.id);
                return (
                  <div key={col.id} className="preview-cell">
                    {card && (
                      <div className="preview-cell-card" title={card.title}>
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.title} />
                        ) : (
                          <span>{card.title[0]}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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

      {visibleUnranked.length > 0 && (
        <div className="ranking-unranked-preview">
          {visibleUnranked.map(placement => {
            const card = cardMap.get(placement.cardId);
            if (!card) return null;
            return (
              <div key={placement.cardId} className="preview-card" title={card.title}>
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.title} />
                ) : (
                  <span>{card.title[0]}</span>
                )}
              </div>
            );
          })}
          {extraUnranked > 0 && (
            <div className="preview-card preview-card-extra">+{extraUnranked}</div>
          )}
        </div>
      )}
    </Link>
  );
}

export function HomePage() {
  const [publicTemplates, setPublicTemplates] = useState<Template[]>([]);
  const [myTemplates, setMyTemplates] = useState<Template[]>([]);
  const [myRankings, setMyRankings] = useState<RankingWithCoOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const { user, login } = useAuthStore();
  const { t, language } = useI18n();
  const { getEffectiveFormat } = useClockFormatStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clockFormat = getEffectiveFormat();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setAuthError(error);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [publicRes] = await Promise.all([api.getPublicTemplates()]);
      setPublicTemplates(publicRes.templates);

      if (user) {
        const [templatesRes, rankingsRes] = await Promise.all([
          api.getMyTemplates(),
          api.getMyFilledTierlists(),
        ]);
        setMyTemplates(templatesRes.templates);
        const ownedWithFlag = rankingsRes.owned.map(r => ({ ...r, isCoOwner: false }));
        const sharedWithFlag = rankingsRes.shared.map(r => ({ ...r, isCoOwner: true }));
        setMyRankings([...ownedWithFlag, ...sharedWithFlag]);
      } else {
        setMyTemplates([]);
        setMyRankings([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function loginWithRedirect() {
    localStorage.setItem('auth_redirect', '/');
    login();
  }

  async function handleStartRanking(template: Template) {
    if (!user) {
      loginWithRedirect();
      return;
    }

    try {
      const { filledTierlist } = await api.createFilledTierlist({
        templateId: template.id,
        title: `${template.title} - ${t('home.rankingBy')} ${user.username}`,
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
      setMyTemplates(prev => [newTemplate, ...prev]);
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
    <div className="container home-page">
      {authError && (
        <div className="auth-error-toast">
          <div className="auth-error-content">
            <span>{t('auth.authFailed')}</span>
            <button className="btn-icon" onClick={() => setAuthError(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      {!user && (
        <section className="hero">
          <h1>{t('home.title')}</h1>
          <p>{t('home.subtitle')}</p>
          <div className="hero-cta">
            <button onClick={login} className="btn btn-discord hero-discord-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              {t('auth.loginWithDiscord')}
            </button>
          </div>
        </section>
      )}

      {user && (
        <section className="my-rankings-section">
          <div className="section-header">
            <h2>{t('nav.myRankings')}</h2>
          </div>
          {myRankings.length === 0 ? (
            <div className="empty-state-inline">
              <p>{t('home.noRankingsYet')}</p>
            </div>
          ) : (
            <div className="rankings-grid">
              {myRankings.map(ranking => (
                <RankingCard
                  key={ranking.id}
                  ranking={ranking}
                  t={t}
                  language={language}
                  clockFormat={clockFormat}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {user && (
        <section className="my-templates-section">
          <div className="section-header">
            <h2>{t('nav.myTemplates')}</h2>
            <Link to="/template/new" className="btn btn-primary btn-sm">
              + {t('home.createNewTemplate')}
            </Link>
          </div>
          {myTemplates.length === 0 ? (
            <div className="empty-state-inline">
              <p>{t('home.noTemplatesYet')}</p>
            </div>
          ) : (
            <div className="templates-grid">
              {myTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onStartRanking={() => handleStartRanking(template)}
                  isLoggedIn={!!user}
                  isOwned
                  t={t}
                  language={language}
                  clockFormat={clockFormat}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="public-templates">
        <h2>{t('home.publicTemplates')}</h2>
        {publicTemplates.length === 0 ? (
          <div className="empty-state">
            <h3>{t('home.noPublicTemplates')}</h3>
            <p>{t('home.beFirstToCreate')}</p>
          </div>
        ) : (
          <div className="templates-grid">
            {publicTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onStartRanking={() => handleStartRanking(template)}
                onCopy={() => handleCopyTemplate(template)}
                isLoggedIn={!!user}
                t={t}
                language={language}
                clockFormat={clockFormat}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
