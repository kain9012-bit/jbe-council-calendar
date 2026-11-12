import React from 'react';

/**
 * 도의회 회의운영 달력 아이콘 — 남색 머리띠 달력 + 고리 2개 + 날짜 칸 6개.
 * 칸 하나(노랑)는 '오늘', 칸 하나(청록)는 '회의'. animate 면 칸이 차례로 켜짐(로딩 화면).
 * 색은 누리집 틀 네모 표식 4색(#3480cc · #32bdb8 · #fecd20 · #3a457f)에서 가져옴.
 */
export const BrandIcon: React.FC<{ size?: number; animate?: boolean; className?: string }> = ({ size = 32, animate, className = '' }) => {
  const cells = [
    [9, 17], [17, 17], [25, 17],
    [9, 24], [17, 24], [25, 24],
  ];
  const fill = ['#dfe9f6', '#32bdb8', '#dfe9f6', '#dfe9f6', '#fecd20', '#dfe9f6'];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <rect x="3" y="6" width="34" height="31" rx="6" fill="#ffffff" stroke="#3480cc" strokeWidth="2.5" />
      <path d="M3 12a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v1.5H3z" fill="#3a457f" />
      <rect x="11" y="2.5" width="3.5" height="8" rx="1.75" fill="#3480cc" />
      <rect x="25.5" y="2.5" width="3.5" height="8" rx="1.75" fill="#3480cc" />
      {cells.map(([x, y], i) => (
        <rect
          key={i}
          x={x - 3}
          y={y}
          width="6"
          height="5"
          rx="1.4"
          fill={fill[i]}
          className={animate ? 'jbc-cell' : undefined}
          style={animate ? { animationDelay: `${i * 0.18}s` } : undefined}
        />
      ))}
    </svg>
  );
};
