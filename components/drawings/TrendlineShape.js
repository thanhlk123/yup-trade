'use client';

import React, { useMemo } from 'react';

export default function TrendlineShape({ 
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
  // Compute pixel coordinates from logical time/price
  const { x1, y1, x2, y2, x2_ext, y2_ext } = useMemo(() => {
    if (!chart || !series || !drawing.point1 || !drawing.point2) {
      return { x1: null, y1: null, x2: null, y2: null, x2_ext: null, y2_ext: null };
    }
    try {
      const px1 = timeToCoordinate(drawing.point1.time);
      const py1 = series.priceToCoordinate(drawing.point1.price);
      const px2 = timeToCoordinate(drawing.point2.time);
      const py2 = series.priceToCoordinate(drawing.point2.price);
      
      let px2_ext = px2;
      let py2_ext = py2;

      // Extend to infinity for 'ray'
      if (drawing.type === 'ray' && px1 !== null && py1 !== null && px2 !== null && py2 !== null) {
        const dx = px2 - px1;
        const dy = py2 - py1;
        const len = Math.hypot(dx, dy);
        if (len > 0.1) {
          const scale = 5000 / len; // 5000px ensures it goes off-screen
          px2_ext = px2 + dx * scale;
          py2_ext = py2 + dy * scale;
        }
      }
      
      return { x1: px1, y1: py1, x2: px2, y2: py2, x2_ext: px2_ext, y2_ext: py2_ext };
    } catch (e) {
      return { x1: null, y1: null, x2: null, y2: null, x2_ext: null, y2_ext: null };
    }
  }, [renderTick, chart, series, drawing.point1, drawing.point2, drawing.type]);

  if (x1 === null || y1 === null || x2 === null || y2 === null) {
    return null; // Out of bounds or chart not ready
  }

  const handleInteractionDown = (e, targetType) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect(drawing.id);
    }
    if (targetType === 'handle1') {
      onHandleMouseDown(e, drawing, 1);
    } else if (targetType === 'handle2') {
      onHandleMouseDown(e, drawing, 2);
    } else {
      onLineMouseDown(e, drawing);
    }
  };

  const strokeColor = drawing.color || '#3b82f6';
  const strokeWidth = drawing.thickness || 2;

  return (
    <g>
      {/* Invisible thicker line for easier hit testing/clicking */}
      <line 
        x1={x1} y1={y1} x2={x2_ext} y2={y2_ext}
        stroke="transparent" 
        strokeWidth="15" 
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseDown={(e) => handleInteractionDown(e, 'line')}
        onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }}
      />
      
      {/* Visible Line */}
      <line 
        x1={x1} y1={y1} x2={x2_ext} y2={y2_ext}
        stroke={strokeColor} 
        strokeWidth={strokeWidth} 
        style={{ pointerEvents: 'none', opacity: isSelected ? 1 : 0.8 }} 
      />
      
      {/* Handles (Only visible when selected) */}
      {isSelected && (
        <>
          <circle 
            cx={x1} cy={y1} r="5" 
            fill="#ffffff" stroke={strokeColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle1')}
          />
          <circle 
            cx={x2} cy={y2} r="5" 
            fill="#ffffff" stroke={strokeColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle2')}
          />
        </>
      )}
    </g>
  );
}
