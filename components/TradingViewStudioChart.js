'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import HiddenChartGenerator from './HiddenChartGenerator';
import DrawingOverlay from './drawings/DrawingOverlay';
import DrawingToolbar from './drawings/DrawingToolbar';
import { 
  BarChart2, 
  Target, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  Clock,
  Zap,
  RefreshCw,
  Eye,
  Moon,
  Image as ImageIcon,
  Globe,
  Save,
  Settings
} from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { useLanguage } from '@/lib/i18n/LanguageContext';

import {
  calculateEMA,
  calculateSMA,
  calculateVolume,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateATR
} from '@/lib/utils/technicalIndicators';

export default function TradingViewStudioChart({ selectedTrades = [], onClearAllTrades, theme = 'dark' }) {
  const { t } = useLanguage();
  const chartContainerRef = useRef(null);
  const drawingOverlayRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const rawCandlesDataRef = useRef([]); // Stores untouched data for offset calculations
  const candlesDataRef = useRef([]);
  const fetchCounterRef = useRef(0);
  const hasTradePendingRef = useRef(false); // true when user has selected a trade that is being loaded
  const ignoreLogicalRangeEventsRef = useRef(false); // Prevents setData from triggering older data fetch


  const selectedTradesRef = useRef(selectedTrades);
  useEffect(() => {
    selectedTradesRef.current = selectedTrades;
  }, [selectedTrades]);

  // ── Supported forex/metals symbols ─────────────────────────────────────────
  const SUPPORTED_SYMBOLS = [
    { value: 'XAUUSD', label: 'XAUUSD', group: '🥇 ' + t('metals') },
    { value: 'XAGUSD', label: 'XAGUSD', group: '🥇 ' + t('metals') },
    { value: 'EURUSD', label: 'EUR/USD', group: '💱 ' + t('forexMajors') },
    { value: 'GBPUSD', label: 'GBP/USD', group: '💱 ' + t('forexMajors') },
    { value: 'USDJPY', label: 'USD/JPY', group: '💱 ' + t('forexMajors') },
    { value: 'GBPJPY', label: 'GBP/JPY', group: '💱 ' + t('forexMajors') },
    { value: 'AUDUSD', label: 'AUD/USD', group: '💱 ' + t('forexMajors') },
    { value: 'USDCAD', label: 'USD/CAD', group: '💱 ' + t('forexMajors') },
    { value: 'USDCHF', label: 'USD/CHF', group: '💱 ' + t('forexMajors') },
    { value: 'NZDUSD', label: 'NZD/USD', group: '💱 ' + t('forexMajors') },
    { value: 'EURGBP', label: 'EUR/GBP', group: '💱 ' + t('forexCrosses') },
    { value: 'EURJPY', label: 'EUR/JPY', group: '💱 ' + t('forexCrosses') },
  ];

  const [tradeToAutoCapture, setTradeToAutoCapture] = useState(null);
  const isFetchingMoreRef = useRef(false);

  const [activeSymbol, setActiveSymbol] = useState('XAUUSD');
  const [manualOffset, setManualOffset] = useState(''); // User-defined price shift (e.g. -0.00015 for Oanda sync)
  
  // Load saved offset when symbol changes
  useEffect(() => {
    const savedOffset = localStorage.getItem(`chart_offset_${activeSymbol}`);
    setManualOffset(savedOffset !== null ? savedOffset : '');
  }, [activeSymbol]);

  const [interval, setIntervalState] = useState('5'); // Default 5m review timeframe
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [dateRangeInfo, setDateRangeInfo] = useState('');
  
  const [candleColorMode, setCandleColorMode] = useState('user_screenshot'); 

  // --- INDICATORS ---
  const [activeIndicators, setActiveIndicators] = useState([]); 
  const [isIndicatorsMenuOpen, setIsIndicatorsMenuOpen] = useState(false);
  const indicatorSeriesRefs = useRef({}); // Store LineSeries instances
  const [candlesUpdated, setCandlesUpdated] = useState(0);

  // Sync indicators with chart
  useEffect(() => {
    if (!chartRef.current) return;
    
    const visibleIds = new Set(activeIndicators.filter(ind => ind.visible).map(ind => ind.id));

    Object.keys(indicatorSeriesRefs.current).forEach(id => {
      if (!visibleIds.has(id)) {
        const ref = indicatorSeriesRefs.current[id];
        if (ref && ref.macdLine) {
          try { chartRef.current.removeSeries(ref.macdLine); } catch (e) {}
          try { chartRef.current.removeSeries(ref.signalLine); } catch (e) {}
          try { chartRef.current.removeSeries(ref.hist); } catch (e) {}
        } else if (ref && ref.middleLine) {
          try { chartRef.current.removeSeries(ref.middleLine); } catch (e) {}
          try { chartRef.current.removeSeries(ref.upperLine); } catch (e) {}
          try { chartRef.current.removeSeries(ref.lowerLine); } catch (e) {}
        } else if (ref && ref.kLine) {
          try { chartRef.current.removeSeries(ref.kLine); } catch (e) {}
          try { chartRef.current.removeSeries(ref.dLine); } catch (e) {}
        } else {
          try { chartRef.current.removeSeries(ref); } catch (e) {}
        }
        delete indicatorSeriesRefs.current[id];
      }
    });

    activeIndicators.forEach(ind => {
      if (!ind.visible) return;
      
      let series = indicatorSeriesRefs.current[ind.id];
      if (!series) {
        if (ind.type === 'Volume') {
          const options = {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
          };
          series = typeof chartRef.current.addHistogramSeries === 'function'
            ? chartRef.current.addHistogramSeries(options)
            : chartRef.current.addSeries(HistogramSeries, options);
            
          // Apply scaleMargins to the priceScale, not the series options!
          chartRef.current.priceScale('').applyOptions({
            scaleMargins: { top: 0.67, bottom: 0 },
          });
        } else if (ind.type === 'RSI') {
          const options = {
            color: ind.color,
            lineWidth: 1.5,
            priceScaleId: 'rsi',
            crosshairMarkerVisible: true,
            lastValueVisible: true,
            priceLineVisible: true,
            autoscaleInfoProvider: () => ({
              priceRange: { minValue: 0, maxValue: 100 },
            }),
          };
          series = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries(options)
            : chartRef.current.addSeries(LineSeries, options);
            
          try {
            chartRef.current.priceScale('rsi').applyOptions({
              scaleMargins: { top: 0.75, bottom: 0 },
            });
          } catch (e) {}

          // Horizontal bounds for RSI
          series.createPriceLine({ price: 70, color: 'rgba(120, 123, 134, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '70' });
          series.createPriceLine({ price: 30, color: 'rgba(120, 123, 134, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '30' });
          series.createPriceLine({ price: 50, color: 'rgba(120, 123, 134, 0.2)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
        } else if (ind.type === 'MACD') {
          const hist = typeof chartRef.current.addHistogramSeries === 'function'
            ? chartRef.current.addHistogramSeries({ priceScaleId: 'macd' })
            : chartRef.current.addSeries(HistogramSeries, { priceScaleId: 'macd' });
          const macdLine = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries({ color: '#2962FF', lineWidth: 1.5, priceScaleId: 'macd', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true })
            : chartRef.current.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1.5, priceScaleId: 'macd', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true });
          const signalLine = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries({ color: '#FF6D00', lineWidth: 1.5, priceScaleId: 'macd', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true })
            : chartRef.current.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1.5, priceScaleId: 'macd', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true });
          
          series = { macdLine, signalLine, hist };
          indicatorSeriesRefs.current[ind.id] = series;
        } else if (ind.type === 'BB') {
          const middleLine = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries({ color: '#FF9800', lineWidth: 1.5, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false })
            : chartRef.current.addSeries(LineSeries, { color: '#FF9800', lineWidth: 1.5, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
          const upperLine = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries({ color: '#2962FF', lineWidth: 1.2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false })
            : chartRef.current.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1.2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
          const lowerLine = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries({ color: '#2962FF', lineWidth: 1.2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false })
            : chartRef.current.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1.2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
          
          series = { middleLine, upperLine, lowerLine };
          indicatorSeriesRefs.current[ind.id] = series;
        } else if (ind.type === 'Stoch') {
          const kLine = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries({ color: '#2962FF', lineWidth: 1.5, priceScaleId: 'stoch', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true })
            : chartRef.current.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1.5, priceScaleId: 'stoch', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true });
          const dLine = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries({ color: '#FF6D00', lineWidth: 1.5, priceScaleId: 'stoch', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true })
            : chartRef.current.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1.5, priceScaleId: 'stoch', crosshairMarkerVisible: true, lastValueVisible: true, priceLineVisible: true });
            
          try {
            chartRef.current.priceScale('stoch').applyOptions({
              scaleMargins: { top: 0.75, bottom: 0 },
              autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
            });
          } catch (e) {}

          // Horizontal bounds for Stoch
          kLine.createPriceLine({ price: 80, color: 'rgba(120, 123, 134, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '80' });
          kLine.createPriceLine({ price: 20, color: 'rgba(120, 123, 134, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '20' });
          
          series = { kLine, dLine };
          indicatorSeriesRefs.current[ind.id] = series;
        } else if (ind.type === 'ATR') {
          const options = {
            color: ind.color,
            lineWidth: 1.5,
            priceScaleId: 'atr',
            crosshairMarkerVisible: true,
            lastValueVisible: true,
            priceLineVisible: true,
          };
          series = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries(options)
            : chartRef.current.addSeries(LineSeries, options);
            
          try {
            chartRef.current.priceScale('atr').applyOptions({
              scaleMargins: { top: 0.75, bottom: 0 },
            });
          } catch (e) {}
          indicatorSeriesRefs.current[ind.id] = series;
        } else {
          const options = {
            color: ind.color,
            lineWidth: 1.5,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          };
          series = typeof chartRef.current.addLineSeries === 'function'
            ? chartRef.current.addLineSeries(options)
            : chartRef.current.addSeries(LineSeries, options);
          indicatorSeriesRefs.current[ind.id] = series;
        }
      } else {
        if (ind.type !== 'Volume' && ind.type !== 'MACD' && ind.type !== 'BB') {
          series.applyOptions({ color: ind.color });
        }
      }
      
      if (candlesDataRef.current.length > 0) {
        if (ind.type === 'EMA') {
          const emaData = calculateEMA(candlesDataRef.current, ind.length);
          series.setData(emaData);
        } else if (ind.type === 'SMA') {
          const smaData = calculateSMA(candlesDataRef.current, ind.length);
          series.setData(smaData);
        } else if (ind.type === 'Volume') {
          const volData = calculateVolume(candlesDataRef.current);
          series.setData(volData);
        } else if (ind.type === 'RSI') {
          const rsiData = calculateRSI(candlesDataRef.current, ind.length);
          series.setData(rsiData);
        } else if (ind.type === 'MACD') {
          const macdData = calculateMACD(candlesDataRef.current);
          series.macdLine.setData(macdData.macd);
          series.signalLine.setData(macdData.signal);
          series.hist.setData(macdData.hist);
        } else if (ind.type === 'BB') {
          const bbData = calculateBollingerBands(candlesDataRef.current);
          series.middleLine.setData(bbData.middle);
          series.upperLine.setData(bbData.upper);
          series.lowerLine.setData(bbData.lower);
        } else if (ind.type === 'Stoch') {
          const stochData = calculateStochastic(candlesDataRef.current, ind.length, 1, 3);
          series.kLine.setData(stochData.kLine);
          series.dLine.setData(stochData.dLine);
        } else if (ind.type === 'ATR') {
          const atrData = calculateATR(candlesDataRef.current, ind.length);
          series.setData(atrData);
        }
      }
    });

    // Dynamic layout stacking for Oscillators
    const activeOscillators = activeIndicators.filter(i => i.visible && (i.type === 'RSI' || i.type === 'MACD' || i.type === 'Stoch' || i.type === 'ATR'));
    const totalOsc = activeOscillators.length;
    const maxOscHeight = 0.6; // Capped at 60% of chart
    let heightPerOsc = 0.25;
    if (totalOsc * heightPerOsc > maxOscHeight) {
      heightPerOsc = maxOscHeight / totalOsc;
    }
    
    activeOscillators.forEach((osc, idx) => {
       const bottomMargin = (totalOsc - 1 - idx) * heightPerOsc;
       const topMargin = 1 - (totalOsc - idx) * heightPerOsc;
       
       try {
         if (osc.type === 'RSI') {
           chartRef.current.priceScale('rsi').applyOptions({ scaleMargins: { top: topMargin, bottom: bottomMargin } });
         }
         if (osc.type === 'MACD') {
           chartRef.current.priceScale('macd').applyOptions({ scaleMargins: { top: topMargin, bottom: bottomMargin } });
         }
         if (osc.type === 'Stoch') {
           chartRef.current.priceScale('stoch').applyOptions({ scaleMargins: { top: topMargin, bottom: bottomMargin } });
         }
         if (osc.type === 'ATR') {
           chartRef.current.priceScale('atr').applyOptions({ scaleMargins: { top: topMargin, bottom: bottomMargin } });
         }
       } catch (e) {}
    });

  }, [activeIndicators, candlesUpdated]);

  const [indicatorConfig, setIndicatorConfig] = useState(null);

  const addIndicator = (type, length, color) => {
    const id = `${type.toLowerCase()}_${length}_${Date.now()}`;
    setActiveIndicators(prev => [...prev, { id, type, length, color, visible: true }]);
    setIsIndicatorsMenuOpen(false);
  };
  
  const updateIndicator = (id, newConfig) => {
    setActiveIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, ...newConfig } : ind));
  };
  
  const toggleIndicatorVisibility = (id) => {
    setActiveIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, visible: !ind.visible } : ind));
  };
  
  const removeIndicator = (id) => {
    setActiveIndicators(prev => prev.filter(ind => ind.id !== id));
  };

  // --- DRAWING TOOLS (SVG OVERLAY) ---
  const [activeTool, setActiveTool] = useState('cursor');
  const [chartObj, setChartObj] = useState(null);
  const [seriesObj, setSeriesObj] = useState(null);

  const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);
  const [isSavingDrawings, setIsSavingDrawings] = useState(false);

  const handleCaptureAndSave = async () => {
    if (selectedTrades.length !== 1 || !chartContainerRef.current) return;
    const trade = selectedTrades[0];
    
    try {
      setIsSavingAnalysis(true);
      const container = chartContainerRef.current.parentElement;
      
      // Temporarily hide UI elements that shouldn't be in the screenshot
      const hideElements = container.querySelectorAll('.hide-on-capture');
      hideElements.forEach(el => {
        el.dataset.originalOpacity = el.style.opacity;
        el.style.opacity = '0';
      });

      // Give a tiny delay for DOM to apply styles
      await new Promise(r => setTimeout(r, 50));
      
      // Capture the container (Lightweight Chart + SVG drawings)
      const dataUrl = await toJpeg(container, { quality: 0.8 });
      
      // Restore UI elements
      hideElements.forEach(el => {
        el.style.opacity = el.dataset.originalOpacity || '';
      });
      
      // Extract latest drawings JSON from localStorage
      const drawingsJSON = localStorage.getItem(`tv_drawings_v2_${trade.id}`) || '[]';
      
      let existing = [];
      if (trade.image_url) {
        try {
          const parsed = JSON.parse(trade.image_url);
          if (Array.isArray(parsed)) existing = parsed;
        } catch (e) {
          if (typeof trade.image_url === 'string' && trade.image_url.startsWith('http')) {
            existing = [trade.image_url];
          }
        }
      }
      
      // Append new capture at the beginning
      const newImagesList = [dataUrl, ...existing];
      
      const payload = {
        id: trade.id,
        drawings_data: drawingsJSON,
        image_url: JSON.stringify(newImagesList)
      };

      const res = await fetch('/api/trades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert(t('captureSuccess'));
      } else {
        const errData = await res.json();
        alert(t('captureError', { error: errData.error || 'Unknown error' }));
      }
    } catch (err) {
      console.error(err);
      alert(t('captureFail', { error: err.message }));
    } finally {
      setIsSavingAnalysis(false);
    }
  };
  // --- HELPER: Apply Manual Offset ---
  const getOffsetValue = useCallback(() => {
    const val = parseFloat(manualOffset);
    return isNaN(val) ? 0 : val;
  }, [manualOffset]);

  const applyOffset = useCallback((candles) => {
    const off = getOffsetValue();
    if (off === 0) return candles;
    
    // Determine precision to prevent floating point math quirks like 1.0950000000000002
    const precisionMap = {
      'XAGUSD': 4, 'EURUSD': 5, 'GBPUSD': 5, 'USDJPY': 3, 'GBPJPY': 3,
      'AUDUSD': 5, 'USDCAD': 5, 'USDCHF': 5, 'NZDUSD': 5, 'EURGBP': 5, 'EURJPY': 3,
    };
    const precision = precisionMap[activeSymbol] || 2;

    return candles.map(c => ({
      ...c,
      open: parseFloat((c.open + off).toFixed(precision)),
      high: parseFloat((c.high + off).toFixed(precision)),
      low: parseFloat((c.low + off).toFixed(precision)),
      close: parseFloat((c.close + off).toFixed(precision))
    }));
  }, [activeSymbol, getOffsetValue]);



  // Parse DB trade timestamp (UTC Database Time) to Unix seconds matching chart candle timestamps
  const parseDbUtcToTimestamp = useCallback((dateStr) => {
    if (!dateStr) return Math.floor(Date.now() / 1000);
    let str = String(dateStr).trim();

    // Match ISO / SQL datetime format "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
    const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    let ts;
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      const hh = parseInt(match[4], 10);
      const mm = parseInt(match[5], 10);
      const ss = parseInt(match[6] || '0', 10);
      // Trade time in DB is UTC -> get UTC Unix seconds
      ts = Math.floor(Date.UTC(y, m, d, hh, mm, ss) / 1000);
    } else {
      const d = new Date(str);
      ts = Math.floor(d.getTime() / 1000);
    }

    if (isNaN(ts)) ts = Math.floor(Date.now() / 1000);

    return ts;
  }, []);

  // Fetch candlestick data via server proxy /api/klines
  const fetchHistoricalXauusdCandles = useCallback(async (tf = '5', targetStartTs = null, targetEndTs = null, symbol = 'XAUUSD') => {
    try {
      const intervalMap = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', 'D': '1d' };
      const apiInterval = intervalMap[tf] || '5m';

      let url = `/api/klines?symbol=${symbol}&interval=${apiInterval}&limit=1000`;

      if (targetStartTs) {
        const intervalSecMap = { '1': 60, '5': 300, '15': 900, '60': 3600, '240': 14400, 'D': 86400 };
        const intervalSec = intervalSecMap[tf] || 300;
        
        // Pad 300 candles before start and 300 candles after end
        const startMs = (targetStartTs - 300 * intervalSec) * 1000;
        const endMs = ((targetEndTs || targetStartTs) + 300 * intervalSec) * 1000;

        url += `&startTime=${Math.floor(startMs)}&endTime=${Math.floor(endMs)}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    } catch (e) {
      console.error('Error fetching historical candles:', e);
    }
    return null;
  }, []);

  // Helper to get precise X coordinate matching local trade timestamps
  const getExactXCoordinate = (timeScale, ts) => {
    if (!timeScale || !ts) return null;
    let x = timeScale.timeToCoordinate(ts);
    if (x !== null) return x;

    const candles = candlesDataRef.current;
    if (candles && candles.length > 0) {
      let closestCandle = candles[0];
      let minDiff = Math.abs(candles[0].time - ts);
      for (let i = 1; i < candles.length; i++) {
        const diff = Math.abs(candles[i].time - ts);
        if (diff < minDiff) {
          minDiff = diff;
          closestCandle = candles[i];
        }
      }
      if (closestCandle) {
        return timeScale.timeToCoordinate(closestCandle.time);
      }
    }
    return null;
  };

  // Redraw ALL Checked Trades' Position Overlays — lockstep with pan & zoom
  const redrawCanvasOverlay = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }

    animFrameIdRef.current = requestAnimationFrame(() => {
      try {
        const canvas = overlayCanvasRef.current;
        const chart = chartRef.current;
        const series = candlestickSeriesRef.current;

        if (!canvas || !chart || !series) return;

        const container = chartContainerRef.current;
        if (!container) return;

        if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!selectedTradesRef.current || selectedTradesRef.current.length === 0) return;

        const timeScale = chart.timeScale();
        const W = canvas.width;
        const H = canvas.height;

        // ── Helper: rounded rectangle with fallback ──────────────────────────
        const drawRoundRect = (x, y, w, h, r) => {
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.arcTo(x + w, y, x + w, y + r, r);
          ctx.lineTo(x + w, y + h - r);
          ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
          ctx.lineTo(x + r, y + h);
          ctx.arcTo(x, y + h, x, y + h - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
        }
      };

      // ── Helper: price label on right edge (price axis area) ──────────────
      const drawPriceLabel = (y, text, bgColor, txtColor = '#ffffff') => {
        if (y === null || isNaN(y) || y < 4 || y > H - 4) return;
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(text).width;
        const px = 5;
        const lw = tw + px * 2;
        const lh = 15;
        const lx = W - lw - 5;
        const ly = y - lh / 2;
        ctx.fillStyle = bgColor;
        drawRoundRect(lx, ly, lw, lh, 3);
        ctx.fill();
        ctx.fillStyle = txtColor;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(text, lx + px, y);
      };

      // ── Helper: time label on bottom X axis ──────────────────────────────
      const drawTimeLabel = (x, text, bgColor) => {
        if (x === null || isNaN(x) || x < 2 || x > W - 2) return;
        ctx.font = 'bold 9px monospace';
        const tw = ctx.measureText(text).width;
        const px = 4;
        const lw = tw + px * 2;
        const lh = 13;
        const lx = Math.max(2, Math.min(x - lw / 2, W - lw - 2));
        const ly = H - lh - 2;
        ctx.fillStyle = bgColor;
        drawRoundRect(lx, ly, lw, lh, 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, lx + lw / 2, ly + lh / 2);
      };

      // ── Helper: format price ─────────────────────────────────────────────
      const fmtP = (p) => Number(p).toFixed(2);

      // ── Helper: format timestamp as HH:MM in Asia/Ho_Chi_Minh (UTC+7) ──────
      const fmtTime = (ts) =>
        new Date(ts * 1000).toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

      selectedTradesRef.current.forEach((trade) => {
        const entry = parseFloat(trade.entry_price);
        const rawTp   = parseFloat(trade.take_profit);
        const rawSl   = parseFloat(trade.stop_loss);
        const exit    = parseFloat(trade.exit_price) || entry;
        const side    = (trade.side || 'BUY').toUpperCase();

        if (isNaN(entry) || entry <= 0) return;

        const hasTP = !isNaN(rawTp) && rawTp > 0;
        const hasSL = !isNaN(rawSl) && rawSl > 0;
        const sl = hasSL ? rawSl : null;
        const tp = hasTP ? rawTp : null;
        const startTs = parseDbUtcToTimestamp(trade.trade_time);
        const endTs   = trade.exit_time
          ? parseDbUtcToTimestamp(trade.exit_time)
          : startTs + 7200;

        // ── X coordinates ─────────────────────────────────────────────────
        let x1 = timeScale.timeToCoordinate(startTs) ?? getExactXCoordinate(timeScale, startTs);
        let x2 = timeScale.timeToCoordinate(endTs)   ?? getExactXCoordinate(timeScale, endTs);

        if (x1 === null && x2 === null) return;
        if (x1 === null) x1 = x2 - 40;
        if (x2 === null) x2 = x1 + 40;
        if (x2 < x1) { const tmp = x1; x1 = x2; x2 = tmp; }

        // ── Cover Full Candle Width ───────────────────────────────────────
        // timeToCoordinate returns the center of the candle.
        // We shift x1 to the left edge and x2 to the right edge to fully wrap the candles.
        const barSpacing = timeScale.options().barSpacing || 12;
        const halfBar = barSpacing / 2;
        x1 -= halfBar;
        x2 += halfBar;

        // ── Y coordinates ─────────────────────────────────────────────────
        let yEntry = series.priceToCoordinate(entry);
        let yTp    = series.priceToCoordinate(tp);
        let ySl    = series.priceToCoordinate(sl);
        let yExit  = series.priceToCoordinate(exit);

        if (yEntry === null) yEntry = H * 0.5;
        if (yTp   === null) yTp    = side === 'BUY' ? yEntry - 80 : yEntry + 80;
        if (ySl   === null) ySl    = side === 'BUY' ? yEntry + 60 : yEntry - 60;
        if (yExit === null) yExit  = yEntry;

        // ── Exit type detection ───────────────────────────────────────────
        const tol = Math.max(entry * 0.001, 0.5); // 0.1% or $0.5 tolerance
        const isTPHit = hasTP && Math.abs(exit - rawTp) <= tol;
        const isSLHit = !isTPHit && hasSL && Math.abs(exit - rawSl) <= tol;
        const isManual = !isTPHit && !isSLHit && !!trade.exit_time;

        // ════ 1 & 2. ZONE BOXES AND HORIZONTAL LINES ════════════════════
        if (hasTP) {
          // Target zone
          const tgTop = Math.min(yEntry, yTp);
          const tgH   = Math.max(2, Math.abs(yEntry - yTp));
          ctx.fillStyle   = 'rgba(20, 184, 166, 0.18)';
          ctx.fillRect(x1, tgTop, x2 - x1, tgH);
          ctx.strokeStyle = 'rgba(20, 184, 166, 0.40)';
          ctx.lineWidth   = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(x1, tgTop, x2 - x1, tgH);
          
          // TP line (green dashed)
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.80)';
          ctx.lineWidth   = 1.2;
          ctx.setLineDash([6, 3]);
          ctx.moveTo(x1, yTp);
          ctx.lineTo(x2, yTp);
          ctx.stroke();
        }

        if (hasSL) {
          // Stop zone
          const slTop = Math.min(yEntry, ySl);
          const slH   = Math.max(2, Math.abs(yEntry - ySl));
          ctx.fillStyle   = 'rgba(239, 68, 68, 0.18)';
          ctx.fillRect(x1, slTop, x2 - x1, slH);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.40)';
          ctx.strokeRect(x1, slTop, x2 - x1, slH);
          
          // SL line (red dashed)
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.80)';
          ctx.lineWidth   = 1.2;
          ctx.setLineDash([6, 3]);
          ctx.moveTo(x1, ySl);
          ctx.lineTo(x2, ySl);
          ctx.stroke();
        }

        // Entry line (solid white/gray)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(160, 174, 192, 0.90)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([]);
        ctx.moveTo(x1, yEntry);
        ctx.lineTo(x2, yEntry);
        ctx.stroke();

        // ════ 3. TRAJECTORY LINE (entry → exit) ════════════════════════
        const isWin = (side === 'BUY' && exit > entry) || (side === 'SELL' && exit < entry);
        
        let trajColor;
        if (isTPHit) trajColor = 'rgba(16,185,129,0.85)';
        else if (isSLHit) trajColor = 'rgba(239,68,68,0.85)';
        else if (isWin) trajColor = 'rgba(14,165,233,0.85)'; // Sky Blue for Manual Win
        else trajColor = 'rgba(168,85,247,0.85)'; // Purple for Manual Loss

        ctx.beginPath();
        ctx.strokeStyle = trajColor;
        ctx.lineWidth   = (!hasTP && !hasSL) ? 2.5 : 1.2;
        ctx.setLineDash([4, 4]);
        
        if (!hasTP && !hasSL) {
           // Bezier Curve for naked trade
           const cp1x = x1 + (x2 - x1) * 0.4;
           const cp1y = yEntry;
           const cp2x = x1 + (x2 - x1) * 0.6;
           const cp2y = yExit;
           ctx.moveTo(x1, yEntry);
           ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, yExit);
        } else {
           ctx.moveTo(x1, yEntry);
           ctx.lineTo(x2, yExit);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // ════ 4. VERTICAL TIME MARKER LINES ════════════════════════════
        [x1, x2].forEach((vx, idx) => {
          if (vx < 0 || vx > W) return;
          ctx.beginPath();
          ctx.strokeStyle = idx === 0
            ? 'rgba(160, 174, 192, 0.30)'
            : isTPHit ? 'rgba(16,185,129,0.30)'
            : isSLHit ? 'rgba(239,68,68,0.30)'
            : 'rgba(251,191,36,0.30)';
          ctx.lineWidth   = 1;
          ctx.setLineDash([3, 6]);
          ctx.moveTo(vx, 0);
          ctx.lineTo(vx, H - 18);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // Time labels on X axis
        drawTimeLabel(x1, fmtTime(startTs), 'rgba(100,116,139,0.85)');
        if (trade.exit_time) {
          const exitLabelColor = isTPHit ? 'rgba(16,185,129,0.90)'
                               : isSLHit ? 'rgba(239,68,68,0.90)'
                               : 'rgba(217,119,6,0.90)';
          drawTimeLabel(x2, fmtTime(endTs), exitLabelColor);
        }

        // ════ 5. PRICE LABELS (right edge) ═════════════════════════════
        if (hasTP) drawPriceLabel(yTp,    `TP  ${fmtP(rawTp)}`, '#059669');
        if (hasSL) drawPriceLabel(ySl,    `SL  ${fmtP(rawSl)}`, '#e11d48');
        drawPriceLabel(yEntry, `${fmtP(entry)}`, '#374151', '#e2e8f0');

        // ════ 6. ENTRY ARROW MARKER ════════════════════════════════════
        const isBuy    = side === 'BUY';
        const arrowSz  = 7;
        const arrowOffY = isBuy ? arrowSz * 2.2 : -arrowSz * 2.2;
        const arrowY   = yEntry + arrowOffY;
        const arrowX   = x1;

        ctx.beginPath();
        ctx.fillStyle = isBuy ? '#10b981' : '#f43f5e';
        if (isBuy) {
          // UP triangle ▲
          ctx.moveTo(arrowX, arrowY - arrowSz);
          ctx.lineTo(arrowX - arrowSz * 0.75, arrowY + arrowSz * 0.55);
          ctx.lineTo(arrowX + arrowSz * 0.75, arrowY + arrowSz * 0.55);
        } else {
          // DOWN triangle ▼
          ctx.moveTo(arrowX, arrowY + arrowSz);
          ctx.lineTo(arrowX - arrowSz * 0.75, arrowY - arrowSz * 0.55);
          ctx.lineTo(arrowX + arrowSz * 0.75, arrowY - arrowSz * 0.55);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 0.8;
        ctx.stroke();

        // ════ 7. EXIT MARKER ═══════════════════════════════════════════
        const exitX = x2;
        const exitY = yExit;
        const mr    = 7; // marker radius

        ctx.save();

        if (isTPHit) {
          // ✓ Green filled circle
          ctx.beginPath();
          ctx.arc(exitX, exitY, mr, 0, Math.PI * 2);
          ctx.fillStyle   = '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
          ctx.fillStyle   = '#ffffff';
          ctx.font        = `bold ${mr + 2}px sans-serif`;
          ctx.textAlign   = 'center';
          ctx.textBaseline= 'middle';
          ctx.fillText('✓', exitX, exitY + 0.5);

        } else if (isSLHit) {
          // ✗ Red filled circle
          ctx.beginPath();
          ctx.arc(exitX, exitY, mr, 0, Math.PI * 2);
          ctx.fillStyle   = '#f43f5e';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
          ctx.fillStyle   = '#ffffff';
          ctx.font        = `bold ${mr + 2}px sans-serif`;
          ctx.textAlign   = 'center';
          ctx.textBaseline= 'middle';
          ctx.fillText('✗', exitX, exitY + 0.5);

        } else if (isManual) {
          // ◆ Diamond — "Cắt tay"
          const manColor = isWin ? '#0ea5e9' : '#a855f7'; // Sky Blue or Purple
          const manText = isWin ? t('manualCutWin') : t('manualCutLoss');
          const d = mr + 2;
          ctx.beginPath();
          ctx.moveTo(exitX,     exitY - d);
          ctx.lineTo(exitX + d, exitY);
          ctx.lineTo(exitX,     exitY + d);
          ctx.lineTo(exitX - d, exitY);
          ctx.closePath();
          ctx.fillStyle   = manColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 1.2;
          ctx.stroke();
          
          // Label above diamond
          ctx.fillStyle    = manColor;
          ctx.font         = 'bold 10px sans-serif';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(manText, exitX, exitY - d - 4);
          
          // Draw PNL text
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(`${isWin ? '+' : ''}${fmtP(trade.pnl || 0)}$`, exitX, exitY - d - 17);
        }

        ctx.restore();

        // ════ 8. CORNER HANDLES ═════════════════════════════════════════
        const hSz = 5;
        [[x1, yEntry], [x2, yExit], [x1, yTp], [x1, ySl]].forEach(([hx, hy]) => {
          if (hx < -hSz || hx > W + hSz || hy < -hSz || hy > H + hSz) return;
          ctx.fillStyle   = '#131722';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 1;
          ctx.fillRect(hx - hSz / 2, hy - hSz / 2, hSz, hSz);
          ctx.strokeRect(hx - hSz / 2, hy - hSz / 2, hSz, hSz);
        });
        });
      } catch (err) {
        // Safe catch for "Object is disposed" when unmounting
      }
    });
  }, [parseDbUtcToTimestamp]);


  // Load Older Candles Automatically when User Drags Left (Infinite History Panning)
  const handleLoadOlderCandles = useCallback(async () => {
    if (isFetchingMoreRef.current || !candlesDataRef.current || candlesDataRef.current.length === 0) return;
    
    const earliestCandle = candlesDataRef.current[0];
    if (!earliestCandle) return;

    isFetchingMoreRef.current = true;
    setIsFetchingOlder(true);

    try {
      const intervalSecMap = { '1': 60, '5': 300, '15': 900, '60': 3600, '240': 14400, 'D': 86400 };
      const intervalSec = intervalSecMap[interval] || 300;

      const endMs = (earliestCandle.time - 1) * 1000;
      const startMs = (earliestCandle.time - 800 * intervalSec) * 1000;

      const intervalMap = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', 'D': '1d' };
      const apiInterval = intervalMap[interval] || '5m';

      const url = `/api/klines?symbol=${activeSymbol}&interval=${apiInterval}&limit=1000&startTime=${Math.floor(startMs)}&endTime=${Math.floor(endMs)}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const currentRaw = rawCandlesDataRef.current;
        const newRaw = json.data;

        // Deduplicate and merge
        const mergedRaw = [...newRaw];
        const newTimes = new Set(newRaw.map(c => c.time));
        for (const c of currentRaw) {
          if (!newTimes.has(c.time)) {
            mergedRaw.push(c);
          }
        }
        mergedRaw.sort((a, b) => a.time - b.time);

        rawCandlesDataRef.current = mergedRaw;
        
        const offsettedMerged = applyOffset(mergedRaw);
        candlesDataRef.current = offsettedMerged;

        if (candlestickSeriesRef.current) {
          candlestickSeriesRef.current.setData(offsettedMerged);
          setCandlesUpdated(prev => prev + 1);

          const firstDate = new Date(mergedRaw[0].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const lastDate = new Date(mergedRaw[mergedRaw.length - 1].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          setDateRangeInfo(`${firstDate} - ${lastDate}`);

          // Force lightweight-charts to layout its scales before redrawing overlay
          // otherwise priceToCoordinate returns null and fallback draws in middle of screen
          setTimeout(() => {
            redrawCanvasOverlay();
          }, 100);
        }
      }
    } catch (e) {
      console.error('Error fetching older historical candles on drag:', e);
    } finally {
      isFetchingMoreRef.current = false;
      setIsFetchingOlder(false);
    }
  }, [interval, activeSymbol, redrawCanvasOverlay, applyOffset]);

  // Re-apply offset if user changes manualOffset without refetching
  useEffect(() => {
    if (rawCandlesDataRef.current && rawCandlesDataRef.current.length > 0) {
      const offsetted = applyOffset(rawCandlesDataRef.current);
      candlesDataRef.current = offsetted;
      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData(offsetted);
        redrawCanvasOverlay();
      }
    }
  }, [manualOffset, applyOffset, redrawCanvasOverlay]);

  // Dynamic Theme & Color Mode Update without destroying chart instance
  useEffect(() => {
    if (!chartRef.current) return;

    let chartBgColor = '#e0e3eb';
    let textColor = '#131722';
    let gridColor = '#d1d4dc';
    let borderColor = '#cbd0d8';

    if (candleColorMode === 'tradingview_classic') {
      chartBgColor = theme === 'light' ? '#ffffff' : '#181c28';
      textColor = theme === 'light' ? '#131722' : '#e2e8f0';
      gridColor = theme === 'light' ? '#edf2f7' : 'rgba(255, 255, 255, 0.06)';
      borderColor = theme === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)';
    }

    try {
      chartRef.current.applyOptions({
        layout: {
          background: { color: chartBgColor },
          textColor: textColor,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        rightPriceScale: {
          borderColor: borderColor,
        },
        timeScale: {
          borderColor: borderColor,
        },
      });
      redrawCanvasOverlay();
    } catch (e) {
      // Safe disposal check
    }
  }, [theme, candleColorMode, redrawCanvasOverlay]);

  // Initialize Lightweight Candlestick Chart Engine matching User Screenshot 1:1
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const containerHeight = chartContainerRef.current.clientHeight || 560;
    
    let chartBgColor = '#e0e3eb';
    let textColor = '#131722';
    let gridColor = '#d1d4dc';
    let borderColor = '#cbd0d8';

    if (candleColorMode === 'tradingview_classic') {
      chartBgColor = theme === 'light' ? '#ffffff' : '#181c28';
      textColor = theme === 'light' ? '#131722' : '#e2e8f0';
      gridColor = theme === 'light' ? '#edf2f7' : 'rgba(255, 255, 255, 0.06)';
      borderColor = theme === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)';
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: containerHeight,
      layout: {
        background: { color: chartBgColor },
        textColor: textColor,
      },
      localization: {
        locale: 'vi-VN',
        timeFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          return date.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: borderColor,
        autoScale: true,
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time, tickMarkType) => {
          const date = new Date(time * 1000);
          const timeStr = date.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          const dateStr = date.toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            month: '2-digit',
            day: '2-digit',
          });

          if (tickMarkType <= 2) {
            return `${dateStr} ${timeStr}`;
          }
          return timeStr;
        },
      },
    });

    // Determine price format precision based on active symbol
    const precisionMap = {
      'XAGUSD': 4,
      'EURUSD': 5,
      'GBPUSD': 5,
      'USDJPY': 3,
      'GBPJPY': 3,
      'AUDUSD': 5,
      'USDCAD': 5,
      'USDCHF': 5,
      'NZDUSD': 5,
      'EURGBP': 5,
      'EURJPY': 3,
    };
    // Default to 2 for XAUUSD and others
    const precision = precisionMap[activeSymbol] || 2;
    const minMove = 1 / Math.pow(10, precision);

    const priceFormatOptions = {
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: minMove,
      }
    };

    let candleOptions;
    if (candleColorMode === 'tradingview_classic') {
      candleOptions = {
        ...priceFormatOptions,
        upColor: '#26a69a',                          // Nến tăng: Xanh Ngọc TradingView
        borderUpColor: '#26a69a',
        wickUpColor: '#26a69a',
        downColor: '#ef5350',                        // Nến giảm: Đỏ TradingView
        borderDownColor: '#ef5350',
        wickDownColor: '#ef5350',
        borderVisible: true,
      };
    } else {
      // 'user_screenshot' (Default Monochrome Theme)
      candleOptions = {
        ...priceFormatOptions,
        upColor: '#ffffff',                          // Nến tăng: Thân trắng
        borderUpColor: '#000000',                    // Viền đen
        wickUpColor: '#000000',                      // Râu đen
        downColor: '#000000',                        // Nến giảm: Full đen
        borderDownColor: '#000000',                  // Viền đen
        wickDownColor: '#000000',                    // Râu đen
        borderVisible: true,
      };
    }

    const candlestickSeries = typeof chart.addCandlestickSeries === 'function'
      ? chart.addCandlestickSeries(candleOptions)
      : chart.addSeries(CandlestickSeries, candleOptions);

    const origRemove = chart.remove.bind(chart);
    chart.remove = () => {
      requestAnimationFrame(() => {
        try { origRemove(); } catch (e) {}
      });
    };

    chartRef.current = chart;
    setChartObj(chart);
    candlestickSeriesRef.current = candlestickSeries;
    setSeriesObj(candlestickSeries);

    // Load initial default candles
    setIsLoadingFeed(true);
    const currentFetchId = ++fetchCounterRef.current;
    fetchHistoricalXauusdCandles(interval, null, null, activeSymbol).then((realCandles) => {
      // Abort if a trade was selected before this initial fetch completed
      if (currentFetchId !== fetchCounterRef.current || hasTradePendingRef.current) {
        // If aborted, let the trade fetch logic handle setIsLoadingFeed
        return;
      }
      
      if (realCandles && realCandles.length > 0) {
        rawCandlesDataRef.current = realCandles;
        const offsetted = applyOffset(realCandles);
        candlesDataRef.current = offsetted;
        candlestickSeries.setData(offsetted);
        
        // Default auto view: show the last 140 candles (~9px per candle) matching TradingView native auto mode
        if (realCandles.length > 0) {
          const total = realCandles.length;
          const targetShow = 140;
          const fromIdx = Math.max(0, total - targetShow);
          const toIdx = total - 1;
          try {
            chart.timeScale().setVisibleLogicalRange({
              from: fromIdx,
              to: toIdx,
            });
          } catch (e) {
            chart.timeScale().fitContent();
          }
        } else {
          chart.timeScale().fitContent();
        }
        
        setTimeout(() => {
          redrawCanvasOverlay();
        }, 100);

        const firstDate = new Date(realCandles[0].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const lastDate = new Date(realCandles[realCandles.length - 1].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        setDateRangeInfo(`${firstDate} - ${lastDate}`);
      }
      setIsLoadingFeed(false);
    });

    // Handle Infinite Left Drag to Load Older Historical Candles
    const handleLogicalRangeChange = (logicalRange) => {
      redrawCanvasOverlay();

      if (!logicalRange || ignoreLogicalRangeEventsRef.current) return;
      if (logicalRange.from < 25 && !isFetchingMoreRef.current) {
        handleLoadOlderCandles();
      }
    };
    // Subscribe to ALL pan, zoom, scroll & crosshair events
    chart.timeScale().subscribeVisibleTimeRangeChange(redrawCanvasOverlay);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
    chart.subscribeCrosshairMove(redrawCanvasOverlay);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight || 560,
          });
          redrawCanvasOverlay();
        } catch (e) {
          // Ignore if chart is disposed
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);

      const chartInstance = chartRef.current;
      chartRef.current = null;
      candlestickSeriesRef.current = null;

      if (chartInstance) {
        try {
          chartInstance.timeScale().unsubscribeVisibleTimeRangeChange(redrawCanvasOverlay);
          chartInstance.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
          chartInstance.unsubscribeCrosshairMove(redrawCanvasOverlay);
        } catch (e) {
          // Safe disposal check
        }

        setTimeout(() => {
          try {
            chartInstance.remove();
          } catch (e) {
            // Prevent Object is Disposed error
          }
        }, 150);
      }

      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = '';
      }
    };
  }, [interval, activeSymbol, candleColorMode, fetchHistoricalXauusdCandles, redrawCanvasOverlay, handleLoadOlderCandles, applyOffset]);

  // Load Historical Candles & Lockstep Center View when selectedTrades changes
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    if (!selectedTrades || selectedTrades.length === 0) {
      redrawCanvasOverlay();
      return;
    }

    // Auto-sync symbol with the first selected trade if they differ
    const tradeAsset = selectedTrades[0].asset || 'XAUUSD';
    if (tradeAsset !== activeSymbol) {
      setActiveSymbol(tradeAsset);
      return; // The change in activeSymbol will re-trigger this effect
    }

    // Determine target timestamp bounds across selected trades
    let minStartTs = Infinity;
    let maxEndTs = -Infinity;

    selectedTrades.forEach((t) => {
      const s = parseDbUtcToTimestamp(t.trade_time);
      const e = t.exit_time ? parseDbUtcToTimestamp(t.exit_time) : s + 3600 * 3;
      if (s < minStartTs) minStartTs = s;
      if (e > maxEndTs) maxEndTs = e;
    });

    if (minStartTs === Infinity || maxEndTs === -Infinity) {
      redrawCanvasOverlay();
      return;
    }

    // Check if currently loaded candles already cover this timeframe
    const currentCandles = candlesDataRef.current;
    const coversStart = currentCandles.length > 0 && currentCandles[0].time <= minStartTs;
    const coversEnd = currentCandles.length > 0 && currentCandles[currentCandles.length - 1].time >= maxEndTs;

    const applyViewport = () => {
      if (!chartRef.current) return;
      const candles = candlesDataRef.current;
      if (!candles || candles.length === 0) return;

      let startIdx = -1;
      let endIdx = -1;
      for (let i = 0; i < candles.length; i++) {
        if (candles[i].time <= minStartTs) startIdx = i;
        if (candles[i].time <= maxEndTs) endIdx = i;
      }
      if (startIdx === -1) startIdx = 0;
      if (endIdx === -1 || endIdx < startIdx) endIdx = startIdx;

      const totalCandles = candles.length;
      const lastCandleIdx = totalCandles - 1;

      const tradeCandleCount = endIdx - startIdx + 1;
      const targetCandles = 140; // Default view density
      const idealPad = Math.max(15, Math.ceil((targetCandles - tradeCandleCount) / 2));

      let toIdx = Math.min(lastCandleIdx + 4, endIdx + idealPad);
      let fromIdx = Math.max(0, toIdx - targetCandles);

      try {
        chartRef.current.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
      } catch (e) {
        if (chartRef.current) chartRef.current.timeScale().fitContent();
      }

      setTimeout(() => { redrawCanvasOverlay(); }, 150);
    };

    const sameSymbol = activeSymbol === (selectedTrades[0].asset || 'XAUUSD');
    const alreadyCovered = coversStart && coversEnd;

    if (alreadyCovered) {
      // Data already loaded and covers the trade range — just scroll, no fetch needed
      applyViewport();
      setIsLoadingFeed(false); // clear any leftover initial loading state
    } else if (sameSymbol) {
      // Same symbol: silently fetch data in background without showing the loading spinner
      setIsLoadingFeed(false); // clear initial loading state so it's truly silent

      hasTradePendingRef.current = true;
      const currentFetchId = ++fetchCounterRef.current;
      fetchHistoricalXauusdCandles(interval, minStartTs, maxEndTs, activeSymbol).then((historicalCandles) => {
        if (currentFetchId !== fetchCounterRef.current) return;
        hasTradePendingRef.current = false;

        if (historicalCandles && historicalCandles.length > 0 && candlestickSeriesRef.current) {
          const offsetted = applyOffset(historicalCandles);
          candlesDataRef.current = offsetted;
          rawCandlesDataRef.current = historicalCandles;

          ignoreLogicalRangeEventsRef.current = true;
          candlestickSeriesRef.current.setData(offsetted);
          setCandlesUpdated(prev => prev + 1);
          applyViewport();
          setTimeout(() => { ignoreLogicalRangeEventsRef.current = false; }, 200);

          const firstDate = new Date(historicalCandles[0].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const lastDate = new Date(historicalCandles[historicalCandles.length - 1].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          setDateRangeInfo(`${firstDate} - ${lastDate}`);
        }
        setIsLoadingFeed(false); // safety net
      });
    } else {
      // Different symbol — must reload with loading indicator
      hasTradePendingRef.current = true;
      const currentFetchId = ++fetchCounterRef.current;
      setIsLoadingFeed(true);
      fetchHistoricalXauusdCandles(interval, minStartTs, maxEndTs, activeSymbol).then((historicalCandles) => {
        if (currentFetchId !== fetchCounterRef.current) return;
        hasTradePendingRef.current = false;

        if (historicalCandles && historicalCandles.length > 0 && candlestickSeriesRef.current) {
          const offsetted = applyOffset(historicalCandles);
          candlesDataRef.current = offsetted;
          rawCandlesDataRef.current = historicalCandles;

          ignoreLogicalRangeEventsRef.current = true;
          candlestickSeriesRef.current.setData(offsetted);
          setCandlesUpdated(prev => prev + 1);
          applyViewport();
          setTimeout(() => { ignoreLogicalRangeEventsRef.current = false; }, 200);

          const firstDate = new Date(historicalCandles[0].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const lastDate = new Date(historicalCandles[historicalCandles.length - 1].time * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          setDateRangeInfo(`${firstDate} - ${lastDate}`);
        }
        setIsLoadingFeed(false);
      });
    }
  }, [selectedTrades, interval, activeSymbol, parseDbUtcToTimestamp, fetchHistoricalXauusdCandles, redrawCanvasOverlay]);

  const isClassicTheme = candleColorMode === 'tradingview_classic';
  const isScreenshotTheme = candleColorMode === 'user_screenshot';

  return (
    <div className={`relative h-full w-full flex flex-col transition-all duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 p-4' 
        : ''
    } ${
      theme === 'light'
        ? (isClassicTheme ? 'bg-[#ffffff] text-slate-900' : 'bg-[#e0e3eb] text-slate-900')
        : 'bg-[#12151e] text-slate-100'
    }`}>
      
      {/* Top Controls Header */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 flex-shrink-0 transition-colors duration-300 ${
        theme === 'light'
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#181c28] border-white/10'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
            theme === 'light' ? 'bg-slate-100 border border-slate-300 text-slate-800' : 'bg-slate-800 border border-slate-700 text-emerald-400'
          }`}>
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-extrabold text-sm tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {activeSymbol} <span className={`font-normal text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>• {interval === 'D' ? '1D' : `${interval}m`}</span>
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase flex items-center gap-1 ${
                theme === 'light' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                <Clock className="w-3 h-3" /> {t('vnTimeZone')}
              </span>
            </div>
            <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('timeSyncNotice')} {dateRangeInfo ? `• Khung nến: ${dateRangeInfo}` : ''}
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedTrades.length === 1 && (
            <button
              onClick={() => setTradeToAutoCapture(selectedTrades[0])}
              className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                theme === 'light'
                  ? 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200'
                  : 'bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border-violet-500/30'
              }`}
              title="Auto capture"
            >
              {t('autoGenImage')}
            </button>
          )}
          {selectedTrades.length > 0 && (
            <button
              onClick={onClearAllTrades}
              className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition cursor-pointer ${
                theme === 'light'
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              {t('clearSelectionCount', { count: selectedTrades.length })}
            </button>
          )}

          {/* ── Symbol Selector Dropdown ── */}
          <div className="relative">
            <select
              value={activeSymbol}
              onChange={(e) => setActiveSymbol(e.target.value)}
              className={`appearance-none pl-2.5 pr-7 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition focus:outline-none focus:ring-1 ${
                theme === 'light'
                  ? 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:ring-emerald-400'
                  : 'bg-slate-800 border-slate-600 text-white hover:border-slate-500 focus:ring-emerald-500'
              }`}
              title={t('selectAsset')}
            >
              {(() => {
                const groups = {};
                SUPPORTED_SYMBOLS.forEach(s => {
                  if (!groups[s.group]) groups[s.group] = [];
                  groups[s.group].push(s);
                });
                return Object.entries(groups).map(([groupName, symbols]) => (
                  <optgroup key={groupName} label={groupName}>
                    {symbols.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
            {/* Custom chevron icon */}
            <div className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${
              theme === 'light' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* ── Data Source Badge ── */}
          <div 
            className={`text-[10px] px-2 py-1 rounded-lg border font-medium whitespace-nowrap ${
              theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-800/50 border-slate-700 text-slate-400'
            }`}
            title={t('dataSourceNotice')}
          >
            {t('source')}: {activeSymbol.startsWith('XAU') || activeSymbol.startsWith('XAG') ? 'Binance/Bybit' : 'Yahoo Finance'}
          </div>

          {/* ── Broker Price Offset Input ── */}
          <div className="flex items-center gap-1.5" title={t('brokerOffsetNotice')}>
            <input
              type="text"
              placeholder={t('offsetPlaceholder')}
              value={manualOffset}
              onChange={(e) => {
                const val = e.target.value;
                setManualOffset(val);
                localStorage.setItem(`chart_offset_${activeSymbol}`, val);
              }}
              className={`w-28 px-2 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-1 ${
                theme === 'light'
                  ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 hover:border-slate-400 focus:ring-emerald-400'
                  : 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 hover:border-slate-500 focus:ring-emerald-500'
              }`}
            />
          </div>

          {/* Candle Color Mode Switcher */}
          <div className={`flex items-center p-1 rounded-xl border text-xs font-semibold ${
            theme === 'light' ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'
          }`}>
            <button
              onClick={() => setCandleColorMode('user_screenshot')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] font-bold flex items-center gap-1.5 ${
                candleColorMode === 'user_screenshot'
                  ? theme === 'light' ? 'bg-white text-slate-950 shadow border border-slate-300' : 'bg-slate-800 text-white shadow border border-slate-700'
                  : theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
              title={t('tvMonoTheme')}
            >
              <ImageIcon className={`w-3 h-3 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`} />
              <span>{t('tvMonoTheme')}</span>
            </button>

            <button
              onClick={() => setCandleColorMode('tradingview_classic')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] font-bold flex items-center gap-1.5 ${
                candleColorMode === 'tradingview_classic'
                  ? theme === 'light' ? 'bg-white text-slate-950 shadow border border-slate-300' : 'bg-slate-800 text-white shadow border border-slate-700'
                  : theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
              title={t('tvClassicTheme')}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#26a69a] border border-[#ef5350] inline-block" />
              <span>{t('tvClassicTheme')}</span>
            </button>
          </div>

          {/* Indicators Button */}
          <div className="relative">
            <button
              onClick={() => setIsIndicatorsMenuOpen(!isIndicatorsMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isIndicatorsMenuOpen
                  ? theme === 'light' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                  : theme === 'light' ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Chỉ báo</span>
            </button>
            {isIndicatorsMenuOpen && (
              <div className={`absolute top-full left-0 mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden ${
                theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'
              }`}>
                <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b ${theme === 'light' ? 'text-slate-500 border-slate-100' : 'text-slate-400 border-slate-700/50'}`}>
                  Đường trung bình (EMA)
                </div>
                <div className="flex flex-col py-1">
                  <button
                    onClick={() => addIndicator('EMA', 9, '#2962FF')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    Moving Average Exponential
                  </button>
                  <button
                    onClick={() => addIndicator('SMA', 9, '#9C27B0')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    Moving Average Simple
                  </button>
                  <button
                    onClick={() => addIndicator('RSI', 14, '#7E57C2')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    Relative Strength Index
                  </button>
                  <button
                    onClick={() => addIndicator('BB', 20, '#FF9800')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    Bollinger Bands
                  </button>
                  <button
                    onClick={() => addIndicator('MACD', 0, 'transparent')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    MACD
                  </button>
                  <button
                    onClick={() => addIndicator('Stoch', 14, '#2962FF')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    Stochastic Oscillator
                  </button>
                  <button
                    onClick={() => addIndicator('ATR', 14, '#E91E63')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    Average True Range (ATR)
                  </button>
                  <button
                    onClick={() => addIndicator('Volume', 0, 'transparent')}
                    className={`text-left px-4 py-2 text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-500 transition cursor-pointer ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    Khối lượng (Volume)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeframe switch */}
          <div className={`flex items-center p-1 rounded-xl border text-xs font-semibold ${
            theme === 'light' ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'
          }`}>
            {['1', '5', '15', '60', '240', 'D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setIntervalState(tf)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] font-bold ${
                  interval === tf
                    ? theme === 'light' ? 'bg-white text-slate-950 shadow border border-slate-300' : 'bg-emerald-500 text-slate-950 shadow'
                    : theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf === 'D' ? '1D' : `${tf}m`}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              theme === 'light' ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
            title={isFullscreen ? t('minimize') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {selectedTrades.length === 1 && (
            <>
              <button
                onClick={async () => {
                  if (drawingOverlayRef.current) {
                    setIsSavingDrawings(true);
                    const success = await drawingOverlayRef.current.saveDrawingsToBackend();
                    setIsSavingDrawings(false);
                    if (success) alert(t('drawingsSaved') || 'Đã lưu bản vẽ thành công!');
                    else alert(t('saveDrawingsError') || 'Lỗi khi lưu bản vẽ.');
                  }
                }}
                disabled={isSavingDrawings}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition shadow-sm ${
                  isSavingDrawings 
                    ? 'bg-slate-400 text-white cursor-wait'
                    : theme === 'light' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
                title="Lưu các bản vẽ hiện tại vào cơ sở dữ liệu"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingDrawings ? (t('saving') || 'Đang lưu...') : (t('saveDrawings') || 'Lưu bản vẽ')}</span>
              </button>

              <button
                onClick={handleCaptureAndSave}
                disabled={isSavingAnalysis}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition shadow-sm ${
                  isSavingAnalysis 
                    ? 'bg-slate-400 text-white cursor-wait'
                    : theme === 'light' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
                title={t('captureAndSaveNotice')}
              >
                <Save className="w-4 h-4" />
                <span>{isSavingAnalysis ? (t('saving') || 'Đang lưu...') : (t('saveAnalysis') || 'Chụp Ảnh')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {tradeToAutoCapture && (
        <HiddenChartGenerator 
          trade={tradeToAutoCapture} 
          onComplete={async (urls, error) => {
            if (urls && urls.length > 0) {
              try {
                // Parse existing images
                let existing = [];
                if (tradeToAutoCapture.image_url) {
                  try {
                    const parsed = JSON.parse(tradeToAutoCapture.image_url);
                    if (Array.isArray(parsed)) existing = parsed;
                  } catch (e) {
                    if (typeof tradeToAutoCapture.image_url === 'string' && tradeToAutoCapture.image_url.startsWith('http')) {
                      existing = [tradeToAutoCapture.image_url];
                    }
                  }
                }
                
                // Lọc bỏ các ảnh auto-gen cũ của lệnh này để tránh bị trùng lặp khi bấm tạo lại nhiều lần
                const filteredExisting = existing.filter(url => !url.includes(`_trade_${tradeToAutoCapture.id}_`));
                
                // Gộp ảnh cũ (upload tay) và ảnh auto-gen mới
                const newImagesList = [...filteredExisting, ...urls];
                
                // Update trade in DB
                await fetch('/api/trades', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: tradeToAutoCapture.id, image_url: JSON.stringify(newImagesList) })
                });
                
                alert(t('autoGenSuccess', { count: urls.length }));
              } catch (err) {
                alert(t('autoGenErrorSave', { error: err.message }));
              }
            } else if (error) {
              if (error === 'No files generated') {
                alert(t('autoGenFailOld'));
              } else {
                alert(t('autoGenFailErr', { error }));
              }
            }
            setTradeToAutoCapture(null);
          }}
        />
      )}

      {/* Interactive Candlestick Chart 100% Height */}
      <div className="relative w-full flex-1 min-h-[350px]">
        {/* Active Indicators Legend */}
        {activeIndicators.length > 0 && (
          <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-1 pointer-events-none">
            {activeIndicators.map(ind => (
              <div key={ind.id} className={`flex items-center gap-2 text-[11px] font-bold group pointer-events-auto px-2 py-0.5 rounded transition-all duration-200 backdrop-blur-sm ${
                theme === 'light' ? 'bg-slate-100/60 hover:bg-slate-200/80' : 'bg-slate-900/40 hover:bg-slate-800/80'
              }`}>
                {ind.type === 'Volume' ? (
                  <span className="drop-shadow-sm text-slate-400">Volume</span>
                ) : ind.type === 'MACD' ? (
                  <span className="drop-shadow-sm text-slate-400">MACD 12 26 close 9</span>
                ) : ind.type === 'Stoch' ? (
                  <span className="drop-shadow-sm text-slate-400">Stoch 14 1 3</span>
                ) : ind.type === 'BB' ? (
                  <span className="drop-shadow-sm text-slate-400">BB 20 2 close 0</span>
                ) : ind.type === 'ATR' ? (
                  <span className="drop-shadow-sm text-slate-400">ATR 14</span>
                ) : (
                  <span className="drop-shadow-sm" style={{ color: ind.color }}>{ind.type} {ind.length}</span>
                )}
                <div className="hidden group-hover:flex items-center gap-1">
                  <button onClick={() => toggleIndicatorVisibility(ind.id)} className={`p-0.5 rounded hover:bg-white/20 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`} title="Ẩn/Hiện">
                    <Eye className={`w-3.5 h-3.5 ${!ind.visible && 'opacity-30'}`} />
                  </button>
                  {ind.type !== 'Volume' && ind.type !== 'MACD' && ind.type !== 'BB' && ind.type !== 'Stoch' && ind.type !== 'ATR' && (
                    <button onClick={() => setIndicatorConfig(activeIndicators.find(i => i.id === ind.id))} className={`p-0.5 rounded hover:bg-white/20 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`} title="Cài đặt">
                      <Settings className="w-3 h-3" />
                    </button>
                  )}
                  <button onClick={() => removeIndicator(ind.id)} className={`p-0.5 rounded hover:bg-white/20 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`} title="Xóa">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTrades.length === 1 && (
          <DrawingToolbar activeTool={activeTool} setActiveTool={setActiveTool} theme={theme} />
        )}
        
        <div ref={chartContainerRef} className="w-full h-full" />
        <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
        
        {chartObj && seriesObj && (
          <DrawingOverlay 
            ref={drawingOverlayRef}
            chartContainerRef={chartContainerRef}
            chart={chartObj}
            series={seriesObj}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            tradeId={selectedTrades.length === 1 ? selectedTrades[0].id : null}
            initialDrawingsData={selectedTrades.length === 1 ? selectedTrades[0].drawings_data : null}
            chartData={rawCandlesDataRef.current}
          />
        )}

        {isLoadingFeed && (
          <div className={`absolute inset-0 z-20 backdrop-blur-sm flex items-center justify-center ${
            theme === 'light' ? 'bg-white/75 text-slate-800' : 'bg-[#12151e]/75 text-slate-300'
          }`}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>{t('loadingHistoricalCandles')}</span>
            </div>
          </div>
        )}

        {isFetchingOlder && !isLoadingFeed && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 border px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-bounce ${
            theme === 'light'
              ? 'bg-white/90 border-slate-300 text-emerald-700'
              : 'bg-slate-900/90 border-slate-700 text-emerald-400'
          }`}>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{t('loadingOlderCandles')}</span>
          </div>
        )}

        {selectedTrades.length === 0 && !isLoadingFeed && (
          <div className={`absolute bottom-6 left-6 z-10 backdrop-blur-md border p-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs pointer-events-none ${
            theme === 'light' ? 'bg-white/90 border-slate-300 text-slate-800' : 'bg-[#181c28]/90 border-white/10 text-slate-300'
          }`}>
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>{t('selectTradeHint')}</span>
          </div>
        )}

        {indicatorConfig && (() => {
          return (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 p-4 rounded-xl shadow-2xl border min-w-[280px] pointer-events-auto ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm">Cài đặt {indicatorConfig.type}</h3>
                <button onClick={() => setIndicatorConfig(null)} className="p-1 rounded hover:bg-slate-500/20">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 opacity-80">Chu kỳ (Length)</label>
                  <input 
                    type="number" 
                    value={indicatorConfig.length} 
                    onChange={(e) => setIndicatorConfig(prev => ({ ...prev, length: e.target.value }))}
                    className={`w-full px-2 py-1.5 rounded-lg border text-sm ${
                      theme === 'light' ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-600 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 opacity-80">Màu sắc (Color)</label>
                  <input 
                    type="color" 
                    value={indicatorConfig.color} 
                    onChange={(e) => setIndicatorConfig(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="mt-5 text-right">
                <button 
                  onClick={() => {
                    updateIndicator(indicatorConfig.id, { 
                      length: parseInt(indicatorConfig.length) || 9, 
                      color: indicatorConfig.color 
                    });
                    setIndicatorConfig(null);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition"
                >
                  OK
                </button>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
