'use client';

import React, { useMemo } from 'react';

export default function PriceLabelShape({ 
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

  const formatPrice = (p) => {
    const num = Number(p);
    if (num > 1000) return num.toFixed(2);
    if (num > 10) return num.toFixed(3);
    return num.toFixed(5);
  };

  const bgColor = drawing.color || '#3b82f6';
  const borderColor = '#ffffff';
  const textColor = '#ffffff';
  const priceText = formatPrice(drawing.point1.price);
  
  const fontSize = 14;
  const paddingX = 12;
  const paddingY = 8;
  const charWidth = 8.5; // Approx width of monospace/numeric character
  const boxWidth = Math.max(priceText.length * charWidth + paddingX * 2, 60);
  const boxHeight = fontSize * 1.2 + paddingY * 2;
  
  const cx = x2;
  const cy = y2;
  const boxX = cx - boxWidth / 2;
  const boxY = cy - boxHeight / 2;
  
  const dx = x1 - cx;
  const dy = y1 - cy;
  const dist = Math.sqrt(dx*dx + dy*dy);
  
  const getCalloutPath = () => {
    const r = 6;
    let p = `M ${boxX+r},${boxY} `; 
    if (dist > 20) {
      let edge = '';
      if (Math.abs(dx) > Math.abs(dy) * (boxWidth/boxHeight)) {
        edge = dx > 0 ? 'right' : 'left';
      } else {
        edge = dy > 0 ? 'bottom' : 'top';
      }
      
      const tailHalfW = 8;
      const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

      if (edge === 'top') {
        const tx = clamp(x1, boxX + r + tailHalfW, boxX + boxWidth - r - tailHalfW);
        p += `L ${tx - tailHalfW},${boxY} L ${x1},${y1} L ${tx + tailHalfW},${boxY} `;
      }
      p += `L ${boxX+boxWidth-r},${boxY} A ${r},${r} 0 0,1 ${boxX+boxWidth},${boxY+r} `; 
      
      if (edge === 'right') {
        const ty = clamp(y1, boxY + r + tailHalfW, boxY + boxHeight - r - tailHalfW);
        p += `L ${boxX+boxWidth},${ty - tailHalfW} L ${x1},${y1} L ${boxX+boxWidth},${ty + tailHalfW} `;
      }
      p += `L ${boxX+boxWidth},${boxY+boxHeight-r} A ${r},${r} 0 0,1 ${boxX+boxWidth-r},${boxY+boxHeight} `;
      
      if (edge === 'bottom') {
        const tx = clamp(x1, boxX + r + tailHalfW, boxX + boxWidth - r - tailHalfW);
        p += `L ${tx + tailHalfW},${boxY+boxHeight} L ${x1},${y1} L ${tx - tailHalfW},${boxY+boxHeight} `;
      }
      p += `L ${boxX+r},${boxY+boxHeight} A ${r},${r} 0 0,1 ${boxX},${boxY+boxHeight-r} `;
      
      if (edge === 'left') {
        const ty = clamp(y1, boxY + r + tailHalfW, boxY + boxHeight - r - tailHalfW);
        p += `L ${boxX},${ty + tailHalfW} L ${x1},${y1} L ${boxX},${ty - tailHalfW} `;
      }
      p += `L ${boxX},${boxY+r} A ${r},${r} 0 0,1 ${boxX+r},${boxY} `;
      
    } else {
      p += `L ${boxX+boxWidth-r},${boxY} A ${r},${r} 0 0,1 ${boxX+boxWidth},${boxY+r} `;
      p += `L ${boxX+boxWidth},${boxY+boxHeight-r} A ${r},${r} 0 0,1 ${boxX+boxWidth-r},${boxY+boxHeight} `;
      p += `L ${boxX+r},${boxY+boxHeight} A ${r},${r} 0 0,1 ${boxX},${boxY+boxHeight-r} `;
      p += `L ${boxX},${boxY+r} A ${r},${r} 0 0,1 ${boxX+r},${boxY} `;
    }
    p += `Z`;
    return p;
  };
  
  const unifiedPath = getCalloutPath();

  const handleInteractionDown = (e, targetType, handleIndex) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect(drawing.id);
    }
    if (targetType === 'handle') {
      if (onHandleMouseDown) onHandleMouseDown(e, drawing, handleIndex);
    } else {
      if (onLineMouseDown) onLineMouseDown(e, drawing);
    }
  };

  return (
    <g>
      {/* 1. The tail and box background layer */}
      <g 
        style={{ cursor: 'move', pointerEvents: 'auto' }}
        onMouseDown={(e) => handleInteractionDown(e, 'line')}
      >
        <path 
          d={unifiedPath} 
          fill={bgColor} 
          fillOpacity={0.85} 
          stroke={borderColor} 
          strokeWidth={1.5} 
          strokeLinejoin="round" 
          style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
        />
        
        {/* Anchor point circle */}
        <circle 
          cx={x1} cy={y1} r={4} 
          fill="transparent" 
          stroke={borderColor} 
          strokeWidth={2} 
          onMouseDown={(e) => handleInteractionDown(e, 'handle', 1)}
        />
      </g>

      {/* 2. Text Layer */}
      <g style={{ pointerEvents: 'none' }}>
        <text
          x={cx}
          y={boxY + paddingY + (fontSize * 0.95)}
          fill={textColor}
          fontSize={fontSize}
          fontWeight="600"
          textAnchor="middle"
          style={{ userSelect: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
        >
          {priceText}
        </text>
      </g>

      {/* 3. Handles (Visible when selected) */}
      {isSelected && (
        <>
          <circle 
            cx={x1} cy={y1} r="5" 
            fill="#ffffff" stroke={borderColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle', 1)}
          />
          <circle 
            cx={cx} cy={cy} r="15" 
            fill="transparent" stroke="transparent"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle', 2)}
          />
        </>
      )}
    </g>
  );
}
