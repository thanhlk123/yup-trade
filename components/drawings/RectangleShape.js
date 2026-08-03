'use client';

import React, { useMemo } from 'react';

export default function RectangleShape({ 
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
  const { x1, y1, x2, y2 } = useMemo(() => {
    if (!chart || !series || !drawing.point1 || !drawing.point2) {
      return { x1: null, y1: null, x2: null, y2: null };
    }
    try {
      const px1 = timeToCoordinate(drawing.point1.time);
      const py1 = series.priceToCoordinate(drawing.point1.price);
      const px2 = timeToCoordinate(drawing.point2.time);
      const py2 = series.priceToCoordinate(drawing.point2.price);
      
      return { x1: px1, y1: py1, x2: px2, y2: py2 };
    } catch (e) {
      return { x1: null, y1: null, x2: null, y2: null };
    }
  }, [renderTick, chart, series, drawing.point1, drawing.point2]);

  if (x1 === null || y1 === null || x2 === null || y2 === null) {
    return null;
  }

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

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  const strokeColor = drawing.color || '#3b82f6';
  const strokeWidth = drawing.thickness || 2;
  
  // Convert hex to rgba for fill
  const getFillColor = (hex, alpha) => {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const fillColor = getFillColor(strokeColor, isSelected ? 0.15 : 0.1);

  return (
    <g>
      {/* Invisible thick border for hit testing (Edges only) */}
      <rect 
        x={left} y={top} width={width} height={height}
        fill="transparent" 
        stroke="transparent" 
        strokeWidth="15" 
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseDown={(e) => handleInteractionDown(e, 'line')}
        onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }}
      />
      
      {/* Visible Rectangle (Semi-transparent fill, pointer-events none so user can pan chart through the center) */}
      <rect 
        x={left} y={top} width={width} height={height}
        fill={fillColor} 
        stroke={strokeColor} 
        strokeWidth={strokeWidth} 
        style={{ pointerEvents: 'none' }} 
      />
      
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
            cx={x2} cy={y1} r="5" fill="#ffffff" stroke={strokeColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle3')}
          />
          <circle 
            cx={x1} cy={y2} r="5" fill="#ffffff" stroke={strokeColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle4')}
          />
        </>
      )}
    </g>
  );
}
