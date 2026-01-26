import { useDroppable } from '@dnd-kit/core';
import './DroppableCell.css';

interface DroppableCellProps {
  id: string;
  isOver: boolean;
  className?: string;
  children: React.ReactNode;
}

export function DroppableCell({ id, isOver, className = '', children }: DroppableCellProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`droppable-cell ${isOver ? 'is-over' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
