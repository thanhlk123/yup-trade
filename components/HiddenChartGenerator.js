'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

// Helper to parse DB UTC string to timestamp
function parseDbUtcToTimestamp(dbTimeStr) {
  if (!dbTimeStr) return null;
  const dateStr = dbTimeStr.includes('T') ? dbTimeStr : dbTimeStr.replace(' ', 'T') + 'Z';
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

// ─── Find last candle index whose open time <= targetTs (i.e. the CONTAINING candle) ───
function findContainingCandleIndex(candles, targetTs) {
  let idx = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time <= targetTs) idx = i;
    else break;
  }
  return idx === -1 ? 0 : idx;
}

export default function HiddenChartGenerator({ trade, isBackground = false, onComplete }) {
  const [progress, setProgress] = useState('');

  // ─── Draw overlay: badge + trade position lines ────────────────────────────
  const drawOverlay = useCallback((canvas, chart, series, currentTrade, apiInterval, candleData) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;

    // ── Badge ──────────────────────────────────────────────────────────────────
    ctx.save();
    const badgeX = 24, badgeY = 24, badgeW = 280, badgeH = 136, radius = 12;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const startTs = parseDbUtcToTimestamp(currentTrade?.trade_time);
    const endTs   = currentTrade?.exit_time ? parseDbUtcToTimestamp(currentTrade.exit_time) : (startTs ? startTs + 7200 : null);
    const isWin   = currentTrade?.pnl >= 0;
    const pnlColor = isWin ? '#10b981' : '#f43f5e';
    const pnlSign  = isWin ? '+' : '';
    const side     = (currentTrade?.side || 'BUY').toUpperCase();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px Inter, sans-serif';
    ctx.fillText(`${apiInterval || ''} CHART`, badgeX + 20, badgeY + 20);

    ctx.fillStyle = '#475569';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(`${currentTrade?.asset || 'XAUUSD'} • ${side}`, badgeX + 20, badgeY + 54);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillText(`Entry: ${currentTrade?.entry_price || ''}`, badgeX + 20, badgeY + 74);
    ctx.fillText(`Exit:  ${currentTrade?.exit_price || ''}`, badgeX + 130, badgeY + 74);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px Inter, sans-serif';
    const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
    ctx.fillText(`In: ${fmt(startTs)}`,  badgeX + 20, badgeY + 96);
    ctx.fillText(`Out: ${fmt(endTs)}`, badgeX + 20, badgeY + 112);

    ctx.textAlign = 'right';
    ctx.font = '900 22px Inter, sans-serif';
    ctx.fillStyle = pnlColor;
    ctx.fillText(`${pnlSign}${currentTrade?.pnl || 0}$`, badgeX + badgeW - 20, badgeY + 20);
    ctx.restore();

    // ── Position lines ─────────────────────────────────────────────────────────
    if (!currentTrade || !chart || !series || !startTs) return;

    const entry  = parseFloat(currentTrade.entry_price);
    const rawTp  = parseFloat(currentTrade.take_profit);
    const rawSl  = parseFloat(currentTrade.stop_loss);
    const exit   = parseFloat(currentTrade.exit_price) || entry;
    if (isNaN(entry) || entry <= 0) return;

    const hasTP = !isNaN(rawTp) && rawTp > 0;
    const hasSL = !isNaN(rawSl) && rawSl > 0;
    const tp = hasTP ? rawTp : null;
    const sl = hasSL ? rawSl : null;

    // ── X coordinates ──────────────────────────────────────────────────────────
    const timeScale = chart.timeScale();
    const snapToClosestCandle = (ts) => {
      let x = timeScale.timeToCoordinate(ts);
      if (x !== null) return x;

      if (candleData && candleData.length > 0) {
        let closest = candleData[0];
        let minDiff = Math.abs(ts - closest.time);
        for (let i = 1; i < candleData.length; i++) {
          const diff = Math.abs(ts - candleData[i].time);
          if (diff < minDiff) { minDiff = diff; closest = candleData[i]; }
        }
        x = timeScale.timeToCoordinate(closest.time);
        if (x !== null) return x;
      }

      const fromTime = timeScale.coordinateToTime(0);
      const toTime   = timeScale.coordinateToTime(timeScale.width());
      if (fromTime === null || toTime === null || fromTime === toTime) return null;
      return ((ts - fromTime) / (toTime - fromTime)) * timeScale.width();
    };

    let x1 = snapToClosestCandle(startTs);
    let x2 = snapToClosestCandle(endTs ?? startTs);
    if (x1 === null && x2 === null) return;
    if (x1 === null) x1 = x2 - 20;
    if (x2 === null) x2 = x1 + 20;
    if (x2 < x1) { const t = x1; x1 = x2; x2 = t; }

    const barSpacing = timeScale.options().barSpacing || 10;
    x1 -= barSpacing / 2;
    x2 += barSpacing / 2;
    if (x2 - x1 < barSpacing) { x2 = x1 + barSpacing; }

    // ── Y coordinates ──────────────────────────────────────────────────────────
    let yEntry = series.priceToCoordinate(entry);
    let yTp    = hasTP ? series.priceToCoordinate(tp) : null;
    let ySl    = hasSL ? series.priceToCoordinate(sl) : null;
    let yExit  = series.priceToCoordinate(exit);

    if (yEntry === null) yEntry = H * 0.5;
    if (yTp   === null) yTp    = side === 'BUY' ? yEntry - 80 : yEntry + 80;
    if (ySl   === null) ySl    = side === 'BUY' ? yEntry + 60 : yEntry - 60;
    if (yExit === null) yExit  = yEntry;

    // ── 1. Zone boxes ──────────────────────────────────────────────────────────
    if (hasTP) {
      const top = Math.min(yEntry, yTp), height = Math.max(2, Math.abs(yEntry - yTp));
      ctx.fillStyle = 'rgba(20,184,166,0.18)';
      ctx.fillRect(x1, top, x2 - x1, height);
      ctx.strokeStyle = 'rgba(20,184,166,0.40)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(x1, top, x2 - x1, height);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(16,185,129,0.80)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 3]);
      ctx.moveTo(x1, yTp); ctx.lineTo(x2, yTp);
      ctx.stroke();
    }
    if (hasSL) {
      const top = Math.min(yEntry, ySl), height = Math.max(2, Math.abs(yEntry - ySl));
      ctx.fillStyle = 'rgba(244,63,94,0.18)';
      ctx.fillRect(x1, top, x2 - x1, height);
      ctx.strokeStyle = 'rgba(244,63,94,0.40)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(x1, top, x2 - x1, height);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239,68,68,0.80)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 3]);
      ctx.moveTo(x1, ySl); ctx.lineTo(x2, ySl);
      ctx.stroke();
    }

    // ── 2. Entry line ──────────────────────────────────────────────────────────
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, yEntry); ctx.lineTo(x2, yEntry);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── 3. Trajectory line ────────────────────────────────────────────────────
    const isWinTrade = (side === 'BUY' && exit > entry) || (side === 'SELL' && exit < entry);
    const tol = Math.max(entry * 0.001, 0.5);
    const isTPHit = hasTP && Math.abs(exit - rawTp) <= tol;
    const isSLHit = !isTPHit && hasSL && Math.abs(exit - rawSl) <= tol;
    let trajColor;
    if (isTPHit) trajColor = 'rgba(16,185,129,0.85)';
    else if (isSLHit) trajColor = 'rgba(239,68,68,0.85)';
    else if (isWinTrade) trajColor = 'rgba(14,165,233,0.85)';
    else trajColor = 'rgba(168,85,247,0.85)';

    ctx.beginPath();
    ctx.strokeStyle = trajColor;
    ctx.lineWidth = (!hasTP && !hasSL) ? 2.5 : 1.5;
    ctx.setLineDash([5, 4]);
    if (!hasTP && !hasSL) {
      const cp1x = x1 + (x2 - x1) * 0.4, cp2x = x1 + (x2 - x1) * 0.6;
      ctx.moveTo(x1, yEntry);
      ctx.bezierCurveTo(cp1x, yEntry, cp2x, yExit, x2, yExit);
    } else {
      ctx.moveTo(x1, yEntry);
      ctx.lineTo(x2, yExit);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // ── 4. Arrow marker at entry ───────────────────────────────────────────────
    const isBuyDir = side === 'BUY';
    const arrowSz = 7;
    const arrowOffY = isBuyDir ? arrowSz * 2.2 : -arrowSz * 2.2;
    const arrowY = yEntry + arrowOffY;
    ctx.beginPath();
    ctx.fillStyle = isBuyDir ? '#10b981' : '#f43f5e';
    if (isBuyDir) {
      ctx.moveTo(x1, arrowY - arrowSz);
      ctx.lineTo(x1 - arrowSz * 0.75, arrowY + arrowSz * 0.55);
      ctx.lineTo(x1 + arrowSz * 0.75, arrowY + arrowSz * 0.55);
    } else {
      ctx.moveTo(x1, arrowY + arrowSz);
      ctx.lineTo(x1 - arrowSz * 0.75, arrowY - arrowSz * 0.55);
      ctx.lineTo(x1 + arrowSz * 0.75, arrowY - arrowSz * 0.55);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();

    // ── 5. Exit marker ────────────────────────────────────────────────────────
    ctx.save();
    const mr = 7;
    ctx.beginPath();
    ctx.arc(x2, yExit, mr, 0, Math.PI * 2);
    ctx.fillStyle = isTPHit ? '#10b981' : isSLHit ? '#f43f5e' : '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${mr + 2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isTPHit ? '✓' : isSLHit ? '✗' : '⬤', x2, yExit + 0.5);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (!trade) return;

    let isCancelled = false;

    const generateAll = async () => {
      const timeframeConfigs = [
        { tf: '1',   apiInterval: '1m',  intervalSec: 60    },
        { tf: '5',   apiInterval: '5m',  intervalSec: 300   },
        { tf: '15',  apiInterval: '15m', intervalSec: 900   },
        { tf: '60',  apiInterval: '1h',  intervalSec: 3600  },
        { tf: '240', apiInterval: '4h',  intervalSec: 14400 },
        { tf: 'D',   apiInterval: '1d',  intervalSec: 86400 },
      ];

      const candleOptions = {
        upColor: '#ffffff', borderUpColor: '#000000', wickUpColor: '#000000',
        downColor: '#000000', borderDownColor: '#000000', wickDownColor: '#000000',
        borderVisible: true,
      };

      const generatedFiles = [];

      // SINGLE DOM container & chart instance reused for ALL timeframes
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position:fixed;left:-9999px;top:0;width:1280px;height:720px;overflow:hidden;';
      document.body.appendChild(tempContainer);

      let tfChart = null;
      let tfSeries = null;

      try {
        tfChart = createChart(tempContainer, {
          width: 1280, height: 720,
          layout: { background: { color: '#e0e3eb' }, textColor: '#131722' },
          grid:   { vertLines: { color: '#d1d4dc' }, horzLines: { color: '#d1d4dc' } },
          crosshair: { mode: 0 },
          rightPriceScale: { autoScale: true, borderColor: '#d1d4dc' },
          timeScale: {
            timeVisible: true, secondsVisible: false, borderColor: '#d1d4dc',
            tickMarkFormatter: (time, tickMarkType) => {
              const date    = new Date(time * 1000);
              const timeStr = date.toLocaleTimeString('vi-VN',  { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
              const dateStr = date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: '2-digit', day: '2-digit' });
              return tickMarkType <= 2 ? `${dateStr} ${timeStr}` : timeStr;
            }
          }
        });

        tfSeries = typeof tfChart.addCandlestickSeries === 'function'
          ? tfChart.addCandlestickSeries(candleOptions)
          : tfChart.addSeries(CandlestickSeries, candleOptions);

        for (const { tf, apiInterval, intervalSec } of timeframeConfigs) {
          if (isCancelled) break;
          setProgress(`Đang tạo biểu đồ ${apiInterval}...`);

          const startTs = parseDbUtcToTimestamp(trade.trade_time);
          const endTs   = trade.exit_time ? parseDbUtcToTimestamp(trade.exit_time) : startTs + 3600;

          const totalDurationSec  = endTs - startTs;
          const candlesInTrade    = Math.max(1, Math.ceil(totalDurationSec / intervalSec));
          const targetCandleCount = 140; // TradingView native auto mode density (~140 candles)
          const paddingCandles    = Math.max(15, Math.ceil((targetCandleCount - candlesInTrade) / 2));

          const fetchStartMs = (startTs - paddingCandles * intervalSec * 2) * 1000;
          const fetchEndMs   = (endTs   + paddingCandles * intervalSec * 2) * 1000;

          try {
            const url = `/api/klines?symbol=${trade.asset || 'XAUUSD'}&interval=${apiInterval}&limit=1000&startTime=${Math.floor(fetchStartMs)}&endTime=${Math.floor(fetchEndMs)}`;
            const res  = await fetch(url);
            const json = await res.json();
            if (!json.success || json.data.length === 0) continue;

            tfSeries.setData(json.data);

            const totalCandles = json.data.length;
            const lastCandleIdx = totalCandles - 1;

            const startIdx = findContainingCandleIndex(json.data, startTs);
            let   endIdx   = findContainingCandleIndex(json.data, endTs);
            if (endIdx < startIdx) endIdx = startIdx;

            const tradeCandleCount = endIdx - startIdx + 1;
            const idealPad = Math.max(15, Math.ceil((targetCandleCount - tradeCandleCount) / 2));

            // Clamp right boundary so recent H1/H4/D1 trades don't leave huge blank space into the future
            let toIdx = Math.min(lastCandleIdx + 4, endIdx + idealPad);
            let fromIdx = Math.max(0, toIdx - targetCandleCount);

            tfChart.timeScale().setVisibleLogicalRange({
              from: fromIdx,
              to:   toIdx,
            });

            const waitMs = intervalSec >= 3600 ? 800 : 500;
            await new Promise(r => setTimeout(r, waitMs));
            if (isCancelled) break;

            const mainCanvas = tfChart.takeScreenshot();

            const overlayCanvas = document.createElement('canvas');
            overlayCanvas.width  = 1280;
            overlayCanvas.height = 720;
            drawOverlay(overlayCanvas, tfChart, tfSeries, trade, apiInterval, json.data);

            const combined = document.createElement('canvas');
            combined.width  = 1280;
            combined.height = 720;
            const ctx = combined.getContext('2d');
            ctx.drawImage(mainCanvas, 0, 0, 1280, 720);
            ctx.drawImage(overlayCanvas, 0, 0, 1280, 720);

            const dataUrl = combined.toDataURL('image/webp', 0.85);
            generatedFiles.push({
              filename: `trade_${trade.id}_${apiInterval}.webp`,
              base64:   dataUrl,
            });

          } catch(e) {
            console.error(`[HiddenChartGenerator] Failed ${apiInterval}`, e);
          }
        }
      } finally {
        // Single deferred cleanup at the end of ALL timeframes
        tempContainer.style.display = 'none';
        const chartToDestroy = tfChart;
        setTimeout(() => {
          if (chartToDestroy) { try { chartToDestroy.remove(); } catch(e) {} }
          if (tempContainer.parentNode) {
            try { tempContainer.parentNode.removeChild(tempContainer); } catch(e) {}
          }
        }, 300);
      }

      if (!isCancelled && generatedFiles.length > 0) {
        setProgress('Đang lưu ảnh lên server...');
        try {
          const res  = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: generatedFiles }),
          });
          const json = await res.json();
          if (json.success) {
            onComplete(json.urls);
          } else {
            onComplete(null, json.error);
          }
        } catch(e) {
          onComplete(null, e.message);
        }
      } else {
        if (!isCancelled) onComplete(null, 'No files generated');
      }
    };

    generateAll();

    return () => {
      isCancelled = true;
    };
  }, [trade, onComplete, drawOverlay]);

  return (
    <>
      {!isBackground && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center shadow-2xl">
            <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <h3 className="text-white font-bold text-lg mb-1">Đang tạo bộ ảnh kỹ thuật</h3>
            <p className="text-slate-400 text-sm">{progress}</p>
          </div>
        </div>
      )}
    </>
  );
}
