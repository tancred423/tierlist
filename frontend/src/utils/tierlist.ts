import type { DisplaySettings, Template, FilledTierlist } from '../types';

export function hasQuickEdits(ds?: DisplaySettings | null): boolean {
  if (!ds) return false;
  return !!(
    (ds.tierOverrides && Object.keys(ds.tierOverrides).length > 0) ||
    (ds.columnOverrides && Object.keys(ds.columnOverrides).length > 0) ||
    (ds.additionalCards && ds.additionalCards.length > 0) ||
    (ds.tierOrder && ds.tierOrder.length > 0) ||
    (ds.columnOrder && ds.columnOrder.length > 0) ||
    (ds.additionalTiers && ds.additionalTiers.length > 0) ||
    (ds.hiddenTierIds && ds.hiddenTierIds.length > 0) ||
    (ds.additionalColumns && ds.additionalColumns.length > 0) ||
    (ds.hiddenColumnIds && ds.hiddenColumnIds.length > 0) ||
    (ds.removedCardIds && ds.removedCardIds.length > 0) ||
    (ds.cardOverrides && Object.keys(ds.cardOverrides).length > 0)
  );
}

export function buildEffectiveTemplate(tierlist: FilledTierlist): Template {
  if (tierlist.template) return tierlist.template;
  return {
    id: tierlist.templateId ?? 'deleted',
    ownerId: '',
    title: tierlist.title,
    description: null,
    isPublic: false,
    shareToken: null,
    createdAt: '',
    updatedAt: '',
    tiers: tierlist.templateSnapshot?.tiers.map(tier => ({ ...tier, templateId: '' })) ?? [],
    columns:
      tierlist.templateSnapshot?.columns.map(col => ({
        ...col,
        templateId: '',
        color: col.color ?? null,
      })) ?? [],
    cards: tierlist.templateSnapshot?.cards.map(card => ({ ...card, templateId: '' })) ?? [],
  };
}

export function sortByOrder<T extends { id: string; orderIndex: number }>(
  items: T[],
  order?: string[],
): T[] {
  if (!order || order.length === 0) {
    return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  }
  const orderMap = new Map(order.map((id, idx) => [id, idx]));
  return [...items].sort((a, b) => {
    const aIdx = orderMap.get(a.id) ?? a.orderIndex + 10000;
    const bIdx = orderMap.get(b.id) ?? b.orderIndex + 10000;
    return aIdx - bIdx;
  });
}
