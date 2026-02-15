import { getContrastColor } from '../utils/color';
import { getImageUrl } from '../utils/format';
import './PreviewGrid.css';

interface PreviewTier {
  id: string;
  name: string;
  color: string;
}

interface PreviewColumn {
  id: string;
  name: string | null;
  color?: string | null;
}

interface PreviewCardData {
  id: string;
  title: string;
  imageUrl?: string | null;
}

interface CellCardResolver {
  (tierId: string, columnId: string): PreviewCardData | null | undefined;
}

interface PreviewGridProps {
  tiers: PreviewTier[];
  columns: PreviewColumn[];
  extraTiers: number;
  extraCols: number;
  moreLabel: string;
  getCellCard?: CellCardResolver;
}

export function PreviewGrid({
  tiers,
  columns,
  extraTiers,
  extraCols,
  moreLabel,
  getCellCard,
}: PreviewGridProps) {
  return (
    <div className="preview-grid">
      <div className="preview-header-row">
        <div className="preview-tier-label" />
        {columns.map(col => (
          <div
            key={col.id}
            className="preview-col-header"
            title={col.name || undefined}
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
      {tiers.map(tier => (
        <div key={tier.id} className="preview-row">
          <div
            className="preview-tier-label"
            style={{ backgroundColor: tier.color }}
            title={tier.name}
          >
            {tier.name}
          </div>
          {columns.map(col => {
            const card = getCellCard?.(tier.id, col.id);
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
            +{extraTiers} {moreLabel}
          </div>
        </div>
      )}
    </div>
  );
}

interface PreviewCardBarProps {
  cards: PreviewCardData[];
  extraCards: number;
}

export function PreviewCardBar({ cards, extraCards }: PreviewCardBarProps) {
  return (
    <>
      {cards.map(card => (
        <div key={card.id} className="preview-card" title={card.title}>
          {card.imageUrl ? (
            <img src={getImageUrl(card.imageUrl)!} alt={card.title} />
          ) : (
            <span>{card.title[0]}</span>
          )}
        </div>
      ))}
      {extraCards > 0 && <div className="preview-card preview-card-extra">+{extraCards}</div>}
    </>
  );
}
