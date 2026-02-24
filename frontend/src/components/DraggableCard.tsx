import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../types';
import { getImageUrl } from '../utils/format';
import './DraggableCard.css';

interface DraggableCardProps {
  card: Card;
  disabled?: boolean;
  isActive?: boolean;
  showDetails?: boolean;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const PREVIEW_WIDTH = 200;
const PREVIEW_GAP = 8;
const VIEWPORT_MARGIN = 8;

export function DraggableCard({
  card,
  disabled,
  isActive,
  showDetails,
  compact,
  onEdit,
  onDelete,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    disabled,
  });

  const cardElRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const descRef = useRef<HTMLSpanElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPos, setPreviewPos] = useState<{
    style: React.CSSProperties;
    direction: 'above' | 'below';
  } | null>(null);

  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      cardElRef.current = el;
    },
    [setNodeRef],
  );

  useEffect(() => {
    function measure(el: HTMLSpanElement | null) {
      if (!el) return;
      const staticEl = el.querySelector('.card-text-static') as HTMLElement | null;
      if (!staticEl) return;
      const isOverflowing = staticEl.scrollWidth > staticEl.clientWidth + 1;
      if (isOverflowing) {
        const speed = 30;
        const duration = staticEl.scrollWidth / speed;
        el.dataset.overflows = '';
        el.style.setProperty('--marquee-duration', `${duration}s`);
      } else {
        delete el.dataset.overflows;
        el.style.removeProperty('--marquee-duration');
      }
    }
    measure(titleRef.current);
    measure(descRef.current);
  }, [card.title, card.description]);

  useEffect(() => {
    if (isDragging || isActive) {
      setShowPreview(false);
      setPreviewPos(null);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    }
  }, [isDragging, isActive]);

  const computePreviewPosition = useCallback(() => {
    if (!cardElRef.current) return;
    const rect = cardElRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceAbove > spaceBelow && spaceAbove > 100;

    let left = rect.left + rect.width / 2 - PREVIEW_WIDTH / 2;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - PREVIEW_WIDTH - VIEWPORT_MARGIN),
    );

    if (showAbove) {
      setPreviewPos({
        direction: 'above',
        style: {
          position: 'fixed',
          bottom: `${window.innerHeight - rect.top + PREVIEW_GAP}px`,
          left: `${left}px`,
          width: `${PREVIEW_WIDTH}px`,
          maxHeight: `${Math.max(spaceAbove - PREVIEW_GAP - VIEWPORT_MARGIN, 120)}px`,
        },
      });
    } else {
      setPreviewPos({
        direction: 'below',
        style: {
          position: 'fixed',
          top: `${rect.bottom + PREVIEW_GAP}px`,
          left: `${left}px`,
          width: `${PREVIEW_WIDTH}px`,
          maxHeight: `${Math.max(spaceBelow - PREVIEW_GAP - VIEWPORT_MARGIN, 120)}px`,
        },
      });
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!card.imageUrl || isDragging || isActive) return;
    hoverTimerRef.current = setTimeout(() => {
      computePreviewPosition();
      setShowPreview(true);
    }, 1500);
  }, [card.imageUrl, isDragging, isActive, computePreviewPosition]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowPreview(false);
    setPreviewPos(null);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const style = disabled
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  return (
    <div
      ref={combinedRef}
      style={style}
      className={`draggable-card ${isDragging || isActive ? 'is-dragging' : ''} ${showDetails ? 'show-details' : ''} ${compact ? 'compact' : ''} ${disabled ? 'disabled' : ''}`}
      {...(disabled ? {} : { ...attributes, ...listeners })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
          <span className="card-title" ref={titleRef}>
            <span className="card-text-static">{card.title}</span>
            <span className="card-text-track" aria-hidden="true">
              <span>{card.title}</span>
              <span>{card.title}</span>
            </span>
          </span>
          {card.description && (
            <span className="card-desc" ref={descRef}>
              <span className="card-text-static">{card.description}</span>
              <span className="card-text-track" aria-hidden="true">
                <span>{card.description}</span>
                <span>{card.description}</span>
              </span>
            </span>
          )}
        </div>
      )}
      {(onEdit || onDelete) && (
        <div className="card-hover-actions">
          {onEdit && (
            <button
              type="button"
              className="card-action-btn card-edit-action"
              onClick={e => {
                e.stopPropagation();
                onEdit();
              }}
              onPointerDown={e => e.stopPropagation()}
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
          {onDelete && (
            <button
              type="button"
              className="card-action-btn card-delete-action"
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              onPointerDown={e => e.stopPropagation()}
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
        </div>
      )}
      {showPreview &&
        card.imageUrl &&
        previewPos &&
        createPortal(
          <div
            className={`card-image-preview preview-${previewPos.direction}`}
            style={previewPos.style}
          >
            <img src={getImageUrl(card.imageUrl)!} alt={card.title} />
            <span className="card-image-preview-title">{card.title}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}

interface CardOverlayProps {
  card: Card;
}

export function CardOverlay({ card }: CardOverlayProps) {
  return (
    <div className="draggable-card show-details compact card-overlay">
      {card.imageUrl ? (
        <img src={getImageUrl(card.imageUrl)!} alt={card.title} className="card-image" />
      ) : (
        <div className="card-no-image">
          <span>{card.title.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="card-details">
        <span className="card-title">
          <span className="card-text-static">{card.title}</span>
        </span>
      </div>
    </div>
  );
}
