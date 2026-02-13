import type { Tier } from '../types';
import { getContrastColor } from '../utils/color';
import './TierRow.css';

interface TierRowProps {
  tier: Tier;
  children: React.ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TierRow({
  tier,
  children,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
}: TierRowProps) {
  const textColor = getContrastColor(tier.color);
  const hasToolbar =
    onMoveUp !== undefined ||
    onMoveDown !== undefined ||
    onEdit !== undefined ||
    onDelete !== undefined;

  return (
    <>
      <div
        className={`tier-label ${hasToolbar ? 'tier-label-with-toolbar' : ''}`}
        style={{
          backgroundColor: tier.color,
          color: textColor,
        }}
        title={tier.name}
      >
        {hasToolbar && (
          <div className="tier-toolbar">
            {onMoveUp !== undefined && (
              <button
                type="button"
                className="tier-tool-btn"
                onClick={onMoveUp}
                disabled={!canMoveUp}
              >
                <svg width="10" height="6" viewBox="0 0 10 6">
                  <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            )}
            {onEdit && (
              <button type="button" className="tier-tool-btn" onClick={onEdit}>
                <svg
                  width="11"
                  height="11"
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
              <button type="button" className="tier-tool-btn tier-tool-delete" onClick={onDelete}>
                <svg
                  width="11"
                  height="11"
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
            {onMoveDown !== undefined && (
              <button
                type="button"
                className="tier-tool-btn"
                onClick={onMoveDown}
                disabled={!canMoveDown}
              >
                <svg width="10" height="6" viewBox="0 0 10 6">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            )}
          </div>
        )}
        <span className="tier-name">{tier.name}</span>
      </div>
      {children}
    </>
  );
}
