import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useClockFormatStore } from '../stores/clockFormat';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { getDisplayName, SORT_OPTIONS, SORT_LABEL_KEYS } from '../types';
import type { FilledTierlist, Pagination as PaginationType, SortOption } from '../types';
import { formatDate } from '../utils/format';
import { sortByOrder, hasQuickEdits } from '../utils/tierlist';
import { Pagination } from '../components/Pagination';
import { PreviewGrid, PreviewCardBar } from '../components/PreviewGrid';
import './MyTierlistsPage.css';

interface TierlistWithCoOwner extends FilledTierlist {
  isCoOwner: boolean;
}

interface TierlistCardProps {
  tierlist: TierlistWithCoOwner;
  t: (key: string) => string;
  language: string;
  clockFormat: '12h' | '24h';
}

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
        <PreviewGrid
          tiers={visibleTiers}
          columns={visibleCols}
          extraTiers={extraTiers}
          extraCols={extraCols}
          moreLabel={t('template.more')}
          getCellCard={getCardForCell}
        />
      </div>

      <div className="tierlist-unranked-preview">
        <PreviewCardBar
          cards={visibleUnranked
            .map(p => cardMap.get(p.cardId))
            .filter((c): c is NonNullable<typeof c> => !!c)}
          extraCards={extraUnranked}
        />
      </div>
    </Link>
  );
}

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
                  {t(SORT_LABEL_KEYS[opt])}
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
