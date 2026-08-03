'use client';

import React, { useMemo } from 'react';

export default function ParallelChannelShape({ 
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
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = useMemo(() => {
    if (!chart || !series || !drawing.point1 || !drawing.point2 || !drawing.point3) {
      return { x1: null, y1: null, x2: null, y2: null, x3: null, y3: null, x4: null, y4: null };
    }
    try {
      const px1 = timeToCoordinate(drawing.point1.time);
      const py1 = series.priceToCoordinate(drawing.point1.price);
      const px2 = timeToCoordinate(drawing.point2.time);
      const py2 = series.priceToCoordinate(drawing.point2.price);
      const px3 = timeToCoordinate(drawing.point3.time);
      const py3 = series.priceToCoordinate(drawing.point3.price);
      
      if (px1 === null || py1 === null || px2 === null || py2 === null || px3 === null || py3 === null) {
        return { x1: null, y1: null, x2: null, y2: null, x3: null, y3: null, x4: null, y4: null };
      }

      const dx = px2 - px1;
      const dy = py2 - py1;
      const px4 = px3 + dx;
      const py4 = py3 + dy;
      
      return { x1: px1, y1: py1, x2: px2, y2: py2, x3: px3, y3: py3, x4: px4, y4: py4 };
    } catch (e) {
      return { x1: null, y1: null, x2: null, y2: null, x3: null, y3: null, x4: null, y4: null };
    }
  }, [renderTick, chart, series, drawing.point1, drawing.point2, drawing.point3]);

  if (x1 === null || y1 === null) {
    return null;
  }

  const strokeColor = drawing.color || '#3b82f6';
  const strokeWidth = drawing.thickness || 2;
  
  // Convert hex to rgba for fill
  const getFillColor = (hex, alpha) => {
    if (!hex) return `rgba(59, 130, 246, ${alpha})`;
    if (hex.startsWith('#') && hex.length >= 7) {
      let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(59, 130, 246, ${alpha})`;
  };
  const fillColor = getFillColor(strokeColor, isSelected ? 0.15 : 0.1);

  const handleInteractionDown = (e, targetType) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect(drawing.id);
    }
    if (targetType.startsWith('handle')) {
      const idx = parseInt(targetType.replace('handle', ''));
      onHandleMouseDown(e, drawing, idx);
    } else {
      onLineMouseDown(e, drawing);
    }
  };

  // Middle line coordinates
  const mx1 = (x1 + x3) / 2;
  const my1 = (y1 + y3) / 2;
  const mx2 = (x2 + x4) / 2;
  const my2 = (y2 + y4) / 2;

  return (
    <g>
      {/* Invisible thick lines for hit testing (Top and Bottom edges) */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20" style={{ pointerEvents: 'auto', cursor: 'pointer' }} onMouseDown={(e) => handleInteractionDown(e, 'line')} onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }} />
      <line x1={x3} y1={y3} x2={x4} y2={y4} stroke="transparent" strokeWidth="20" style={{ pointerEvents: 'auto', cursor: 'pointer' }} onMouseDown={(e) => handleInteractionDown(e, 'line')} onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }} />
      
      {/* Fill Area */}
      <polygon 
        points={`${x1},${y1} ${x2},${y2} ${x4},${y4} ${x3},${y3}`}
        fill={fillColor}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Visible Lines */}
      {/* Baseline */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={strokeWidth} style={{ pointerEvents: 'none' }} />
      {/* Parallel line */}
      <line x1={x3} y1={y3} x2={x4} y2={y4} stroke={strokeColor} strokeWidth={strokeWidth} style={{ pointerEvents: 'none' }} />
      {/* Middle dashed line */}
      <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke={strokeColor} strokeWidth={Math.max(1, strokeWidth - 1)} strokeDasharray="5,5" style={{ pointerEvents: 'none', opacity: 0.7 }} />
      
      {/* Handles (Only visible when selected) */}
      {isSelected && (
        <>
          <circle 
            cx={x1} cy={y1} r="5" fill="#ffffff" stroke={strokeColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle1')}
          />
          <circle 
            cx={x2} cy={y2} r="5" fill="#ffffff" stroke={strokeColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle2')}
          />
          <circle 
            cx={x3} cy={y3} r="5" fill="#ffffff" stroke={strokeColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle3')}
          />
        </>
      )}
    </g>
  );
}
