import React from 'react';
import { CARD_DEFINITIONS } from '../../lib/deck.js';

interface CardProps {
  value: number | null;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  revealed?: boolean;
  label?: string;
}

const BADGE_COLORS: Record<string, string> = {
  green: '#4ade80',
  yellow: '#facc15',
  red: '#f87171',
};

const SIZES = {
  sm: { width: 60, height: 84, fontSize: 10, badgeSize: 16 },
  md: { width: 90, height: 126, fontSize: 13, badgeSize: 22 },
  lg: { width: 120, height: 168, fontSize: 16, badgeSize: 28 },
};

export function CardComponent({ value, size = 'md', selected, selectable, onClick, revealed, label }: CardProps) {
  const s = SIZES[size];
  const def = value !== null ? CARD_DEFINITIONS.find((d) => d.value === value) : null;
  const isHidden = value === null;

  const borderStyle = selected
    ? '3px solid #38bdf8'
    : selectable
    ? '2px solid #7dd3fc'
    : '2px solid #cbd5e1';

  const cursor = selectable || onClick ? 'pointer' : 'default';
  const transform = selected ? 'translateY(-8px)' : selectable ? 'translateY(-2px)' : 'none';
  const shadow = selected
    ? '0 8px 24px rgba(56,189,248,0.5)'
    : selectable
    ? '0 4px 12px rgba(125,211,252,0.3)'
    : '0 2px 6px rgba(0,0,0,0.15)';

  return (
    <div
      onClick={onClick}
      style={{
        width: s.width,
        height: s.height,
        borderRadius: 8,
        border: borderStyle,
        cursor,
        transform,
        transition: 'all 0.15s ease',
        boxShadow: shadow,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        background: '#fff',
        userSelect: 'none',
      }}
      title={label}
    >
      {isHidden ? (
        <img src="/cards/card_back.png" alt="card back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : def ? (
        <>
          {/* Card image fills the card */}
          <img
            src={`/cards/${def.imageFile}`}
            alt={def.nameFr}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Value badge */}
          <div style={{
            position: 'absolute',
            top: 4,
            left: 4,
            width: s.badgeSize,
            height: s.badgeSize,
            borderRadius: '50%',
            background: BADGE_COLORS[def.badgeColor],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: s.fontSize - 1,
            color: '#1e293b',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            fontFamily: 'monospace',
          }}>
            {value}
          </div>
        </>
      ) : null}
    </div>
  );
}
