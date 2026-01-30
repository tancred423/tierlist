import { useState, useMemo } from 'react';
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
} from '@dnd-kit/sortable';
import type { Template, CardPlacement, PlacementData } from '../types';
import { useI18n } from '../i18n';
import { TierRow } from './TierRow';
import { DraggableCard, CardOverlay } from './DraggableCard';
import { DroppableCell } from './DroppableCell';
import './TierlistGrid.css';

interface TierlistGridProps {
  template: Template;
  placements: CardPlacement[];
  onPlacementsChange: (placements: PlacementData[]) => void;
  readOnly?: boolean;
}

export function TierlistGrid({
  template,
  placements,
  onPlacementsChange,
  readOnly = false,
}: TierlistGridProps) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const cardMap = useMemo(() => {
    return new Map(template.cards.map(card => [card.id, card]));
  }, [template.cards]);

  const placementMap = useMemo(() => {
    const map = new Map<string, CardPlacement>();
    placements.forEach(p => map.set(p.cardId, p));
    return map;
  }, [placements]);

  const getCellId = (tierId: string, columnId: string) => `cell:${tierId}:${columnId}`;
  const getUnassignedId = () => 'unassigned';

  const getPlacementsForCell = (tierId: string | null, columnId: string | null) => {
    return placements
      .filter(p => p.tierId === tierId && p.columnId === columnId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const unassignedCards = useMemo(() => {
    return placements.filter(p => !p.tierId).sort((a, b) => a.orderIndex - b.orderIndex);
  }, [placements]);

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

  function handleDragStart(event: DragStartEvent) {
    if (readOnly) return;
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    if (readOnly) return;
    const { over } = event;
    setOverId((over?.id as string) || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (readOnly) return;

    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

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

    const currentPlacement = placementMap.get(cardId);
    if (!currentPlacement) return;

    const isSameCell =
      currentPlacement.tierId === targetTierId && currentPlacement.columnId === targetColumnId;

    if (isSameCell && !targetCardId) {
      return;
    }

    let newPlacements = [...placements];

    if (isSameCell && targetCardId && targetCardId !== cardId) {
      const cellCards = newPlacements
        .filter(p => p.tierId === targetTierId && p.columnId === targetColumnId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const draggedIndex = cellCards.findIndex(p => p.cardId === cardId);
      const targetIndex = cellCards.findIndex(p => p.cardId === targetCardId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [removed] = cellCards.splice(draggedIndex, 1);
        cellCards.splice(targetIndex, 0, removed);

        cellCards.forEach((p, index) => {
          const placement = newPlacements.find(np => np.cardId === p.cardId);
          if (placement) {
            placement.orderIndex = index;
          }
        });
      }
    } else {
      newPlacements = newPlacements.map(p => {
        if (p.cardId === cardId) {
          return {
            ...p,
            tierId: targetTierId,
            columnId: targetColumnId,
            orderIndex: 999,
          };
        }
        return p;
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
        const placement = newPlacements.find(np => np.cardId === p.cardId);
        if (placement) {
          placement.orderIndex = index;
        }
      });
    }

    onPlacementsChange(
      newPlacements.map(p => ({
        cardId: p.cardId,
        tierId: p.tierId,
        columnId: p.columnId,
        orderIndex: p.orderIndex,
      })),
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="tierlist-grid-container">
        <div
          className="tierlist-grid"
          style={{
            gridTemplateColumns: `auto repeat(${template.columns.length}, 1fr)`,
          }}
        >
          {(template.columns.length > 1 || template.columns.some(c => c.name)) && (
            <>
              <div className="grid-header-spacer" />
              {template.columns.map(column => (
                <div key={column.id} className="column-header">
                  {column.name || `Column ${column.orderIndex + 1}`}
                </div>
              ))}
            </>
          )}

          {template.tiers.map(tier => (
            <TierRow key={tier.id} tier={tier}>
              {template.columns.map(column => {
                const cellPlacements = getPlacementsForCell(tier.id, column.id);
                const cellId = getCellId(tier.id, column.id);

                return (
                  <DroppableCell
                    key={cellId}
                    id={cellId}
                    isOver={shouldHighlightCell(tier.id, column.id)}
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
                            disabled={readOnly}
                            isActive={activeId === `card-${placement.cardId}`}
                            showDetails
                            compact
                          />
                        );
                      })}
                    </SortableContext>
                  </DroppableCell>
                );
              })}
            </TierRow>
          ))}
        </div>

        <div className="unassigned-section">
          <h3 className="unassigned-header">
            {t('tierlist.unrankedCards')} ({unassignedCards.length})
          </h3>
          <DroppableCell
            id={getUnassignedId()}
            isOver={shouldHighlightUnassigned()}
            className="unassigned-area"
          >
            <SortableContext
              items={unassignedCards.map(p => `card-${p.cardId}`)}
              strategy={rectSortingStrategy}
            >
              {unassignedCards.map(placement => {
                const card = cardMap.get(placement.cardId);
                if (!card) return null;
                return (
                  <DraggableCard
                    key={placement.cardId}
                    card={card}
                    disabled={readOnly}
                    isActive={activeId === `card-${placement.cardId}`}
                    showDetails
                  />
                );
              })}
            </SortableContext>
            {unassignedCards.length === 0 && (
              <div className="empty-unassigned">{t('tierlist.allCardsRanked')}</div>
            )}
          </DroppableCell>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && <CardOverlay card={activeCard} />}
      </DragOverlay>
    </DndContext>
  );
}
