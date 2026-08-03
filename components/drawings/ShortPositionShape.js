'use client';

import React, { useMemo } from 'react';

export default function ShortPositionShape({ 
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
  const { x1, yEntry, xRight, yTP, ySL, pEntry, pTP, pSL } = useMemo(() => {
    if (!chart || !series || !drawing.point1 || !drawing.point2 || !drawing.point3) {
      return { x1: null, yEntry: null, xRight: null, yTP: null, ySL: null, pEntry: null, pTP: null, pSL: null };
    }
    try {
      const px1 = timeToCoordinate(drawing.point1.time);
      const pyEntry = series.priceToCoordinate(drawing.point1.price);
      
      const px2 = timeToCoordinate(drawing.point2.time);
      const pyTP = series.priceToCoordinate(drawing.point2.price);
      
      const px3 = timeToCoordinate(drawing.point3.time);
      const pySL = series.priceToCoordinate(drawing.point3.price);
      
      if (px1 === null || pyEntry === null || px2 === null || pyTP === null || px3 === null || pySL === null) {
        return { x1: null, yEntry: null, xRight: null, yTP: null, ySL: null, pEntry: null, pTP: null, pSL: null };
      }

      const rightX = Math.max(px2, px3);

      return { 
        x1: px1, 
        yEntry: pyEntry, 
        xRight: rightX, 
        yTP: pyTP, 
        ySL: pySL,
        pEntry: drawing.point1.price,
        pTP: drawing.point2.price,
        pSL: drawing.point3.price
      };
    } catch (e) {
      return { x1: null, yEntry: null, xRight: null, yTP: null, ySL: null, pEntry: null, pTP: null, pSL: null };
    }
  }, [renderTick, chart, series, drawing.point1, drawing.point2, drawing.point3]);

  if (x1 === null || yEntry === null) {
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

  const left = Math.min(x1, xRight);
  const width = Math.abs(xRight - x1);

  // In Short Position, TP is below entry (higher Y), SL is above entry (lower Y)
  const tpHeight = Math.max(0, yTP - yEntry);
  const slHeight = Math.max(0, yEntry - ySL);

  const risk = pSL - pEntry;
  const reward = pEntry - pTP;
  const rr = risk > 0 ? (reward / risk).toFixed(2) : '0.00';

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#d1d5db' : '#131722';

  return (
    <g>
      {/* SL Box (Top) */}
      <rect 
        x={left} y={yEntry - slHeight} width={width} height={slHeight} 
        fill={isSelected ? "rgba(242, 54, 69, 0.3)" : "rgba(242, 54, 69, 0.2)"} 
        stroke="#f23645" 
        strokeWidth={1} 
        style={{ pointerEvents: 'auto', cursor: 'pointer' }} 
        onMouseDown={(e) => handleInteractionDown(e, 'line')} 
        onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }}
      />
      
      {/* TP Box (Bottom) */}
      <rect 
        x={left} y={yEntry} width={width} height={tpHeight} 
        fill={isSelected ? "rgba(8, 153, 129, 0.3)" : "rgba(8, 153, 129, 0.2)"} 
        stroke="#089981" 
        strokeWidth={1} 
        style={{ pointerEvents: 'auto', cursor: 'pointer' }} 
        onMouseDown={(e) => handleInteractionDown(e, 'line')} 
        onClick={(e) => { e.stopPropagation(); onSelect(drawing.id); }}
      />
      
      {/* Entry Line */}
      <line 
        x1={left} y1={yEntry} x2={left + width} y2={yEntry} 
        stroke={textColor} 
        strokeWidth={1} 
        style={{ pointerEvents: 'none' }} 
      />

      {/* Texts */}
      {width > 60 && (
        <>
          <text x={left + width / 2} y={yEntry - slHeight + 16} fill="#f23645" fontSize="12" fontWeight="500" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {pSL.toFixed(5)}
          </text>
          <text x={left + width / 2} y={yEntry - 6} fill={textColor} fontSize="11" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            Tỷ lệ R/R: {rr}
          </text>
          <text x={left + width / 2} y={yEntry + tpHeight - 6} fill="#089981" fontSize="12" fontWeight="500" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {pTP.toFixed(5)}
          </text>
        </>
      )}

      {/* Handles (Only visible when selected) */}
      {isSelected && (
        <>
          {/* Middle handle (Entry) */}
          <circle 
            cx={left} cy={yEntry} r="5" fill="#ffffff" stroke="#131722" strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle1')}
          />
          {/* Top handle (SL for Short) */}
          <circle 
            cx={left + width / 2} cy={yEntry - slHeight} r="5" fill="#ffffff" stroke="#f23645" strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle3')} // point3 is SL
          />
          {/* Bottom handle (TP for Short) */}
          <circle 
            cx={left + width / 2} cy={yEntry + tpHeight} r="5" fill="#ffffff" stroke="#089981" strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle2')} // point2 is TP
          />
          {/* Right edge handle (Width) */}
          <circle 
            cx={left + width} cy={yEntry} r="5" fill="#ffffff" stroke="#131722" strokeWidth="2"
            style={{ pointerEvents: 'auto', cursor: 'ew-resize' }}
            onMouseDown={(e) => handleInteractionDown(e, 'handle4')}
          />
        </>
      )}
    </g>
  );
}
