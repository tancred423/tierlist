import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { getDisplayName } from '../types';
import type { FilledTierlist, Pagination as PaginationType, SortOption } from '../types';
import { formatDate } from '../utils/format';
import { sortByOrder } from '../utils/tierlist';
import { getContrastColor } from '../utils/color';
import { Pagination } from '../components/Pagination';
import './MyTierlistsPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }
  return url;
}

interface TierlistWithCoOwner extends FilledTierlist {
  isCoOwner: boolean;
}

interface TierlistCardProps {
  tierlist: TierlistWithCoOwner;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
}

import { hasQuickEdits } from '../utils/tierlist';

function TierlistCard({ tierlist, t, language, clockFormat }: TierlistCardProps) {
  const maxTiers = 5;
  const maxCols = 5;
  const maxUnranked = 5;

  const template = tierlist.template;
  const snapshot = tierlist.templateSnapshot;
  const ds = tierlist.displaySettings;

  const baseTiers = template?.tiers ?? snapshot?.tiers ?? [];
  const baseCols = template?.columns ?? snapshot?.columns ?? [];
  const cards = [
    ...(template?.cards ?? snapshot?.cards ?? []),
    ...(ds?.additionalCards?.map(c => ({ ...c, templateId: '', orderIndex: 99999 })) ?? []),
  ];

  if (baseTiers.length === 0 && baseCols.length === 0) return null;

  const hiddenTierIds = new Set(ds?.hiddenTierIds ?? []);
  const hiddenColIds = new Set(ds?.hiddenColumnIds ?? []);
  const removedCardIds = new Set(ds?.removedCardIds ?? []);

  const rawTiers = [
    ...baseTiers.filter(t => !hiddenTierIds.has(t.id)),
    ...(ds?.additionalTiers?.map(t => ({ ...t, templateId: '' })) ?? []),
  ];
  const rawCols = [
    ...baseCols.filter(c => !hiddenColIds.has(c.id)),
    ...(ds?.additionalColumns?.map(c => ({ ...c, templateId: '', color: null })) ?? []),
  ];

  const tiers = rawTiers.map(tier => {
    const ov = ds?.tierOverrides?.[tier.id];
    return ov ? { ...tier, name: ov.name ?? tier.name, color: ov.color ?? tier.color } : tier;
  });
  const cols = rawCols.map(col => {
    const ov = ds?.columnOverrides?.[col.id];
    return ov ? { ...col, name: ov.name ?? col.name, color: ov.color ?? col.color } : col;
  });

  const filteredCards = cards.filter(c => !removedCardIds.has(c.id));
  const cardMap = new Map(filteredCards.map(c => [c.id, c]));

  const sortedTiers = sortByOrder(tiers, ds?.tierOrder);
  const sortedCols = sortByOrder(cols, ds?.columnOrder);

  const visibleTiers = sortedTiers.slice(0, maxTiers);
  const extraTiers = sortedTiers.length - maxTiers;
  const visibleCols = sortedCols.slice(0, maxCols);
  const extraCols = sortedCols.length - maxCols;

  const placements = tierlist.placements || [];

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
    tierlist.editShareEnabled || (tierlist.coOwners && tierlist.coOwners.length > 0);

  return (
    <Link to={`/tierlist/${tierlist.id}`} className="tierlist-card card">
      <div className="tierlist-header">
        <h4 className="tierlist-title">{tierlist.title}</h4>
        <div className="tierlist-badges">
          {tierlist.isCoOwner && <span className="coowner-badge">{t('home.coOwner')}</span>}
          {!tierlist.isCoOwner && isSharedForEdit && (
            <span className="shared-badge">{t('home.shared')}</span>
          )}
        </div>
        <span className="tierlist-template">
          {template?.title ? (
            <>
              {t('home.basedOn')} "{template.title}"{' '}
              {template.owner ? `${t('template.by')} ${getDisplayName(template.owner)}` : ''}
              {hasQuickEdits(tierlist.displaySettings) && ` ${t('tierlist.edited')}`}
            </>
          ) : (
            <>
              {t('tierlist.basedOnDeleted')}
              {hasQuickEdits(tierlist.displaySettings) && ` ${t('tierlist.edited')}`}
            </>
          )}
        </span>
        {snapshot?.snapshotAt && (
          <span className="tierlist-revision">
            {t('template.revision')}: {formatDate(snapshot.snapshotAt, language, clockFormat)}
          </span>
        )}
      </div>

      <div className="tierlist-table-preview">
        <div className="preview-grid">
          <div className="preview-header-row">
            <div className="preview-tier-label" />
            {visibleCols.map(col => (
              <div
                key={col.id}
                className="preview-col-header"
                title={col.name || ''}
                style={
                  col.color
                    ? { backgroundColor: col.color, color: getContrastColor(col.color) }
                    : undefined
                }
              >
                {col.name || ''}
              </div>
            ))}
            {extraCols > 0 && <div className="preview-extra">+{extraCols}</div>}
          </div>
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
                          <img src={getImageUrl(card.imageUrl)!} alt={card.title} />
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

      <div className="tierlist-unranked-preview">
        {visibleUnranked.map(placement => {
          const card = cardMap.get(placement.cardId);
          if (!card) return null;
          return (
            <div key={placement.cardId} className="preview-card" title={card.title}>
              {card.imageUrl ? (
                <img src={getImageUrl(card.imageUrl)!} alt={card.title} />
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
    </Link>
  );
}

const SORT_OPTIONS: SortOption[] = [
  'updated_desc',
  'created_desc',
  'created_asc',
  'title_asc',
  'title_desc',
];

export function MyTierlistsPage() {
  const [tierlists, setTierlists] = useState<TierlistWithCoOwner[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const { t, language } = useI18n();
  const { getEffectiveFormat } = useClockFormatStore();
  const clockFormat = getEffectiveFormat();
  const { user, setUser } = useAuthStore();
  const [sort, setSort] = useState<SortOption>(user?.tierlistSort || 'updated_desc');
  usePageTitle(t('myTierlists.title'));

  const handleSortChange = useCallback(
    async (newSort: SortOption) => {
      setSort(newSort);
      setPage(1);
      try {
        const { user: updatedUser } = await api.updateProfile({ tierlistSort: newSort });
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
      const result = await api.getMyFilledTierlists({ page, limit: 12, sort });
      setTierlists(result.tierlists);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Failed to load tierlists:', error);
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
    <div className="container my-tierlists-page">
      <div className="page-header">
        <h1>{t('myTierlists.title')}</h1>
        {tierlists.length > 0 && (
          <div className="sort-dropdown">
            <select
              id="tierlist-sort"
              value={sort}
              onChange={e => handleSortChange(e.target.value as SortOption)}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {t(
                    `sort.${opt === 'updated_desc' ? 'updatedDesc' : opt === 'created_desc' ? 'createdDesc' : opt === 'created_asc' ? 'createdAsc' : opt === 'title_asc' ? 'titleAsc' : 'titleDesc'}`,
                  )}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tierlists.length === 0 ? (
        <div className="empty-state">
          <p>{t('myTierlists.empty')}</p>
          <p className="empty-hint">
            {t('myTierlists.hint')} <Link to="/my-templates">{t('myTierlists.hintTemplates')}</Link>{' '}
            {t('myTierlists.hintOr')}{' '}
            <Link to="/public-templates">{t('myTierlists.hintPublic')}</Link>{' '}
            {t('myTierlists.hintEnd')}
          </p>
        </div>
      ) : (
        <>
          <div className="tierlists-grid">
            {tierlists.map(tierlist => (
              <TierlistCard
                key={tierlist.id}
                tierlist={tierlist}
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
