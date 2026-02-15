import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type {
  Template,
  CardPlacement,
  PlacementData,
  Tier,
  Column,
  Card,
  DisplaySettings,
} from '../types';
import { useI18n } from '../i18n';
import { getContrastColor } from '../utils/color';
import { sortByOrder } from '../utils/tierlist';
import { TierRow } from './TierRow';
import { DraggableCard, CardOverlay } from './DraggableCard';
import { DroppableCell } from './DroppableCell';
import { CardEditorModal } from './CardEditorModal';
import './TierlistGrid.css';

export interface TierlistGridProps {
  template: Template;
  placements: CardPlacement[];
  onPlacementsChange?: (placements: PlacementData[]) => void;

  cellsBlocked?: boolean;
  gridOverlay?: React.ReactNode;

  onTierEdit?: (tierId: string, updates: { name: string; color: string }) => void;
  onTierAdd?: () => void;
  onTierDelete?: (tierId: string) => void;
  onTierReorder?: (tierIds: string[]) => void;

  onColumnEdit?: (colId: string, updates: { name: string; color?: string }) => void;
  onColumnAdd?: () => void;
  onColumnDelete?: (colId: string) => void;
  onColumnReorder?: (colIds: string[]) => void;

  onCardAdd?: (data: { title: string; imageUrl?: string; description?: string }) => void;
  onCardEdit?: (
    cardId: string,
    data: { title: string; imageUrl?: string; description?: string },
  ) => void;
  onCardDelete?: (cardId: string) => void;
  onCardReorder?: (cardIds: string[]) => void;

  displaySettings?: DisplaySettings | null;
  onDisplaySettingsChange?: (settings: DisplaySettings) => void;

  readOnly?: boolean;
}

function applyTierOverrides(
  tiers: Tier[],
  overrides?: Record<string, { name?: string; color?: string }>,
): Tier[] {
  if (!overrides) return tiers;
  return tiers.map(tier => {
    const ov = overrides[tier.id];
    if (!ov) return tier;
    return { ...tier, name: ov.name ?? tier.name, color: ov.color ?? tier.color };
  });
}

function applyColumnOverrides(
  columns: Column[],
  overrides?: Record<string, { name?: string; color?: string }>,
): Column[] {
  if (!overrides) return columns;
  return columns.map(col => {
    const ov = overrides[col.id];
    if (!ov) return col;
    return {
      ...col,
      name: ov.name ?? col.name,
      color: ov.color !== undefined ? ov.color || null : col.color,
    };
  });
}

