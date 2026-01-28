import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../types';
import './DraggableCard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }
  return url;
}

interface DraggableCardProps {
  card: Card;
  disabled?: boolean;
  isActive?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

export function DraggableCard({
  card,
  disabled,
  isActive,
  showDetails,
  compact,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    disabled,
  });

  const style = disabled
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-card ${isDragging || isActive ? 'is-dragging' : ''} ${showDetails ? 'show-details' : ''} ${compact ? 'compact' : ''} ${disabled ? 'disabled' : ''}`}
      {...(disabled ? {} : { ...attributes, ...listeners })}
      title={card.title}
    >
      {card.imageUrl ? (
        <img src={getImageUrl(card.imageUrl)!} alt={card.title} className="card-image" />
      ) : (
        <div className="card-no-image">
          <span>{card.title.charAt(0).toUpperCase()}</span>
        </div>
      )}
      {showDetails && (
        <div className="card-details">
          <span className="card-title">{card.title}</span>
          {card.description && <span className="card-desc">{card.description}</span>}
        </div>
      )}
      {!showDetails && (
        <div className="card-tooltip">
          <strong>{card.title}</strong>
          {card.description && <p>{card.description}</p>}
        </div>
      )}
    </div>
  );
}

interface CardOverlayProps {
  card: Card;
}

export function CardOverlay({ card }: CardOverlayProps) {
  return (
    <div className="draggable-card card-overlay">
      {card.imageUrl ? (
        <img src={getImageUrl(card.imageUrl)!} alt={card.title} className="card-image" />
      ) : (
        <div className="card-no-image">
          <span>{card.title.charAt(0).toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}
