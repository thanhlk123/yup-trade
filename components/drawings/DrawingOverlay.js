'use client';

import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import TrendlineShape from './TrendlineShape';
import RectangleShape from './RectangleShape';
import ParallelChannelShape from './ParallelChannelShape';
import FiboRetracementShape from './FiboRetracementShape';
import FiboExtensionShape from './FiboExtensionShape';
import LongPositionShape from './LongPositionShape';
import ShortPositionShape from './ShortPositionShape';
import ArrowMarkerShape from './ArrowMarkerShape';
import PriceLabelShape from './PriceLabelShape';
import TextShape from './TextShape';
import PathShape from './PathShape';
import DrawingSettings from './DrawingSettings';

const DrawingOverlay = forwardRef(({ 
  chartContainerRef,
  chart, 
  series, 
  activeTool, 
  setActiveTool, 
  tradeId,
  initialDrawingsData,
  chartData
}, ref) => {
  const overlayRef = useRef(null);
  const isLoadedRef = useRef(false);
  const [drawings, setDrawings] = useState([]);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  
  // interactionState: { type: 'IDLE' | 'DRAWING_NEW' | 'DRAGGING_HANDLE' | 'DRAGGING_BODY', ...data }
  const [interactionState, setInteractionState] = useState({ type: 'IDLE' });
  
  const [viewUpdate, setViewUpdate] = useState(0);
  const safeTimeCache = useRef({});

  useImperativeHandle(ref, () => ({
    saveDrawingsToBackend: async () => {
      if (tradeId) {
        try {
          // Sync to localStorage
          if (drawings.length > 0) {
            localStorage.setItem(`tv_drawings_v2_${tradeId}`, JSON.stringify(drawings));
          } else {
            localStorage.removeItem(`tv_drawings_v2_${tradeId}`);
          }
          // Sync to backend
          const drawings_data = drawings.length > 0 ? JSON.stringify(drawings) : null;
          await fetch('/api/trades', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: tradeId,
              drawings_data
            })
          });
          window.dispatchEvent(new CustomEvent('tv_drawings_updated', {
            detail: { tradeId, drawings_data }
          }));
          return true;
        } catch (e) {
          console.error('Manual save drawings error:', e);
          return false;
        }
      }
      return false;
    }
  }));

  useEffect(() => {
    safeTimeCache.current = {};
  }, [chartData]);

  const safeTimeToCoordinate = useCallback((time) => {
    if (!chart) return null;
    let x = chart.timeScale().timeToCoordinate(time);
    if (x !== null) return x;

    if (!chartData || chartData.length === 0) return null;
    
    if (safeTimeCache.current[time] !== undefined) {
      return chart.timeScale().timeToCoordinate(safeTimeCache.current[time]);
    }
    
    // Find closest time
    let low = 0;
    let high = chartData.length - 1;
    let closest = chartData[0].time;
    let minDiff = Math.abs(time - closest);
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midTime = chartData[mid].time;
      const diff = Math.abs(time - midTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = midTime;
      }
      if (midTime < time) {
        low = mid + 1;
      } else if (midTime > time) {
        high = mid - 1;
      } else {
        break;
      }
    }
    safeTimeCache.current[time] = closest;
    return chart.timeScale().timeToCoordinate(closest);
  }, [chart, chartData]);

  // Sync with lightweight-charts pan/zoom
  useEffect(() => {
    if (!chart) return;
    const forceUpdate = () => setViewUpdate(v => v + 1);
    
    chart.timeScale().subscribeVisibleTimeRangeChange(forceUpdate);
    chart.timeScale().subscribeVisibleLogicalRangeChange(forceUpdate);
    chart.subscribeCrosshairMove(forceUpdate);
    
    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(forceUpdate);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(forceUpdate);
      chart.unsubscribeCrosshairMove(forceUpdate);
    };
  }, [chart]);

  // Handle deselect when clicking empty chart space
  useEffect(() => {
    if (!chart) return;
    const onChartClick = () => {
      if (activeTool === 'cursor') {
        setSelectedDrawingId(null);
      }
    };
    chart.subscribeClick(onChartClick);
    return () => chart.unsubscribeClick(onChartClick);
  }, [chart, activeTool]);

  // Load / Save
  useEffect(() => {
    isLoadedRef.current = false;
    if (tradeId) {
      const stored = localStorage.getItem(`tv_drawings_v2_${tradeId}`);
      if (stored) {
        try {
          setDrawings(JSON.parse(stored));
        } catch (e) {
          setDrawings([]);
        }
      } else if (initialDrawingsData) {
        try {
          setDrawings(typeof initialDrawingsData === 'string' ? JSON.parse(initialDrawingsData) : initialDrawingsData);
        } catch (e) {
          setDrawings([]);
        }
      } else {
        setDrawings([]);
      }
      // Wait for React to process the state update before allowing saves
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 0);
    } else {
      setDrawings([]);
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 0);
    }
  }, [tradeId, initialDrawingsData]);

  useEffect(() => {
    if (tradeId && isLoadedRef.current) {
      if (drawings.length > 0) {
        localStorage.setItem(`tv_drawings_v2_${tradeId}`, JSON.stringify(drawings));
      } else {
        localStorage.removeItem(`tv_drawings_v2_${tradeId}`);
      }
    }
  }, [drawings, tradeId]);

  useEffect(() => {
    const handleClearEvent = () => {
      setDrawings([]);
      setCurrentDrawing(null);
      setSelectedDrawingId(null);
      if (tradeId) {
        localStorage.removeItem(`tv_drawings_v2_${tradeId}`);
        fetch('/api/trades', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: tradeId, drawings_data: null })
        }).then(() => {
          window.dispatchEvent(new CustomEvent('tv_drawings_updated', {
            detail: { tradeId, drawings_data: null }
          }));
        }).catch(err => console.error(err));
      }
    };
    window.addEventListener('tv_clear_drawings', handleClearEvent);
    return () => window.removeEventListener('tv_clear_drawings', handleClearEvent);
  }, [tradeId]);

  // Delete key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        if (window.confirm("Bạn có chắc chắn muốn xóa bản vẽ này?")) {
          setDrawings(prev => {
            const newDrawings = prev.filter(d => d.id !== selectedDrawingId);
            
            if (tradeId) {
              if (newDrawings.length > 0) {
                localStorage.setItem(`tv_drawings_v2_${tradeId}`, JSON.stringify(newDrawings));
              } else {
                localStorage.removeItem(`tv_drawings_v2_${tradeId}`);
              }

              const drawings_data = newDrawings.length > 0 ? JSON.stringify(newDrawings) : null;
              fetch('/api/trades', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: tradeId,
                  drawings_data
                })
              }).then(() => {
                window.dispatchEvent(new CustomEvent('tv_drawings_updated', {
                  detail: { tradeId, drawings_data }
                }));
              }).catch(err => console.error(err));
            }
            return newDrawings;
          });
          setSelectedDrawingId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, tradeId]);

  // Lock chart scrolling when using tools
  useEffect(() => {
    if (!chart) return;
    if (activeTool !== 'cursor' || interactionState.type !== 'IDLE') {
      chart.applyOptions({
        handleScroll: { mouseWheel: true, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        handleScale: { axisPressedMouseMove: false, mouseWheel: true, pinch: false },
      });
    } else {
      chart.applyOptions({
        handleScroll: true,
        handleScale: true,
      });
    }
  }, [chart, activeTool, interactionState.type]);

  const getLogicalCoords = useCallback((e) => {
    if (!chart || !series || !chartContainerRef.current) return null;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    return { time, price, x, y };
  }, [chart, series, chartContainerRef]);

  // Start Drawing new shape on background click
  const handleStartDrawing = (e) => {
    const coords = getLogicalCoords(e);
    if (!coords || !coords.time || coords.price === null) return;
    
    if (activeTool === 'long_position' || activeTool === 'short_position') {
      const newId = Date.now().toString();
      const py = series.priceToCoordinate(coords.price);
      
      const tpOffset = activeTool === 'long_position' ? -100 : 100; // negative py is UP (higher price)
      const slOffset = activeTool === 'long_position' ? 50 : -50;
      
      const tpPrice = series.coordinateToPrice(py + tpOffset) || (coords.price * (activeTool === 'long_position' ? 1.01 : 0.99));
      const slPrice = series.coordinateToPrice(py + slOffset) || (coords.price * (activeTool === 'long_position' ? 0.995 : 1.005));
      
      const timeScale = chart.timeScale();
      const tx = timeScale.timeToCoordinate(coords.time);
      const rightTime = timeScale.coordinateToTime(tx + 150) || coords.time;

      const newDrawing = {
        id: newId,
        type: activeTool,
        point1: { time: coords.time, price: coords.price },
        point2: { time: rightTime, price: tpPrice },
        point3: { time: rightTime, price: slPrice }
      };
      
      setDrawings(prev => [...prev, newDrawing]);
      setSelectedDrawingId(newId);
      setActiveTool('cursor');
      return;
    }

    if (activeTool === 'arrow_up' || activeTool === 'arrow_down') {
      const newId = Date.now().toString();
      let color = '#2962FF';
      if (activeTool === 'arrow_up') color = '#10b981';
      if (activeTool === 'arrow_down') color = '#ef4444';

      setDrawings(prev => [...prev, {
        id: newId,
        type: activeTool,
        point1: { time: coords.time, price: coords.price },
        color
      }]);
      setSelectedDrawingId(newId);
      setActiveTool('cursor');
      return;
    }

    if (activeTool === 'path') {
      const newId = Date.now().toString();
      setCurrentDrawing({
        id: newId,
        type: activeTool,
        points: [
          { time: coords.time, price: coords.price },
          { time: coords.time, price: coords.price } // Second point follows mouse
        ]
      });
      setInteractionState({ type: 'DRAWING_PATH' });
      setSelectedDrawingId(newId);
      return;
    }

    if (activeTool === 'trendline' || activeTool === 'ray' || activeTool === 'rectangle' || activeTool === 'parallel_channel' || activeTool === 'fibo' || activeTool === 'fibo_extension' || activeTool === 'text' || activeTool === 'price_label') {
      const newId = Date.now().toString();
      setCurrentDrawing({
        id: newId,
        type: activeTool,
        point1: { time: coords.time, price: coords.price },
        point2: { time: coords.time, price: coords.price },
        ...(activeTool === 'parallel_channel' || activeTool === 'fibo_extension' ? { point3: { time: coords.time, price: coords.price } } : {}),
        ...(activeTool === 'text' ? { text: 'Ghi chú', isNew: true, color: '#2bb9b7' } : {}),
        ...(activeTool === 'price_label' ? { color: '#3b82f6' } : {})
      });
      setInteractionState({ type: 'DRAWING_NEW' });
      setSelectedDrawingId(newId);
    }
  };

  const handleFinishDrawing = (e) => {
    const coords = getLogicalCoords(e);
    if (!coords) return;

    if (interactionState.type === 'DRAWING_NEW') {
       e.stopPropagation();
       if (currentDrawing && (currentDrawing.type === 'parallel_channel' || currentDrawing.type === 'fibo_extension')) {
         setInteractionState({ type: 'DRAWING_NEW_PHASE2' });
         return;
       }
       if (currentDrawing) {
         const isSingleClickAllowed = currentDrawing.type === 'text' || currentDrawing.type === 'price_label';
         if (currentDrawing.point1.time !== currentDrawing.point2.time || Math.abs(currentDrawing.point1.price - currentDrawing.point2.price) > 0.01 || isSingleClickAllowed) {
           setDrawings(prev => [...prev, currentDrawing]);
         } else {
           setSelectedDrawingId(null);
         }
         setCurrentDrawing(null);
       }
       setActiveTool('cursor');
       setInteractionState({ type: 'IDLE' });
    } else if (interactionState.type === 'DRAWING_NEW_PHASE2') {
       e.stopPropagation();
       if (currentDrawing) {
         setDrawings(prev => [...prev, currentDrawing]);
         setCurrentDrawing(null);
       }
       setActiveTool('cursor');
       setInteractionState({ type: 'IDLE' });
    } else if (interactionState.type === 'DRAWING_PATH') {
       e.stopPropagation();
       if (currentDrawing) {
         // Click adds a new point and continues drawing
         setCurrentDrawing(prev => {
           if (!prev || prev.type !== 'path') return prev;
           return {
             ...prev,
             points: [...prev.points, { time: coords.time, price: coords.price }]
           };
         });
       }
    }
  };

  const finishPathDrawing = useCallback(() => {
    if (interactionState.type === 'DRAWING_PATH' && currentDrawing) {
      setDrawings(prev => {
        // Remove the last uncommitted point (the one following the mouse)
        // If there are at least 2 points left, save it
        if (currentDrawing.points.length > 2) {
           const finalPoints = currentDrawing.points.slice(0, -1);
           return [...prev, { ...currentDrawing, points: finalPoints }];
        }
        return prev;
      });
      setCurrentDrawing(null);
      setActiveTool('cursor');
      setInteractionState({ type: 'IDLE' });
    }
  }, [interactionState.type, currentDrawing, setActiveTool]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && interactionState.type === 'DRAWING_PATH') {
        finishPathDrawing();
      } else if (e.key === 'Escape' && interactionState.type !== 'IDLE') {
        setCurrentDrawing(null);
        setActiveTool('cursor');
        setInteractionState({ type: 'IDLE' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interactionState.type, finishPathDrawing, setActiveTool]);

  // Global Mouse Move
  const handleMouseMove = useCallback((e) => {
    if (interactionState.type === 'IDLE') return;

    const coords = getLogicalCoords(e);
    if (!coords || !coords.time || coords.price === null) return;

    if (interactionState.type === 'DRAWING_NEW') {
      setCurrentDrawing(prev => prev ? ({
        ...prev,
        point2: { time: coords.time, price: coords.price }
      }) : prev);
    } else if (interactionState.type === 'DRAWING_NEW_PHASE2') {
      setCurrentDrawing(prev => prev ? ({ ...prev, point3: { time: coords.time, price: coords.price } }) : prev);
    } else if (interactionState.type === 'DRAWING_PATH') {
      setCurrentDrawing(prev => {
        if (!prev || prev.type !== 'path') return prev;
        const newPoints = [...prev.points];
        // Update the last point to follow the mouse
        newPoints[newPoints.length - 1] = { time: coords.time, price: coords.price };
        return { ...prev, points: newPoints };
      });
    } else if (interactionState.type === 'DRAGGING_HANDLE') {
       const { drawingId, handleIndex } = interactionState;
       setDrawings(prev => prev.map(d => {
         if (d.id === drawingId) {
            if (d.type === 'path') {
               const newPoints = [...d.points];
               if (newPoints[handleIndex]) {
                  newPoints[handleIndex] = { time: coords.time, price: coords.price };
               }
               return { ...d, points: newPoints };
            }
            if (handleIndex === 1) return { ...d, point1: { time: coords.time, price: coords.price } };
            if (handleIndex === 2) {
              if (d.type === 'long_position' || d.type === 'short_position') return { ...d, point2: { ...d.point2, price: coords.price } };
              return { ...d, point2: { time: coords.time, price: coords.price } };
            }
            if (handleIndex === 3) {
              if (d.type === 'parallel_channel' || d.type === 'fibo_extension') return { ...d, point3: { time: coords.time, price: coords.price } };
              if (d.type === 'long_position' || d.type === 'short_position') return { ...d, point3: { ...d.point3, price: coords.price } };
              return { ...d, point2: { ...d.point2, time: coords.time }, point1: { ...d.point1, price: coords.price } };
            }
            if (handleIndex === 4) {
              if (d.type === 'long_position' || d.type === 'short_position') return { ...d, point2: { ...d.point2, time: coords.time }, point3: { ...d.point3, time: coords.time } };
              return { ...d, point1: { ...d.point1, time: coords.time }, point2: { ...d.point2, price: coords.price } };
            }
         }
         return d;
       }));
    } else if (interactionState.type === 'DRAGGING_BODY') {
       const { drawingId, startPoint1X, startPoint1Y, startPoint2X, startPoint2Y, startPoint3X, startPoint3Y, startMouseX, startMouseY, startPathX, startPathY } = interactionState;
       const dx = coords.x - startMouseX;
       const dy = coords.y - startMouseY;
       
       const timeScale = chart.timeScale();
       
       setDrawings(prev => prev.map(d => {
         if (d.id === drawingId) {
            if (d.type === 'path' && startPathX && startPathY) {
               const newPoints = d.points.map((p, idx) => {
                  const nX = startPathX[idx] + dx;
                  const nY = startPathY[idx] + dy;
                  const newTime = timeScale.coordinateToTime(nX);
                  const newPrice = series.coordinateToPrice(nY);
                  return { ...p, time: newTime || p.time, price: newPrice !== null ? newPrice : p.price };
               });
               return { ...d, points: newPoints };
            }

            const updates = {};
            
            if (startPoint1X !== undefined && startPoint1Y !== undefined) {
              if (d.type !== 'text') {
                const newTime1 = timeScale.coordinateToTime(startPoint1X + dx);
                const newPrice1 = series.coordinateToPrice(startPoint1Y + dy);
                if (newTime1 && newPrice1 !== null) updates.point1 = { time: newTime1, price: newPrice1 };
              }
            }
            
            if (startPoint2X !== undefined && startPoint2Y !== undefined) {
              const newTime2 = timeScale.coordinateToTime(startPoint2X + dx);
              const newPrice2 = series.coordinateToPrice(startPoint2Y + dy);
              if (newTime2 && newPrice2 !== null) updates.point2 = { time: newTime2, price: newPrice2 };
            }
            
            if (startPoint3X !== undefined && startPoint3Y !== undefined) {
              const newTime3 = timeScale.coordinateToTime(startPoint3X + dx);
              const newPrice3 = series.coordinateToPrice(startPoint3Y + dy);
              if (newTime3 && newPrice3 !== null) updates.point3 = { time: newTime3, price: newPrice3 };
            }
            
            if (Object.keys(updates).length > 0) {
              return { ...d, ...updates };
            }
         }
         return d;
       }));
    }
  }, [interactionState, getLogicalCoords, chart, series]);

  const [renderTick, setRenderTick] = useState(0);

  // Monitor chart panning/zooming to force re-render
  useEffect(() => {
    if (!chart || !series) return;
    
    let animationFrameId;
    let lastX = 0;
    let lastY = 0;
    
    const checkCoordinates = () => {
       let currentX = 0, currentY = 0;
       
       const d = drawings.length > 0 ? drawings[0] : currentDrawing;
       if (d) {
          if (d.point1) {
             currentX = safeTimeToCoordinate(d.point1.time) || 0;
             currentY = series.priceToCoordinate(d.point1.price) || 0;
          } else if (d.points && d.points.length > 0) {
             currentX = safeTimeToCoordinate(d.points[0].time) || 0;
             currentY = series.priceToCoordinate(d.points[0].price) || 0;
          }
       }
       
       if (currentX !== lastX || currentY !== lastY) {
          lastX = currentX;
          lastY = currentY;
          setRenderTick(prev => prev + 1);
       }
       animationFrameId = requestAnimationFrame(checkCoordinates);
    };
    
    checkCoordinates();
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [chart, series, drawings, currentDrawing]);

  const effectiveRenderTick = renderTick + viewUpdate;

  // Global Mouse Up
  const handleMouseUp = useCallback((e) => {
    if (interactionState.type === 'DRAWING_NEW' || interactionState.type === 'DRAWING_NEW_PHASE2' || interactionState.type === 'DRAWING_PATH') {
       // Do nothing on mouse up for new drawings, wait for next click
    } else if (interactionState.type !== 'IDLE') {
       setInteractionState({ type: 'IDLE' });
    }
  }, [interactionState]);

  // Bind Global Mouse events for dragging
  useEffect(() => {
    if (interactionState.type === 'IDLE') return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interactionState.type, handleMouseMove, handleMouseUp]);

  const handleTextChange = useCallback((id, newText) => {
    setDrawings(prev => prev.map(d => d.id === id ? { ...d, text: newText, isNew: false } : d));
  }, []);

  // Event dispatchers for shapes
  const onHandleMouseDown = (e, drawing, handleIndex) => {
    e.stopPropagation();
    setInteractionState({ type: 'DRAGGING_HANDLE', drawingId: drawing.id, handleIndex });
    setSelectedDrawingId(drawing.id);
  };

  const onLineMouseDown = (e, drawing) => {
    e.stopPropagation();
    const coords = getLogicalCoords(e);
    if (!coords) return;
    
    const timeScale = chart.timeScale();
    let p1X, p1Y, p2X, p2Y, p3X, p3Y, startPathX, startPathY;
    
    if (drawing.type === 'path' && drawing.points) {
      startPathX = drawing.points.map(p => safeTimeToCoordinate(p.time));
      startPathY = drawing.points.map(p => series.priceToCoordinate(p.price));
    } else {
      p1X = safeTimeToCoordinate(drawing.point1.time);
      p1Y = series.priceToCoordinate(drawing.point1.price);
      p2X = drawing.point2 ? safeTimeToCoordinate(drawing.point2.time) : undefined;
      p2Y = drawing.point2 ? series.priceToCoordinate(drawing.point2.price) : undefined;
      p3X = drawing.point3 ? safeTimeToCoordinate(drawing.point3.time) : undefined;
      p3Y = drawing.point3 ? series.priceToCoordinate(drawing.point3.price) : undefined;
    }
    
    setInteractionState({ 
      type: 'DRAGGING_BODY', 
      drawingId: drawing.id,
      startMouseX: coords.x,
      startMouseY: coords.y,
      startPoint1X: p1X,
      startPoint1Y: p1Y,
      startPoint2X: p2X,
      startPoint2Y: p2Y,
      startPoint3X: p3X,
      startPoint3Y: p3Y,
      startPathX,
      startPathY
    });
    setSelectedDrawingId(drawing.id);
  };

  const isDrawing = interactionState.type === 'DRAWING_NEW' || interactionState.type === 'DRAWING_NEW_PHASE2' || interactionState.type === 'DRAWING_PATH';
  const catchBackgroundEvents = activeTool !== 'cursor';

  const onUpdateDrawing = (id, updates) => {
    setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    if (currentDrawing && currentDrawing.id === id) {
      setCurrentDrawing(prev => ({ ...prev, ...updates }));
    }
  };

  const onDeleteDrawing = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bản vẽ này?")) {
      setDrawings(prev => {
        const newDrawings = prev.filter(d => d.id !== id);
        
        if (tradeId) {
          if (newDrawings.length > 0) {
            localStorage.setItem(`tv_drawings_v2_${tradeId}`, JSON.stringify(newDrawings));
          } else {
            localStorage.removeItem(`tv_drawings_v2_${tradeId}`);
          }

          const drawings_data = newDrawings.length > 0 ? JSON.stringify(newDrawings) : null;
          fetch('/api/trades', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: tradeId,
              drawings_data
            })
          }).then(() => {
            window.dispatchEvent(new CustomEvent('tv_drawings_updated', {
              detail: { tradeId, drawings_data }
            }));
          }).catch(err => console.error(err));
        }
        return newDrawings;
      });
      if (selectedDrawingId === id) setSelectedDrawingId(null);
    }
  };

  let insetRight = 60;
  let insetBottom = 26;
  try {
    if (chart) {
      insetRight = chart.priceScale('right').width();
      insetBottom = chart.timeScale().height();
    }
  } catch(e) {}

  return (
    <>
    {selectedDrawingId && (
      <DrawingSettings 
        drawing={drawings.find(d => d.id === selectedDrawingId)} 
        onUpdate={onUpdateDrawing}
        onDelete={onDeleteDrawing}
      />
    )}
    <svg 
      style={{ 
        position: 'absolute', 
        left: 0,
        top: 0,
        width: `calc(100% - ${insetRight}px)`,
        height: `calc(100% - ${insetBottom}px)`,
        zIndex: 10, 
        pointerEvents: (catchBackgroundEvents || isDrawing) ? 'auto' : 'none',
        touchAction: 'none'
      }}
      onMouseDown={!isDrawing && catchBackgroundEvents ? handleStartDrawing : undefined}
      onMouseDownCapture={isDrawing ? handleFinishDrawing : undefined}
      onDoubleClickCapture={() => { if (interactionState.type === 'DRAWING_PATH') finishPathDrawing(); }}
    >
      {drawings.map(d => {
        if (d.type === 'trendline' || d.type === 'ray') {
          return (
            <TrendlineShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'rectangle') {
          return (
            <RectangleShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'parallel_channel') {
          return (
            <ParallelChannelShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'fibo') {
          return (
            <FiboRetracementShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'fibo_extension') {
          return (
            <FiboExtensionShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'long_position') {
          return (
            <LongPositionShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'short_position') {
          return (
            <ShortPositionShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'path') {
          return (
            <PathShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              renderTick={renderTick}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
            />
          );
        } else if (d.type === 'arrow_up' || d.type === 'arrow_down') {
          return (
            <ArrowMarkerShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
              renderTick={renderTick}
            />
          );
        } else if (d.type === 'price_label') {
          return (
            <PriceLabelShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
              renderTick={renderTick}
            />
          );
        } else if (d.type === 'text') {
          return (
            <TextShape 
              key={d.id} 
              drawing={d} 
              chart={chart} 
              series={series}
              timeToCoordinate={safeTimeToCoordinate}
              isSelected={selectedDrawingId === d.id}
              onSelect={(id) => setSelectedDrawingId(id)}
              onHandleMouseDown={onHandleMouseDown}
              onLineMouseDown={onLineMouseDown}
              onTextChange={handleTextChange}
              renderTick={effectiveRenderTick}
            />
          );
        }
        return null;
      })}
      {currentDrawing && currentDrawing.type === 'path' && (
        <PathShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          timeToCoordinate={safeTimeToCoordinate}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
          renderTick={effectiveRenderTick}
        />
      )}
      {currentDrawing && currentDrawing.type === 'fibo' && (
        <FiboRetracementShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          timeToCoordinate={safeTimeToCoordinate}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
          renderTick={effectiveRenderTick}
        />
      )}
      {currentDrawing && currentDrawing.type === 'parallel_channel' && (
        <ParallelChannelShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          timeToCoordinate={safeTimeToCoordinate}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
          renderTick={effectiveRenderTick}
        />
      )}
      {currentDrawing && currentDrawing.type === 'fibo_extension' && (
        <FiboExtensionShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          timeToCoordinate={safeTimeToCoordinate}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
          renderTick={effectiveRenderTick}
        />
      )}
      {currentDrawing && currentDrawing.type === 'text' && (
        <TextShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          timeToCoordinate={safeTimeToCoordinate}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
          renderTick={effectiveRenderTick}
        />
      )}
      {currentDrawing && currentDrawing.type === 'price_label' && (
        <PriceLabelShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          timeToCoordinate={safeTimeToCoordinate}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
          renderTick={effectiveRenderTick}
        />
      )}
      {currentDrawing && currentDrawing.type !== 'rectangle' && currentDrawing.type !== 'parallel_channel' && currentDrawing.type !== 'fibo' && currentDrawing.type !== 'fibo_extension' && currentDrawing.type !== 'long_position' && currentDrawing.type !== 'short_position' && currentDrawing.type !== 'path' && currentDrawing.type !== 'arrow_up' && currentDrawing.type !== 'arrow_down' && currentDrawing.type !== 'price_label' && currentDrawing.type !== 'text' && (
        <TrendlineShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          timeToCoordinate={safeTimeToCoordinate}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
          renderTick={effectiveRenderTick}
        />
      )}
      {currentDrawing && currentDrawing.type === 'rectangle' && (
        <RectangleShape 
          drawing={currentDrawing} 
          chart={chart} 
          series={series}
          isSelected={true}
          onSelect={() => {}}
          onHandleMouseDown={() => {}}
          onLineMouseDown={() => {}}
        />
      )}
    </svg>
    </>
  );
});

export default DrawingOverlay;