export function TierlistGrid({
  template,
  placements,
  onPlacementsChange,
  cellsBlocked = false,
  gridOverlay,
  onTierEdit,
  onTierAdd,
  onTierDelete,
  onTierReorder,
  onColumnEdit,
  onColumnAdd,
  onColumnDelete,
  onColumnReorder,
  onCardAdd,
  onCardEdit,
  onCardDelete,
  onCardReorder,
  displaySettings,
  onDisplaySettingsChange,
  readOnly = false,
}: TierlistGridProps) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const settingsRef = useRef(displaySettings);
  settingsRef.current = displaySettings;

  const computeTiers = useCallback((tiers: Tier[], ds?: DisplaySettings | null) => {
    let result = [...tiers];
    if (ds?.additionalTiers) {
      result = [...result, ...ds.additionalTiers.map(t => ({ ...t, templateId: '' }))];
    }
    if (ds?.hiddenTierIds?.length) {
      const hidden = new Set(ds.hiddenTierIds);
      result = result.filter(t => !hidden.has(t.id));
    }
    return sortByOrder(applyTierOverrides(result, ds?.tierOverrides), ds?.tierOrder);
  }, []);

  const computeColumns = useCallback((columns: Column[], ds?: DisplaySettings | null) => {
    let result = [...columns];
    if (ds?.additionalColumns) {
      result = [
        ...result,
        ...ds.additionalColumns.map(c => ({ ...c, templateId: '', color: null })),
      ];
    }
    if (ds?.hiddenColumnIds?.length) {
      const hidden = new Set(ds.hiddenColumnIds);
      result = result.filter(c => !hidden.has(c.id));
    }
    return sortByOrder(applyColumnOverrides(result, ds?.columnOverrides), ds?.columnOrder);
  }, []);

  const [sortedTiers, setSortedTiers] = useState(() =>
    computeTiers(template.tiers, displaySettings),
  );
  const [sortedColumns, setSortedColumns] = useState(() =>
    computeColumns(template.columns, displaySettings),
  );

  useEffect(() => {
    setSortedTiers(computeTiers(template.tiers, displaySettings));
    setSortedColumns(computeColumns(template.columns, displaySettings));
  }, [template.tiers, template.columns, displaySettings, computeTiers, computeColumns]);

  const emitSettings = useCallback(
    (patch: Partial<DisplaySettings>) => {
      if (!onDisplaySettingsChange) return;
      onDisplaySettingsChange({ ...settingsRef.current, ...patch });
    },
    [onDisplaySettingsChange],
  );

  const moveTier = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sortedTiers.length) return;
      setSortedTiers(prev => {
        const next = [...prev];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        const newOrder = next.map(ti => ti.id);
        if (onTierReorder) {
          onTierReorder(newOrder);
        } else {
          emitSettings({ tierOrder: newOrder, columnOrder: sortedColumns.map(c => c.id) });
        }
        return next;
      });
    },
    [sortedTiers.length, sortedColumns, emitSettings, onTierReorder],
  );

  const moveColumn = useCallback(
    (index: number, direction: 'left' | 'right') => {
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sortedColumns.length) return;
      setSortedColumns(prev => {
        const next = [...prev];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        const newOrder = next.map(c => c.id);
        if (onColumnReorder) {
          onColumnReorder(newOrder);
        } else {
          emitSettings({ tierOrder: sortedTiers.map(ti => ti.id), columnOrder: newOrder });
        }
        return next;
      });
    },
    [sortedColumns.length, sortedTiers, emitSettings, onColumnReorder],
  );

  const [editingTier, setEditingTier] = useState<{
    tier: Tier;
    name: string;
    color: string;
    anchorRect?: DOMRect;
  } | null>(null);
  const [editingColumn, setEditingColumn] = useState<{
    column: Column;
    name: string;
    color: string;
    anchorRect?: DOMRect;
  } | null>(null);
  const [editingCard, setEditingCard] = useState<{
    cardId: string;
    title: string;
    imageUrl: string;
    description: string;
  } | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardImage, setNewCardImage] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');
  const [cardModalCard, setCardModalCard] = useState<Card | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const editPopoverRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [overlayRect, setOverlayRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const useRichCardEditor = !!onCardAdd || (!!onDisplaySettingsChange && !!onPlacementsChange);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editPopoverRef.current && !editPopoverRef.current.contains(event.target as Node)) {
        setEditingTier(null);
        setEditingColumn(null);
      }
    }
    if (editingTier || editingColumn) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingTier, editingColumn]);

  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!cellsBlocked || !gridRef.current || !containerRef.current) {
      setOverlayRect(null);
      return;
    }
    function measure() {
      const grid = gridRef.current;
      const container = containerRef.current;
      if (!grid || !container) return;

      const firstCell = grid.querySelector('.droppable-cell') as HTMLElement | null;
      const addTierCell = grid.querySelector('.add-tier-cell') as HTMLElement | null;
      const addColSpacer = grid.querySelector('.grid-add-col-spacer') as HTMLElement | null;

      if (!firstCell) return;

      const top = firstCell.offsetTop;
      const left = firstCell.offsetLeft;

      let rightEdge = grid.offsetLeft + grid.scrollWidth;
      if (addColSpacer) {
        rightEdge = addColSpacer.offsetLeft;
      }

      let bottomEdge = grid.offsetTop + grid.offsetHeight;
      if (addTierCell) {
        bottomEdge = addTierCell.offsetTop;
      }

      setOverlayRect({
        top,
        left,
        width: Math.max(rightEdge - left, 0),
        height: Math.max(bottomEdge - top, 0),
      });
    }

    measure();
    const gridEl = gridRef.current!;
    const resizeObs = new ResizeObserver(measure);
    resizeObs.observe(gridEl);
    gridEl.querySelectorAll('.tier-label').forEach(el => resizeObs.observe(el));

    const mutationObs = new MutationObserver(measure);
    mutationObs.observe(gridEl, { subtree: true, childList: true, characterData: true });

    return () => {
      resizeObs.disconnect();
      mutationObs.disconnect();
    };
  }, [cellsBlocked, sortedTiers.length, sortedColumns.length]);

  function handleTierEditSave() {
    if (!editingTier) return;
    if (onTierEdit) {
      onTierEdit(editingTier.tier.id, { name: editingTier.name, color: editingTier.color });
      setSortedTiers(prev =>
        prev.map(ti =>
          ti.id === editingTier.tier.id
            ? { ...ti, name: editingTier.name, color: editingTier.color }
            : ti,
        ),
      );
    } else if (onDisplaySettingsChange) {
      const tierOverrides = {
        ...settingsRef.current?.tierOverrides,
        [editingTier.tier.id]: { name: editingTier.name, color: editingTier.color },
      };
      emitSettings({ tierOverrides });
      setSortedTiers(prev =>
        prev.map(ti =>
          ti.id === editingTier.tier.id
            ? { ...ti, name: editingTier.name, color: editingTier.color }
            : ti,
        ),
      );
    }
    setEditingTier(null);
  }

  function handleColumnEditSave() {
    if (!editingColumn) return;
    if (onColumnEdit) {
      onColumnEdit(editingColumn.column.id, {
        name: editingColumn.name,
        color: editingColumn.color || undefined,
      });
      setSortedColumns(prev =>
        prev.map(c =>
          c.id === editingColumn.column.id
            ? { ...c, name: editingColumn.name || null, color: editingColumn.color || null }
            : c,
        ),
      );
    } else if (onDisplaySettingsChange) {
      const columnOverrides = {
        ...settingsRef.current?.columnOverrides,
        [editingColumn.column.id]: {
          name: editingColumn.name,
          color: editingColumn.color || undefined,
        },
      };
      emitSettings({ columnOverrides });
      setSortedColumns(prev =>
        prev.map(c =>
          c.id === editingColumn.column.id
            ? { ...c, name: editingColumn.name || null, color: editingColumn.color || null }
            : c,
        ),
      );
    }
    setEditingColumn(null);
  }

  function handleCardEditSave() {
    if (!editingCard || !onCardEdit) return;
    onCardEdit(editingCard.cardId, {
      title: editingCard.title,
      imageUrl: editingCard.imageUrl || undefined,
      description: editingCard.description || undefined,
    });
    setEditingCard(null);
  }

  function handleAddCard() {
    if (!newCardTitle.trim()) return;

    if (onCardAdd) {
      onCardAdd({
        title: newCardTitle.trim(),
        imageUrl: newCardImage.trim() || undefined,
        description: newCardDesc.trim() || undefined,
      });
    } else if (onDisplaySettingsChange && onPlacementsChange) {
      const cardId = `qe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newCard = {
        id: cardId,
        title: newCardTitle.trim(),
        imageUrl: newCardImage.trim() || null,
        description: newCardDesc.trim() || null,
      };
      const additionalCards = [...(settingsRef.current?.additionalCards ?? []), newCard];
      emitSettings({ additionalCards });

      const newPlacement = {
        cardId,
        tierId: null as string | null,
        columnId: null as string | null,
        orderIndex: placements.length,
      };
      onPlacementsChange([
        ...placements.map(p => ({
          cardId: p.cardId,
          tierId: p.tierId,
          columnId: p.columnId,
          orderIndex: p.orderIndex,
        })),
        newPlacement,
      ]);
    }

    setNewCardTitle('');
    setNewCardImage('');
    setNewCardDesc('');
    setShowAddCard(false);
  }

  const customCollisionDetection: CollisionDetection = args => {
    const pointerCollisions = pointerWithin(args);
    const rectCollisions = rectIntersection(args);

    const allCollisions = [...pointerCollisions];
    rectCollisions.forEach(rc => {
      if (!allCollisions.find(c => c.id === rc.id)) {
        allCollisions.push(rc);
      }
    });

    if (allCollisions.length === 0) {
      return [];
    }

    const cardCollisions = allCollisions.filter(c => (c.id as string).startsWith('card-'));
    const containerCollisions = allCollisions.filter(c => {
      const id = c.id as string;
      return id === 'unassigned' || id.startsWith('cell:');
    });

    const pointerCardCollision = pointerCollisions.find(c => (c.id as string).startsWith('card-'));
    if (pointerCardCollision) {
      return [pointerCardCollision];
    }

    const pointerContainerCollision = pointerCollisions.find(c => {
      const id = c.id as string;
      return id === 'unassigned' || id.startsWith('cell:');
    });
    if (pointerContainerCollision) {
      return [pointerContainerCollision];
    }

    if (containerCollisions.length > 0) {
      return [containerCollisions[0]];
    }

    if (cardCollisions.length > 0) {
      return [cardCollisions[0]];
    }

    return allCollisions.length > 0 ? [allCollisions[0]] : [];
  };

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 350, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const isTouchDevice =
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const sensors = useSensors(isTouchDevice ? touchSensor : pointerSensor, keyboardSensor);

  const cardMap = useMemo(() => {
    const map = new Map(template.cards.map(card => [card.id, card]));
    if (displaySettings?.additionalCards) {
      for (const ac of displaySettings.additionalCards) {
        map.set(ac.id, {
          ...ac,
          templateId: '',
          orderIndex: 99999,
          imageUrl: ac.imageUrl ?? null,
          description: ac.description ?? null,
        });
      }
    }
    if (displaySettings?.cardOverrides) {
      for (const [cardId, overrides] of Object.entries(displaySettings.cardOverrides)) {
        const existing = map.get(cardId);
        if (existing) {
          map.set(cardId, {
            ...existing,
            title: overrides.title ?? existing.title,
            imageUrl:
              overrides.imageUrl !== undefined ? overrides.imageUrl || null : existing.imageUrl,
            description:
              overrides.description !== undefined
                ? overrides.description || null
                : existing.description,
          });
        }
      }
    }
    if (displaySettings?.removedCardIds?.length) {
      for (const cardId of displaySettings.removedCardIds) {
        map.delete(cardId);
      }
    }
    return map;
  }, [
    template.cards,
    displaySettings?.additionalCards,
    displaySettings?.cardOverrides,
    displaySettings?.removedCardIds,
  ]);

  const [localPlacements, setLocalPlacements] = useState<CardPlacement[]>(() => [...placements]);
  const justReorderedPlacementsRef = useRef(false);

  useEffect(() => {
    if (!activeId) {
      if (justReorderedPlacementsRef.current) {
        justReorderedPlacementsRef.current = false;
        return;
      }
      setLocalPlacements([...placements]);
    }
  }, [placements, activeId]);

  const placementMap = useMemo(() => {
    const map = new Map<string, CardPlacement>();
    localPlacements.forEach(p => map.set(p.cardId, p));
    return map;
  }, [localPlacements]);

  const getCellId = (tierId: string, columnId: string) => `cell:${tierId}:${columnId}`;
  const getUnassignedId = () => 'unassigned';

  const getPlacementsForCell = (tierId: string | null, columnId: string | null) => {
    return localPlacements
      .filter(p => p.tierId === tierId && p.columnId === columnId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const removedCardSet = useMemo(
    () => new Set(displaySettings?.removedCardIds || []),
    [displaySettings?.removedCardIds],
  );

  const unassignedFromProps = useMemo(() => {
    return placements
      .filter(p => !p.tierId && !removedCardSet.has(p.cardId))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [placements, removedCardSet]);

  const [localUnrankedIds, setLocalUnrankedIds] = useState<string[]>(() =>
    unassignedFromProps.map(p => p.cardId),
  );

  const justReorderedRef = useRef(false);

  useEffect(() => {
    if (!activeId) {
      if (justReorderedRef.current) {
        justReorderedRef.current = false;
        return;
      }
      setLocalUnrankedIds(unassignedFromProps.map(p => p.cardId));
    }
  }, [unassignedFromProps, activeId]);

  const unassignedCards = useMemo(() => {
    const placementByCard = new Map(unassignedFromProps.map(p => [p.cardId, p]));
    return localUnrankedIds
      .map(cid => placementByCard.get(cid))
      .filter((p): p is CardPlacement => p !== undefined);
  }, [localUnrankedIds, unassignedFromProps]);

  const getCardIdFromDragId = (dragId: string) => {
    if (dragId.startsWith('card-')) {
      return dragId.replace('card-', '');
    }
    return dragId;
  };

  const activeCard = activeId ? cardMap.get(getCardIdFromDragId(activeId)) : null;
  const activePlacement = activeId ? placementMap.get(getCardIdFromDragId(activeId)) : null;

  const getTargetFromOverId = (
    id: string | null,
  ): { tierId: string | null; columnId: string | null } => {
    if (!id)
      return { tierId: undefined as unknown as null, columnId: undefined as unknown as null };

    if (id === 'unassigned') {
      return { tierId: null, columnId: null };
    }
    if (id.startsWith('cell:')) {
      const parts = id.split(':');
      return { tierId: parts[1], columnId: parts[2] };
    }
    if (id.startsWith('card-')) {
      const cardId = id.replace('card-', '');
      const placement = placementMap.get(cardId);
      if (placement) {
        return { tierId: placement.tierId, columnId: placement.columnId };
      }
    }
    return { tierId: undefined as unknown as null, columnId: undefined as unknown as null };
  };

  const overTarget = getTargetFromOverId(overId);

  const shouldHighlightCell = (cellTierId: string, cellColumnId: string): boolean => {
    if (!activeId || !overId) return false;
    if (overTarget.tierId === undefined) return false;

    const isOverThisCell = overTarget.tierId === cellTierId && overTarget.columnId === cellColumnId;
    if (!isOverThisCell) return false;

    if (!activePlacement) return true;
    const isDraggingFromThisCell =
      activePlacement.tierId === cellTierId && activePlacement.columnId === cellColumnId;

    return !isDraggingFromThisCell;
  };

  const shouldHighlightUnassigned = (): boolean => {
    if (!activeId || !overId) return false;
    if (overTarget.tierId === undefined) return false;

    const isOverUnassigned = overTarget.tierId === null && overTarget.columnId === null;
    if (!isOverUnassigned) return false;

    if (!activePlacement) return true;
    const isDraggingFromUnassigned = activePlacement.tierId === null;

    return !isDraggingFromUnassigned;
  };

  const isDndDisabled = readOnly || (!onPlacementsChange && !onCardReorder);

  function handleDragStart(event: DragStartEvent) {
    if (isDndDisabled) return;
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    if (isDndDisabled) return;
    const { active, over } = event;
    setOverId((over?.id as string) || null);

    if (!over) return;

    const activeCardId = getCardIdFromDragId(active.id as string);
    const overIdStr = over.id as string;

    const activeInUnranked = localUnrankedIds.includes(activeCardId);
    if (activeInUnranked) {
      if (overIdStr.startsWith('card-')) {
        const overCardId = overIdStr.replace('card-', '');
        const overInUnranked = localUnrankedIds.includes(overCardId);
        if (overInUnranked && overCardId !== activeCardId) {
          setLocalUnrankedIds(prev => {
            const oldIndex = prev.indexOf(activeCardId);
            const newIndex = prev.indexOf(overCardId);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
          });
        }
      } else if (overIdStr === 'unassigned') {
        setLocalUnrankedIds(prev => {
          const idx = prev.indexOf(activeCardId);
          if (idx === -1 || idx === prev.length - 1) return prev;
          const next = [...prev];
          next.splice(idx, 1);
          next.push(activeCardId);
          return next;
        });
      }
      return;
    }

    const activePlace = localPlacements.find(p => p.cardId === activeCardId);
    if (!activePlace || activePlace.tierId === null) return;

    if (overIdStr.startsWith('card-')) {
      const overCardId = overIdStr.replace('card-', '');
      const overPlace = localPlacements.find(p => p.cardId === overCardId);
      if (
        overPlace &&
        overPlace.tierId === activePlace.tierId &&
        overPlace.columnId === activePlace.columnId &&
        overCardId !== activeCardId
      ) {
        setLocalPlacements(prev => {
          const cellCards = prev
            .filter(p => p.tierId === activePlace.tierId && p.columnId === activePlace.columnId)
            .sort((a, b) => a.orderIndex - b.orderIndex);
          const oldIdx = cellCards.findIndex(p => p.cardId === activeCardId);
          const newIdx = cellCards.findIndex(p => p.cardId === overCardId);
          if (oldIdx === -1 || newIdx === -1) return prev;
          const reordered = arrayMove(cellCards, oldIdx, newIdx);
          const orderMap = new Map(reordered.map((p, i) => [p.cardId, i]));
          return prev.map(p => {
            const newOrder = orderMap.get(p.cardId);
            return newOrder !== undefined ? { ...p, orderIndex: newOrder } : p;
          });
        });
      }
    } else if (overIdStr.startsWith('cell:')) {
      const parts = overIdStr.split(':');
      const cellTierId = parts[1];
      const cellColumnId = parts[2];
      if (cellTierId === activePlace.tierId && cellColumnId === activePlace.columnId) {
        setLocalPlacements(prev => {
          const cellCards = prev
            .filter(p => p.tierId === cellTierId && p.columnId === cellColumnId)
            .sort((a, b) => a.orderIndex - b.orderIndex);
          const idx = cellCards.findIndex(p => p.cardId === activeCardId);
          if (idx === -1 || idx === cellCards.length - 1) return prev;
          const reordered = [...cellCards];
          const [removed] = reordered.splice(idx, 1);
          reordered.push(removed);
          const orderMap = new Map(reordered.map((p, i) => [p.cardId, i]));
          return prev.map(p => {
            const newOrder = orderMap.get(p.cardId);
            return newOrder !== undefined ? { ...p, orderIndex: newOrder } : p;
          });
        });
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (isDndDisabled) return;

    const { active, over } = event;
    const finalUnrankedIds = [...localUnrankedIds];
    const finalPlacements = [...localPlacements];
    setActiveId(null);
    setOverId(null);

    if (!over) return;
    if (!onPlacementsChange && !onCardReorder) return;

    const dragId = active.id as string;
    const cardId = getCardIdFromDragId(dragId);
    const overIdStr = over.id as string;

    let targetTierId: string | null = null;
    let targetColumnId: string | null = null;
    let targetCardId: string | null = null;

    if (overIdStr === 'unassigned') {
      targetTierId = null;
      targetColumnId = null;
    } else if (overIdStr.startsWith('cell:')) {
      const parts = overIdStr.split(':');
      targetTierId = parts[1];
      targetColumnId = parts[2];
    } else if (overIdStr.startsWith('card-')) {
      targetCardId = overIdStr.replace('card-', '');
      const targetPlacement = placementMap.get(targetCardId);
      if (targetPlacement) {
        targetTierId = targetPlacement.tierId;
        targetColumnId = targetPlacement.columnId;
      }
    }

    if (cellsBlocked && targetTierId !== null) {
      return;
    }

    const currentPlacement = placementMap.get(cardId);
    if (!currentPlacement) return;

    const isSameCell =
      currentPlacement.tierId === targetTierId && currentPlacement.columnId === targetColumnId;
    const isUnrankedReorder = isSameCell && targetTierId === null;

    if (isUnrankedReorder) {
      if (onCardReorder) {
        justReorderedRef.current = true;
        onCardReorder(finalUnrankedIds);
      } else if (onPlacementsChange) {
        const newPlacements = placements.map(p => {
          const idx = finalUnrankedIds.indexOf(p.cardId);
          if (idx !== -1) {
            return { ...p, orderIndex: idx };
          }
          return p;
        });
        onPlacementsChange(
          newPlacements.map(p => ({
            cardId: p.cardId,
            tierId: p.tierId,
            columnId: p.columnId,
            orderIndex: p.orderIndex,
          })),
        );
      }
      return;
    }

    if (isSameCell) {
      justReorderedPlacementsRef.current = true;
      if (onPlacementsChange) {
        onPlacementsChange(
          finalPlacements.map(p => ({
            cardId: p.cardId,
            tierId: p.tierId,
            columnId: p.columnId,
            orderIndex: p.orderIndex,
          })),
        );
      }
      return;
    }

    const newPlacements = finalPlacements.map(p => {
      if (p.cardId === cardId) {
        return {
          ...p,
          tierId: targetTierId,
          columnId: targetColumnId,
          orderIndex: 999,
        };
      }
      return { ...p };
    });

    const cellCards = newPlacements
      .filter(p => p.tierId === targetTierId && p.columnId === targetColumnId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    if (targetCardId) {
      const targetIndex = cellCards.findIndex(p => p.cardId === targetCardId);
      const draggedIndex = cellCards.findIndex(p => p.cardId === cardId);
      if (targetIndex !== -1 && draggedIndex !== -1) {
        const [removed] = cellCards.splice(draggedIndex, 1);
        cellCards.splice(targetIndex, 0, removed);
      }
    }

    cellCards.forEach((p, index) => {
      p.orderIndex = index;
    });

    setLocalPlacements(newPlacements);
    justReorderedPlacementsRef.current = true;
    if (onPlacementsChange) {
      onPlacementsChange(
        newPlacements.map(p => ({
          cardId: p.cardId,
          tierId: p.tierId,
          columnId: p.columnId,
          orderIndex: p.orderIndex,
        })),
      );
    }
  }

  const showTierArrows =
    !readOnly && sortedTiers.length > 1 && (!!onTierReorder || !!onDisplaySettingsChange);
  const showColumnArrows =
    !readOnly && sortedColumns.length > 1 && (!!onColumnReorder || !!onDisplaySettingsChange);
  const showTierEditBtn = !readOnly && (!!onTierEdit || !!onDisplaySettingsChange);
  const showColumnEditBtn = !readOnly && (!!onColumnEdit || !!onDisplaySettingsChange);
  const canAddCard =
    !readOnly && (!!onCardAdd || (!!onDisplaySettingsChange && !!onPlacementsChange));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="tierlist-grid-container" ref={containerRef}>
        <div
          ref={gridRef}
          className="tierlist-grid"
          style={{
            gridTemplateColumns: `auto repeat(${sortedColumns.length}, 1fr)${onColumnAdd ? ' auto' : ''}`,
          }}
        >
          {(sortedColumns.length > 1 ||
            sortedColumns.some(c => c.name) ||
            onColumnAdd ||
            showColumnEditBtn) && (
            <>
              <div className="grid-header-spacer" />
              {sortedColumns.map((column, colIndex) => {
                const colTextColor = column.color ? getContrastColor(column.color) : undefined;
                return (
                  <div
                    key={column.id}
                    className={`column-header ${showColumnArrows || showColumnEditBtn ? 'column-header-editable' : ''}`}
                    style={{
                      position: 'relative',
                      backgroundColor: column.color || undefined,
                      color: colTextColor,
                    }}
                  >
                    {showColumnArrows && (
                      <button
                        type="button"
                        className="col-move-btn"
                        onClick={() => moveColumn(colIndex, 'left')}
                        disabled={colIndex === 0}
                        title={t('tierlist.moveColumnLeft')}
                      >
                        <svg width="6" height="10" viewBox="0 0 6 10">
                          <path
                            d="M5 1L1 5L5 9"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                          />
                        </svg>
                      </button>
                    )}
                    <span className="column-header-name">{column.name || ''}</span>
                    {showColumnEditBtn && (
                      <button
                        type="button"
                        className="col-edit-btn"
                        onClick={e =>
                          setEditingColumn({
                            column,
                            name: column.name || '',
                            color: column.color || '',
                            anchorRect: e.currentTarget.getBoundingClientRect(),
                          })
                        }
                        title={t('tierlist.editColumn')}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                        </svg>
                      </button>
                    )}
                    {onColumnDelete && sortedColumns.length > 1 && (
                      <button
                        type="button"
                        className="col-delete-btn"
                        onClick={() => onColumnDelete(column.id)}
                        title={t('common.delete')}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                          <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                        </svg>
                      </button>
                    )}
                    {showColumnArrows && (
                      <button
                        type="button"
                        className="col-move-btn"
                        onClick={() => moveColumn(colIndex, 'right')}
                        disabled={colIndex === sortedColumns.length - 1}
                        title={t('tierlist.moveColumnRight')}
                      >
                        <svg width="6" height="10" viewBox="0 0 6 10">
                          <path
                            d="M1 1L5 5L1 9"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              {onColumnAdd && (
                <div className="column-header column-header-add">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm add-col-btn"
                    onClick={onColumnAdd}
                  >
                    +
                  </button>
                </div>
              )}
            </>
          )}

          {sortedTiers.map((tier, tierIndex) => (
            <TierRow
              key={tier.id}
              tier={tier}
              onMoveUp={showTierArrows ? () => moveTier(tierIndex, 'up') : undefined}
              onMoveDown={showTierArrows ? () => moveTier(tierIndex, 'down') : undefined}
              canMoveUp={tierIndex > 0}
              canMoveDown={tierIndex < sortedTiers.length - 1}
              onEdit={
                showTierEditBtn
                  ? (anchorRect: DOMRect) =>
                      setEditingTier({ tier, name: tier.name, color: tier.color || '', anchorRect })
                  : undefined
              }
              onDelete={
                onTierDelete && sortedTiers.length > 1 ? () => onTierDelete(tier.id) : undefined
              }
            >
              {sortedColumns.map(column => {
                const cellPlacements = getPlacementsForCell(tier.id, column.id);
                const cellId = getCellId(tier.id, column.id);

                return (
                  <DroppableCell
                    key={cellId}
                    id={cellId}
                    isOver={shouldHighlightCell(tier.id, column.id)}
                    blocked={cellsBlocked}
                  >
                    <SortableContext
                      items={cellPlacements.map(p => `card-${p.cardId}`)}
                      strategy={rectSortingStrategy}
                    >
                      {cellPlacements.map(placement => {
                        const card = cardMap.get(placement.cardId);
                        if (!card) return null;
                        return (
                          <DraggableCard
                            key={placement.cardId}
                            card={card}
                            disabled={isDndDisabled}
                            isActive={activeId === `card-${placement.cardId}`}
                            showDetails
                            compact
                            onEdit={
                              onCardEdit
                                ? () => {
                                    if (useRichCardEditor) {
                                      setCardModalCard(card);
                                      setShowCardModal(true);
                                    } else {
                                      setEditingCard({
                                        cardId: card.id,
                                        title: card.title,
                                        imageUrl: card.imageUrl || '',
                                        description: card.description || '',
                                      });
                                    }
                                  }
                                : undefined
                            }
                            onDelete={onCardDelete ? () => onCardDelete(card.id) : undefined}
                          />
                        );
                      })}
                    </SortableContext>
                  </DroppableCell>
                );
              })}
              {onColumnAdd && <div className="grid-add-col-spacer" />}
            </TierRow>
          ))}

          {onTierAdd && (
            <>
              <div className="add-tier-cell">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm add-tier-btn"
                  onClick={onTierAdd}
                >
                  +
                </button>
              </div>
              {sortedColumns.map(col => (
                <div key={`add-tier-${col.id}`} className="add-tier-spacer" />
              ))}
              {onColumnAdd && <div className="add-tier-spacer" />}
            </>
          )}
        </div>
        {cellsBlocked && gridOverlay && (
          <div
            className="grid-overlay grid-overlay-scoped"
            style={
              overlayRect
                ? {
                    top: overlayRect.top,
                    left: overlayRect.left,
                    width: overlayRect.width,
                    height: overlayRect.height,
                  }
                : undefined
            }
          >
            {gridOverlay}
          </div>
        )}
      </div>

      {editingTier && (
        <div className="edit-popover-overlay" onClick={() => setEditingTier(null)}>
          <div
            className="edit-popover edit-popover-tier"
            ref={editPopoverRef}
            onClick={e => e.stopPropagation()}
            style={
              editingTier.anchorRect
                ? {
                    position: 'fixed',
                    top: editingTier.anchorRect.bottom + 4,
                    left: editingTier.anchorRect.left,
                  }
                : undefined
            }
          >
            <div className="edit-popover-row">
              <input
                type="text"
                className="edit-popover-input"
                value={editingTier.name}
                onChange={e => setEditingTier({ ...editingTier, name: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleTierEditSave();
                  if (e.key === 'Escape') setEditingTier(null);
                }}
                autoFocus
                placeholder={t('template.tierName')}
              />
              {editingTier.color ? (
                <>
                  <input
                    type="color"
                    className="edit-popover-color"
                    value={editingTier.color}
                    onChange={e => setEditingTier({ ...editingTier, color: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm remove-color-btn"
                    onClick={() => setEditingTier({ ...editingTier, color: '' })}
                    title={t('tierlist.removeColor')}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm add-color-btn"
                  onClick={() => setEditingTier({ ...editingTier, color: '#ff7f7f' })}
                >
                  {t('tierlist.addColor')}
                </button>
              )}
            </div>
            <div className="edit-popover-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingTier(null)}
              >
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleTierEditSave}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingColumn && (
        <div className="edit-popover-overlay" onClick={() => setEditingColumn(null)}>
          <div
            className="edit-popover edit-popover-column"
            ref={editPopoverRef}
            onClick={e => e.stopPropagation()}
            style={
              editingColumn.anchorRect
                ? {
                    position: 'fixed',
                    top: editingColumn.anchorRect.bottom + 4,
                    right: Math.max(8, window.innerWidth - editingColumn.anchorRect.right),
                  }
                : undefined
            }
          >
            <div className="edit-popover-row">
              <input
                type="text"
                className="edit-popover-input"
                value={editingColumn.name}
                onChange={e => setEditingColumn({ ...editingColumn, name: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleColumnEditSave();
                  if (e.key === 'Escape') setEditingColumn(null);
                }}
                autoFocus
                placeholder={t('template.columnName')}
              />
              {editingColumn.color ? (
                <>
                  <input
                    type="color"
                    className="edit-popover-color"
                    value={editingColumn.color}
                    onChange={e => setEditingColumn({ ...editingColumn, color: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm remove-color-btn"
                    onClick={() => setEditingColumn({ ...editingColumn, color: '' })}
                    title={t('tierlist.removeColor')}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm add-color-btn"
                  onClick={() => setEditingColumn({ ...editingColumn, color: '#3b3f45' })}
                >
                  {t('tierlist.addColor')}
                </button>
              )}
            </div>
            <div className="edit-popover-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingColumn(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleColumnEditSave}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="unassigned-section">
        <div className="unassigned-header-row">
          <span className="unassigned-header">
            {t('tierlist.unrankedCards')} ({unassignedCards.length})
          </span>
          {canAddCard && (
            <button
              type="button"
              className="btn btn-secondary btn-sm add-card-btn"
              onClick={() => {
                if (useRichCardEditor) {
                  setCardModalCard(null);
                  setShowCardModal(true);
                } else {
                  setShowAddCard(true);
                }
              }}
            >
              + {t('tierlist.addNewCard')}
            </button>
          )}
        </div>
        <DroppableCell
          id={getUnassignedId()}
          isOver={shouldHighlightUnassigned()}
          className="unassigned-area"
        >
          <SortableContext
            items={localUnrankedIds.map(cid => `card-${cid}`)}
            strategy={rectSortingStrategy}
          >
            {unassignedCards.map(placement => {
              const card = cardMap.get(placement.cardId);
              if (!card) return null;
              return (
                <DraggableCard
                  key={placement.cardId}
                  card={card}
                  disabled={isDndDisabled}
                  isActive={activeId === `card-${placement.cardId}`}
                  showDetails
                  compact
                  onEdit={
                    onCardEdit
                      ? () => {
                          if (useRichCardEditor) {
                            setCardModalCard(card);
                            setShowCardModal(true);
                          } else {
                            setEditingCard({
                              cardId: card.id,
                              title: card.title,
                              imageUrl: card.imageUrl || '',
                              description: card.description || '',
                            });
                          }
                        }
                      : undefined
                  }
                  onDelete={onCardDelete ? () => onCardDelete(card.id) : undefined}
                />
              );
            })}
          </SortableContext>
          {unassignedCards.length === 0 && (
            <div className="empty-unassigned">{t('tierlist.allCardsRanked')}</div>
          )}
        </DroppableCell>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && <CardOverlay card={activeCard} />}
      </DragOverlay>

      {showCardModal && (
        <CardEditorModal
          card={cardModalCard}
          templateId={template.id}
          onClose={() => {
            setShowCardModal(false);
            setCardModalCard(null);
          }}
          onSave={async data => {
            if (cardModalCard && onCardEdit) {
              onCardEdit(cardModalCard.id, data);
            } else if (!cardModalCard && onCardAdd) {
              onCardAdd(data);
            } else if (!cardModalCard && onDisplaySettingsChange && onPlacementsChange) {
              const cardId = `qe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const newCard = {
                id: cardId,
                title: data.title.trim(),
                imageUrl: data.imageUrl || null,
                description: data.description || null,
              };
              const additionalCards = [...(settingsRef.current?.additionalCards ?? []), newCard];
              emitSettings({ additionalCards });
              onPlacementsChange([
                ...placements.map(p => ({
                  cardId: p.cardId,
                  tierId: p.tierId,
                  columnId: p.columnId,
                  orderIndex: p.orderIndex,
                })),
                {
                  cardId,
                  tierId: null as string | null,
                  columnId: null as string | null,
                  orderIndex: placements.length,
                },
              ]);
            }
            setShowCardModal(false);
            setCardModalCard(null);
          }}
        />
      )}

      {showAddCard && (
        <div className="modal-overlay" onClick={() => setShowAddCard(false)}>
          <div className="modal add-card-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('tierlist.addNewCard')}</h2>
              <button onClick={() => setShowAddCard(false)} className="btn btn-icon">
                ×
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleAddCard();
              }}
            >
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('card.title')} *</label>
                  <input
                    type="text"
                    value={newCardTitle}
                    onChange={e => setNewCardTitle(e.target.value)}
                    className="form-input"
                    placeholder={t('card.title')}
                    maxLength={25}
                    required
                    autoFocus
                  />
                  <span className="char-counter">{newCardTitle.length}/25</span>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('card.image')}</label>
                  <input
                    type="text"
                    value={newCardImage}
                    onChange={e => setNewCardImage(e.target.value)}
                    className="form-input"
                    placeholder={t('card.imageUrlPlaceholder')}
                    maxLength={2000}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('card.description')}</label>
                  <input
                    type="text"
                    value={newCardDesc}
                    onChange={e => setNewCardDesc(e.target.value)}
                    className="form-input"
                    placeholder={t('card.descriptionPlaceholder')}
                    maxLength={40}
                  />
                  <span className="char-counter">{newCardDesc.length}/40</span>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAddCard(false)}
                  className="btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newCardTitle.trim()}>
                  {t('tierlist.addNewCard')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCard && onCardEdit && (
        <div className="modal-overlay" onClick={() => setEditingCard(null)}>
          <div className="modal add-card-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('card.edit')}</h2>
              <button onClick={() => setEditingCard(null)} className="btn btn-icon">
                ×
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleCardEditSave();
              }}
            >
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('card.title')} *</label>
                  <input
                    type="text"
                    value={editingCard.title}
                    onChange={e => setEditingCard({ ...editingCard, title: e.target.value })}
                    className="form-input"
                    placeholder={t('card.title')}
                    maxLength={25}
                    required
                    autoFocus
                  />
                  <span className="char-counter">{editingCard.title.length}/25</span>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('card.image')}</label>
                  <input
                    type="text"
                    value={editingCard.imageUrl}
                    onChange={e => setEditingCard({ ...editingCard, imageUrl: e.target.value })}
                    className="form-input"
                    placeholder={t('card.imageUrlPlaceholder')}
                    maxLength={2000}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('card.description')}</label>
                  <input
                    type="text"
                    value={editingCard.description}
                    onChange={e => setEditingCard({ ...editingCard, description: e.target.value })}
                    className="form-input"
                    placeholder={t('card.descriptionPlaceholder')}
                    maxLength={40}
                  />
                  <span className="char-counter">{editingCard.description.length}/40</span>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!editingCard.title.trim()}
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DndContext>
  );
}
