'use client';

import React, { useMemo } from 'react';

export default function ArrowMarkerShape({ 
  drawing, 
  chart, 
  series, 
  isSelected, 
  onSelect,
  onHandleMouseDown,
  onLineMouseDown,
  renderTick,
  timeToCoordinate
}) {
  const { x, y } = useMemo(() => {
    if (!chart || !series || !drawing.point1) {
      return { x: null, y: null };
    }
    try {
      const px = timeToCoordinate(drawing.point1.time);
      const py = series.priceToCoordinate(drawing.point1.price);
      return { x: px, y: py };
    } catch (e) {
      return { x: null, y: null };
    }
  }, [renderTick, chart, series, drawing.point1]);

  if (x === null || y === null) {
    return null;
  }

  const handleInteractionDown = (e, targetType) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect(drawing.id);
    }
    if (targetType === 'handle') {
      onHandleMouseDown(e, drawing, 1);
    } else {
      onLineMouseDown(e, drawing);
    }
  };

  const isUp = drawing.type === 'arrow_up';
  const color = drawing.color || (isUp ? '#10b981' : '#ef4444');
  const size = drawing.thickness ? parseInt(drawing.thickness) * 10 : 24;

  // Arrow up: M12 20V4M5 11L12 4L19 11
  // Arrow down: M12 4V20M5 13L12 20L19 13
  return (
    <g>
      {/* Invisible circle for hit testing */}
      <circle 
        cx={x} cy={y} r={size}
        fill="transparent"
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseDown={(e) => handleInteractionDown(e, 'line')}
        onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }}
      />
      
      {/* Visible Arrow */}
      {isUp ? (
        <svg x={x - size/2} y={y - size/2} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
          <path d="M12 21V3M5 10L12 3L19 10" />
        </svg>
      ) : (
        <svg x={x - size/2} y={y - size/2} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
          <path d="M12 3V21M5 14L12 21L19 14" />
        </svg>
      )}

      {/* Handles (Only visible when selected) */}
      {isSelected && (
        <circle 
          cx={x} cy={y} r="5" 
          fill="#ffffff" stroke={color} strokeWidth="2"
          style={{ pointerEvents: 'auto', cursor: 'move' }}
          onMouseDown={(e) => handleInteractionDown(e, 'handle')}
        />
      )}
    </g>
  );
}
