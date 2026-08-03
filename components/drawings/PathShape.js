'use client';

import React, { useMemo } from 'react';

export default function PathShape({ 
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
  const points = useMemo(() => {
    if (!chart || !series || !drawing.points || drawing.points.length === 0) {
      return [];
    }
    try {
      const mapped = drawing.points.map(p => {
        const x = timeToCoordinate(p.time);
        const y = series.priceToCoordinate(p.price);
        return { x, y, time: p.time, price: p.price };
      }).filter(p => p.x !== null && p.y !== null);
      return mapped;
    } catch (e) {
      return [];
    }
  }, [renderTick, chart, series, drawing.points]);

  if (points.length < 2) {
    return null;
  }

  const handleInteractionDown = (e, targetType, index = null) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect(drawing.id);
    }
    if (targetType === 'handle' && index !== null) {
      onHandleMouseDown(e, drawing, index); // For Path, index can be > 4
    } else {
      onLineMouseDown(e, drawing);
    }
  };

  const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <g>
      {/* Invisible thick line for hit testing */}
      <polyline 
        points={pointsString}
        fill="none"
        stroke="transparent" 
        strokeWidth="20"
        style={{ pointerEvents: 'auto', cursor: 'pointer', strokeLinejoin: 'round', strokeLinecap: 'round' }}
        onMouseDown={(e) => handleInteractionDown(e, 'line')}
        onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }}
      />
      
      {/* Visible Path */}
      <polyline 
        points={pointsString}
        fill="none"
        stroke={drawing.color || '#2962FF'} 
        strokeWidth={drawing.thickness || 2}
        style={{ pointerEvents: 'none', strokeLinejoin: 'round', strokeLinecap: 'round' }}
      />

      {/* Handles (Only visible when selected) */}
      {isSelected && points.map((p, index) => (
        <circle 
          key={index}
          cx={p.x} cy={p.y} r="5" 
          fill="#ffffff" stroke={drawing.color || '#2962FF'} strokeWidth="2"
          style={{ pointerEvents: 'auto', cursor: 'move' }}
          onMouseDown={(e) => handleInteractionDown(e, 'handle', index)}
        />
      ))}
    </g>
  );
}
