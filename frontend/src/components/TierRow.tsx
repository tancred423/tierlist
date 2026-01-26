import type { Tier } from '../types';
import './TierRow.css';

interface TierRowProps {
  tier: Tier;
  children: React.ReactNode;
}

export function TierRow({ tier, children }: TierRowProps) {
  const textColor = getContrastColor(tier.color);

  return (
    <>
      <div 
        className="tier-label"
        style={{ 
          backgroundColor: tier.color,
          color: textColor,
        }}
        title={tier.name}
      >
        <span className="tier-name">{tier.name}</span>
      </div>
      {children}
    </>
  );
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
