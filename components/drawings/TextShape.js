'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';

export default function TextShape({ 
  drawing, 
  chart, 
  series, 
  isSelected, 
  onSelect,
  onHandleMouseDown,
  onLineMouseDown,
  onTextChange,
  renderTick,
  timeToCoordinate
}) {
  const [isEditing, setIsEditing] = useState(drawing.isNew || false);
  const [textValue, setTextValue] = useState(drawing.text || 'Ghi chú');
  const inputRef = useRef(null);

  const { x1, y1, x2, y2 } = useMemo(() => {
    if (!chart || !series || !drawing.point1 || !drawing.point2) return { x1: null, y1: null, x2: null, y2: null };
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

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }
  }, [isEditing]);

  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

  // TradingView Callout defaults to a solid background with a slightly darker border.
  const bgColor = drawing.color || '#2bb9b7'; 
  const borderColor = '#1e9f9c'; // We use a darker teal for the border as seen in the image
  const textColor = '#ffffff';
  const fontSize = drawing.fontSize || 14;
  const lines = textValue.split('\n');
  
  const charWidth = fontSize * 0.6;
  const maxLineLength = Math.max(...lines.map(l => l.length));
  // Box dimensions
  const paddingX = 14;
  const paddingY = 8;
  const boxWidth = Math.max(maxLineLength * charWidth + paddingX * 2, 60);
  const boxHeight = lines.length * (fontSize * 1.2) + paddingY * 2;
  
  // Calculate center of the badge box (point2)
  const cx = x2;
  const cy = y2;
  
  // Calculate top-left for rect drawing
  const boxX = cx - boxWidth / 2;
  const boxY = cy - boxHeight / 2;
  
  // Vector from Box Center to Anchor
  const dx = x1 - cx;
  const dy = y1 - cy;
  const dist = Math.sqrt(dx*dx + dy*dy);
  
  // Generate unified Callout Path
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

      // Top
      if (edge === 'top') {
        const tx = clamp(x1, boxX + r + tailHalfW, boxX + boxWidth - r - tailHalfW);
        p += `L ${tx - tailHalfW},${boxY} L ${x1},${y1} L ${tx + tailHalfW},${boxY} `;
      }
      p += `L ${boxX+boxWidth-r},${boxY} A ${r},${r} 0 0,1 ${boxX+boxWidth},${boxY+r} `; 
      
      // Right
      if (edge === 'right') {
        const ty = clamp(y1, boxY + r + tailHalfW, boxY + boxHeight - r - tailHalfW);
        p += `L ${boxX+boxWidth},${ty - tailHalfW} L ${x1},${y1} L ${boxX+boxWidth},${ty + tailHalfW} `;
      }
      p += `L ${boxX+boxWidth},${boxY+boxHeight-r} A ${r},${r} 0 0,1 ${boxX+boxWidth-r},${boxY+boxHeight} `;
      
      // Bottom
      if (edge === 'bottom') {
        const tx = clamp(x1, boxX + r + tailHalfW, boxX + boxWidth - r - tailHalfW);
        p += `L ${tx + tailHalfW},${boxY+boxHeight} L ${x1},${y1} L ${tx - tailHalfW},${boxY+boxHeight} `;
      }
      p += `L ${boxX+r},${boxY+boxHeight} A ${r},${r} 0 0,1 ${boxX},${boxY+boxHeight-r} `;
      
      // Left
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

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const finishEditing = () => {
    setIsEditing(false);
    if (onTextChange) {
      onTextChange(drawing.id, textValue);
    }
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      finishEditing();
    }
  };

  return (
    <g onDoubleClick={handleDoubleClick}>
      {/* 1. The tail and box background layer */}
      <g 
        style={{ cursor: 'move', pointerEvents: 'auto' }}
        onMouseDown={(e) => handleInteractionDown(e, 'line')}
      >
        <path 
          d={unifiedPath} 
          fill={bgColor} 
          fillOpacity={0.8} 
          stroke={borderColor} 
          strokeWidth={1.5} 
          strokeLinejoin="round" 
          style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
        />
        
        {/* Anchor point circle (like TradingView blue hollow circle) */}
        {!isEditing && (
          <circle 
            cx={x1} cy={y1} r={4} 
            fill="transparent" 
            stroke={borderColor} 
            strokeWidth={2} 
            onMouseDown={(e) => handleInteractionDown(e, 'handle', 1)}
          />
        )}
      </g>

      {/* 2. Text or Editor Layer */}
      {!isEditing && (
        <g style={{ pointerEvents: 'none' }}>
          {lines.map((line, i) => (
            <text
              key={i}
              x={cx}
              y={boxY + paddingY + (i * fontSize * 1.2) + (fontSize * 0.8)}
              fill={textColor}
              fontSize={fontSize}
              fontWeight="500"
              textAnchor="middle"
              style={{ userSelect: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              {line}
            </text>
          ))}
        </g>
      )}

      {isEditing && (
        <foreignObject x={boxX} y={boxY} width={boxWidth} height={boxHeight}>
          <textarea
            ref={inputRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent', 
              color: textColor,
              border: 'none',
              padding: `${paddingY}px ${paddingX}px`,
              fontSize: `${fontSize}px`,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              fontWeight: 500,
              outline: 'none',
              resize: 'none',
              lineHeight: 1.2,
              textAlign: 'center',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
            onMouseDown={e => e.stopPropagation()}
          />
        </foreignObject>
      )}

      {/* 3. Handles (Visible when selected) */}
      {isSelected && !isEditing && (
        <>
          {/* Anchor Handle */}
          <circle 
            cx={x1} cy={y1} r="5" 
            fill="#ffffff" stroke={borderColor} strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle', 1)}
          />
          {/* Badge Center Handle (Visually Hidden but functionally active) */}
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
