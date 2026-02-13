import { useDroppable } from '@dnd-kit/core';
import './DroppableCell.css';

interface DroppableCellProps {
  id: string;
  isOver: boolean;
  className?: string;
  children: React.ReactNode;
  blocked?: boolean;
}

export function DroppableCell({
  id,
  isOver,
  className = '',
  children,
  blocked,
}: DroppableCellProps) {
  const { setNodeRef } = useDroppable({ id, disabled: blocked });

  return (
    <div
      ref={setNodeRef}
      className={`droppable-cell ${isOver && !blocked ? 'is-over' : ''} ${blocked ? 'blocked' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
