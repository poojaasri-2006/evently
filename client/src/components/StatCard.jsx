import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from './Card';

export const StatCard = ({
  icon: Icon,
  label,
  value,
  subtext,
  accent = 'var(--primary-rose)',
  valueSize = '2rem',
  to,
  onClick,
}) => {
  const inner = (
    <Card
      className="stat-card"
      onClick={onClick}
      style={{
        padding: '1.5rem',
        borderTop: `4px solid ${accent}`,
        cursor: to || onClick ? 'pointer' : 'default',
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 500 }}>
            {label}
          </p>
          <h2
            style={{
              margin: 0,
              color: 'var(--text-primary)',
              fontSize: valueSize,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </h2>
          {subtext && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {subtext}
            </p>
          )}
        </div>
        {Icon && (
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary-rose-tint)',
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={22} strokeWidth={2} />
          </div>
        )}
      </div>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }

  return inner;
};
