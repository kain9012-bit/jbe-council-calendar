import React from 'react';

/**
 * 도의회 회의운영 달력 아이콘 — 의회 건물(지붕·기둥 4개·기단).
 * 남색 바탕, 흰 건물, 청록 처마, 노란 점. animate 면 기둥이 차례로 켜짐(로딩 화면).
 * 색은 누리집 틀 4색(#3480cc · #32bdb8 · #fecd20 · #3a457f).
 */
export const BrandIcon: React.FC<{ size?: number; animate?: boolean; className?: string }> = ({ size = 32, animate, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
    <rect x="1" y="1" width="38" height="38" rx="9" fill="#3a457f" />
    <path d="M20 7 L33 14 H7 Z" fill="#fff" />
    <rect x="7" y="14" width="26" height="2.4" rx="0.6" fill="#32bdb8" />
    {[9.5, 15.5, 21.5, 27.5].map((x, i) => (
      <rect
        key={x}
        x={x}
        y="17.5"
        width="3"
        height="11"
        rx="0.8"
        fill="#fff"
        className={animate ? 'jbc-cell' : undefined}
        style={animate ? { animationDelay: `${i * 0.2}s` } : undefined}
      />
    ))}
    <rect x="6" y="29.5" width="28" height="3" rx="1" fill="#fff" />
    <circle cx="20" cy="11.3" r="1.8" fill="#fecd20" />
  </svg>
);
