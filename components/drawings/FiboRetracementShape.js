'use client';

import React, { useMemo } from 'react';

const FIB_LEVELS = [
  { value: 0, color: '#787b86' },
  { value: 0.236, color: '#f44336' },
  { value: 0.382, color: '#81c784' },
  { value: 0.5, color: '#4caf50' },
  { value: 0.618, color: '#009688' },
  { value: 0.786, color: '#64b5f6' },
  { value: 1, color: '#787b86' },
  { value: 1.618, color: '#2196f3' }
];

export default function FiboRetracementShape({ 
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
  const { x1, y1, x2, y2, p1Price, p2Price } = useMemo(() => {
    if (!chart || !series || !drawing.point1 || !drawing.point2) {
      return { x1: null, y1: null, x2: null, y2: null, p1Price: null, p2Price: null };
    }
    try {
      const px1 = timeToCoordinate(drawing.point1.time);
      const py1 = series.priceToCoordinate(drawing.point1.price);
      const px2 = timeToCoordinate(drawing.point2.time);
      const py2 = series.priceToCoordinate(drawing.point2.price);
      
      return { x1: px1, y1: py1, x2: px2, y2: py2, p1Price: drawing.point1.price, p2Price: drawing.point2.price };
    } catch (e) {
      return { x1: null, y1: null, x2: null, y2: null, p1Price: null, p2Price: null };
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
    if (targetType === 'handle1') {
      onHandleMouseDown(e, drawing, 1);
    } else if (targetType === 'handle2') {
      onHandleMouseDown(e, drawing, 2);
    } else {
      onLineMouseDown(e, drawing);
    }
  };

  const left = Math.min(x1, x2);
  const width = Math.abs(x2 - x1);
  const right = Math.max(x1, x2);

  // Calculate coordinates for all levels
  const levelsData = FIB_LEVELS.map(level => {
    const price = p2Price + (p1Price - p2Price) * level.value;
    let y = series.priceToCoordinate(price);
    // If coordinate calculation fails, fallback to simple interpolation (not perfectly accurate for log scale, but good enough)
    if (y === null) {
      y = y2 + (y1 - y2) * level.value;
    }
    const color = drawing.color || level.color;
    return { ...level, price, y, color };
  });

  return (
    <g>
      {/* Invisible thick area for hit testing */}
      <rect 
        x={left} y={Math.min(...levelsData.map(l => l.y))} 
        width={width} height={Math.max(...levelsData.map(l => l.y)) - Math.min(...levelsData.map(l => l.y))}
        fill="transparent" 
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseDown={(e) => handleInteractionDown(e, 'line')}
        onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }}
      />
      
      {/* Background Fills (between levels) */}
      {levelsData.map((level, i) => {
        if (i === 0) return null;
        const prevLevel = levelsData[i - 1];
        const yTop = Math.min(level.y, prevLevel.y);
        const yBottom = Math.max(level.y, prevLevel.y);
        const h = yBottom - yTop;
        
        // Convert hex to rgba for fill
        const hex = prevLevel.color;
        let fillStyle = 'rgba(120, 123, 134, 0.1)';
        if (hex.startsWith('#') && hex.length >= 7) {
          let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
          fillStyle = `rgba(${r}, ${g}, ${b}, ${isSelected ? 0.2 : 0.1})`;
        }

        return (
          <rect 
            key={`fill-${level.value}`}
            x={left} y={yTop} width={width} height={h}
            fill={fillStyle}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}

      {/* Trendline connecting points */}
      <line 
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={drawing.color || '#787b86'} 
        strokeWidth={1}
        strokeDasharray="4,4"
        style={{ pointerEvents: 'none' }} 
      />

      {/* Horizontal Level Lines and Labels */}
      {levelsData.map(level => (
        <g key={`level-${level.value}`}>
          <line 
            x1={left} y1={level.y} x2={right} y2={level.y}
            stroke={level.color} 
            strokeWidth={drawing.thickness || 1}
            style={{ pointerEvents: 'none' }} 
          />
          <text 
            x={left + 4} y={level.y - 4} 
            fill={level.color} 
            fontSize="11"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {level.value} ({level.price.toFixed(5)})
          </text>
        </g>
      ))}

      {/* Handles (Only visible when selected) */}
      {isSelected && (
        <>
          <circle 
            cx={x1} cy={y1} r="5" 
            fill="#ffffff" stroke={drawing.color || '#2962FF'} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle1')}
          />
          <circle 
            cx={x2} cy={y2} r="5" 
            fill="#ffffff" stroke={drawing.color || '#2962FF'} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle2')}
          />
        </>
      )}
    </g>
  );
}
