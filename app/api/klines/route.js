import { NextResponse } from 'next/server';

// ─── Symbol Configuration ──────────────────────────────────────────────────────
// Defines routing strategy per asset
const SYMBOL_CONFIG = {
  // ── Metals via Binance/Bybit index + Swissquote calibration ──
  XAUUSD: { type: 'metal', binancePair: 'XAUUSDT', bybitSymbol: 'XAUUSDT', calibrate: true,  precision: 2 },
  XAGUSD: { type: 'metal', binancePair: 'XAGUSDT', bybitSymbol: 'XAGUSDT', calibrate: false, precision: 4 },

  // ── Forex Majors via Yahoo Finance (primary) + Binance spot (fallback) ──
  EURUSD: { type: 'forex', yahooSymbol: 'EURUSD=X', binanceSpot: 'EURUSDT', precision: 5 },
  GBPUSD: { type: 'forex', yahooSymbol: 'GBPUSD=X', binanceSpot: 'GBPUSDT', precision: 5 },
  USDJPY: { type: 'forex', yahooSymbol: 'USDJPY=X', binanceSpot: null,       precision: 3 },
  GBPJPY: { type: 'forex', yahooSymbol: 'GBPJPY=X', binanceSpot: null,       precision: 3 },
  AUDUSD: { type: 'forex', yahooSymbol: 'AUDUSD=X', binanceSpot: null,       precision: 5 },
  USDCAD: { type: 'forex', yahooSymbol: 'USDCAD=X', binanceSpot: null,       precision: 5 },
  USDCHF: { type: 'forex', yahooSymbol: 'USDCHF=X', binanceSpot: null,       precision: 5 },
  NZDUSD: { type: 'forex', yahooSymbol: 'NZDUSD=X', binanceSpot: null,       precision: 5 },
  EURGBP: { type: 'forex', yahooSymbol: 'EURGBP=X', binanceSpot: null,       precision: 5 },
  EURJPY: { type: 'forex', yahooSymbol: 'EURJPY=X', binanceSpot: null,       precision: 3 },
};

// ─── Interval mapping ─────────────────────────────────────────────────────────
function mapInterval(interval, provider = 'binance') {
  const str = String(interval).trim().toLowerCase();
  let key = str;
  if      (str === '1m'  || str === '1')   key = '1';
  else if (str === '3m'  || str === '3')   key = '3';
  else if (str === '5m'  || str === '5')   key = '5';
  else if (str === '15m' || str === '15')  key = '15';
  else if (str === '30m' || str === '30')  key = '30';
  else if (str === '1h'  || str === '60m'  || str === '60')  key = '60';
  else if (str === '4h'  || str === '240m' || str === '240') key = '240';
  else if (str === '1d'  || str === 'd')   key = 'D';

  if (provider === 'bybit') {
    const map = { '1':'1','3':'3','5':'5','15':'15','30':'30','60':'60','240':'240','D':'D' };
    return map[key] || '5';
  }
  if (provider === 'yahoo') {
    // Yahoo Finance supports: 1m, 2m, 5m, 15m, 30m, 1h, 1d
    const map = { '1':'1m','3':'5m','5':'5m','15':'15m','30':'30m','60':'1h','240':'1h','D':'1d' };
    return map[key] || '1h';
  }
  // Binance
  const map = { '1':'1m','3':'3m','5':'5m','15':'15m','30':'30m','60':'1h','240':'4h','D':'1d' };
  return map[key] || '5m';
}

// ─── Stable Calibration Offset Cache ─────────────────────────────────────────
// The structural gap between crypto-exchange indexes (Binance indexPriceKlines)
// and interbank OTC pricing (Oanda, Swissquote, IC Markets) is ~4–6 USD.
//
// Problem: computing offset from two live snapshots every request causes ±1–2 USD
// jitter because both prices tick independently between requests.
//
// Solution: cache the offset for CACHE_TTL_MS and AVERAGE N_SAMPLES consecutive
// Swissquote−Binance readings to smooth noise. This produces a stable offset that
// only drifts slowly with genuine market structure changes.
//
// TTL = 5 minutes: short enough to track slow structural changes, long enough
// to prevent per-refresh jitter.
const CACHE_TTL_MS   = 5 * 60 * 1000; // 5 minutes per cache cycle
const N_SAMPLES      = 3;             // average N readings on each cache refresh
const EMA_NEW_WEIGHT = 0.7;           // blend: 70% new + 30% previous → smooth transitions

let offsetCache = {
  value:     null,   // cached offset (USD)
  sqMid:     null,   // Swissquote mid at last calibration
  binClose:  null,   // Binance 1m close at last calibration
  expiresAt: 0,      // epoch ms when cache expires
};

// Fetch a single (Swissquote mid, Binance 1m close) pair
async function fetchSingleCalibrationSample() {
  const [sqRes, binRes] = await Promise.allSettled([
    fetch(
      'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD',
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    ).then(r => r.ok ? r.json() : Promise.reject('sq_not_ok')),

    fetch(
      'https://fapi.binance.com/fapi/v1/indexPriceKlines?pair=XAUUSDT&interval=1m&limit=1',
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    ).then(r => r.ok ? r.json() : Promise.reject('bin_not_ok')),
  ]);

  const sqJson  = sqRes.status  === 'fulfilled' ? sqRes.value  : null;
  const binJson = binRes.status === 'fulfilled' ? binRes.value : null;

  const profile = sqJson?.[0]?.spreadProfilePrices?.find(p => p.spreadProfile === 'premium')
               ?? sqJson?.[0]?.spreadProfilePrices?.[0];
  const sqMid   = (profile?.bid && profile?.ask) ? (profile.bid + profile.ask) / 2 : null;
  const binClose = Array.isArray(binJson) && binJson.length > 0
    ? parseFloat(binJson[binJson.length - 1][4])
    : null;

  if (sqMid && binClose && isFinite(sqMid) && isFinite(binClose)) {
    return { offset: sqMid - binClose, sqMid, binClose };
  }
  return null;
}

// Get a stable, cached calibration offset.
// On cache miss: takes N_SAMPLES readings and averages them, then caches for TTL.
async function getStableCalibrationOffset() {
  const now = Date.now();
  if (offsetCache.value !== null && now < offsetCache.expiresAt) {
    // Cache hit — return stable cached value
    return offsetCache;
  }

  // Cache miss — compute fresh offset using averaged samples
  try {
    const samples = [];
    for (let i = 0; i < N_SAMPLES; i++) {
      const s = await fetchSingleCalibrationSample();
      if (s) samples.push(s);
      // Small pause between samples to catch slightly different tick values
      if (i < N_SAMPLES - 1) await new Promise(r => setTimeout(r, 250));
    }

    if (samples.length === 0) {
      return { value: offsetCache.value ?? 0, sqMid: null, binClose: null };
    }

    const avgOffset   = samples.reduce((a, s) => a + s.offset,   0) / samples.length;
    const avgSqMid    = samples.reduce((a, s) => a + s.sqMid,    0) / samples.length;
    const avgBinClose = samples.reduce((a, s) => a + s.binClose, 0) / samples.length;

    // Reject if implausibly large (market closed, data glitch, or weekend gap)
    if (Math.abs(avgOffset) > 15) {
      console.warn(`[klines] Offset out of range (${avgOffset.toFixed(2)} USD) — keeping previous`);
      return { value: offsetCache.value ?? 0, sqMid: null, binClose: null };
    }

    // EMA blend: 70% new + 30% previous — smooths jumps across cache cycles
    // (e.g. server restart or gradual structural drift)
    const prevOffset  = offsetCache.value ?? avgOffset;
    const blended     = EMA_NEW_WEIGHT * avgOffset + (1 - EMA_NEW_WEIGHT) * prevOffset;
    // Round to 0.01 precision — eliminates sub-cent noise
    const stableOffset = Math.round(blended * 100) / 100;

    offsetCache = {
      value:     stableOffset,
      sqMid:     Math.round(avgSqMid    * 100) / 100,
      binClose:  Math.round(avgBinClose * 100) / 100,
      expiresAt: now + CACHE_TTL_MS,
    };

    console.log(`[klines] Calibration refreshed: offset=${stableOffset.toFixed(2)} USD (raw=${avgOffset.toFixed(2)}, prev=${prevOffset.toFixed(2)}, sq=${avgSqMid.toFixed(2)}, bin=${avgBinClose.toFixed(2)}, samples=${samples.length})`);
    return offsetCache;

  } catch (e) {
    console.error('[klines] Calibration error:', e);
    return { value: offsetCache.value ?? 0, sqMid: null, binClose: null };
  }
}

// ─── SOURCE 1: Binance Index Price Klines (metals: XAUUSDT, XAGUSDT) ─────────
async function fetchBinanceIndexKlines(binancePair, interval, startTime, endTime, limit) {
  const binanceInterval = mapInterval(interval, 'binance');
  const safeLimit = Math.min(parseInt(limit) || 1000, 1000);
  let query = `pair=${binancePair}&interval=${binanceInterval}&limit=${safeLimit}`;
  if (startTime) query += `&startTime=${startTime}`;
  if (endTime)   query += `&endTime=${endTime}`;

  const hosts = ['https://fapi.binance.com', 'https://fapi1.binance.com', 'https://fapi2.binance.com'];
  for (const host of hosts) {
    try {
      const res = await fetch(`${host}/fapi/v1/indexPriceKlines?${query}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 15 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data
          .map(d => {
            const open = parseFloat(d[1]);
            const high = parseFloat(d[2]);
            const low = parseFloat(d[3]);
            const close = parseFloat(d[4]);
            const rawVol = parseFloat(d[5]);
            // Use raw volume if > 0, else estimate tick volume from volatility
            const vol = rawVol > 0 ? rawVol : Math.abs(high - low) * 1000;
            return {
              time:  Math.floor(d[0] / 1000),
              open, high, low, close,
              volume: vol
            };
          })
          .sort((a, b) => a.time - b.time);
      }
    } catch (_) { /* try next host */ }
  }
  return null;
}

// ─── SOURCE 2 (Fallback): Bybit Index Price Klines (metals) ──────────────────
async function fetchBybitIndexKlines(bybitSymbol, interval, startTime, endTime, limit) {
  const bybitInterval = mapInterval(interval, 'bybit');
  const safeLimit = Math.min(parseInt(limit) || 1000, 1000);
  let url = `https://api.bybit.com/v5/market/index-price-kline?category=linear&symbol=${bybitSymbol}&interval=${bybitInterval}&limit=${safeLimit}`;
  if (startTime) url += `&start=${startTime}`;
  if (endTime)   url += `&end=${endTime}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.retCode === 0 && Array.isArray(json.result?.list) && json.result.list.length > 0) {
      return json.result.list
        .map(item => {
          const open = parseFloat(item[1]);
          const high = parseFloat(item[2]);
          const low = parseFloat(item[3]);
          const close = parseFloat(item[4]);
          const rawVol = parseFloat(item[5]);
          const vol = rawVol > 0 ? rawVol : Math.abs(high - low) * 1000;
          return {
            time:  Math.floor(parseInt(item[0], 10) / 1000),
            open, high, low, close,
            volume: vol
          };
        })
        .sort((a, b) => a.time - b.time);
    }
  } catch (_) { /* fall through */ }
  return null;
}

// ─── SOURCE 3: Yahoo Finance OHLCV Klines (Forex primary) ────────────────────
async function fetchYahooKlines(yahooSymbol, interval, startTime, endTime) {
  const yahooInterval = mapInterval(interval, 'yahoo');

  let url;
  if (startTime || endTime) {
    const p1 = startTime ? Math.floor(parseInt(startTime) / 1000) : Math.floor(Date.now() / 1000) - 7 * 86400;
    const p2 = endTime   ? Math.floor(parseInt(endTime)   / 1000) : Math.floor(Date.now() / 1000);
    // Buffer ±3 days around the target range so trades near boundaries have candle context
    const bufferSec = 3 * 86400;
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${p1 - bufferSec}&period2=${p2 + bufferSec}&interval=${yahooInterval}`;
  } else {
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${yahooInterval}&range=5d`;
  }

  // Try query1 then query2 mirror
  const mirrors = [
    url,
    url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com'),
  ];

  for (const mirrorUrl of mirrors) {
    try {
      const res = await fetch(mirrorUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const json = await res.json();

      const result = json?.chart?.result?.[0];
      if (!result) continue;

      const timestamps = result.timestamp;
      const q = result.indicators?.quote?.[0];
      if (!timestamps || !q || !q.open || !q.high || !q.low || !q.close) continue;

      const candles = [];
      for (let i = 0; i < timestamps.length; i++) {
        const o = q.open[i];
        const h = q.high[i];
        const l = q.low[i];
        const c = q.close[i];
        const v = q.volume?.[i] || 0;
        if (o == null || h == null || l == null || c == null) continue;
        if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
        candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c, volume: v });
      }

      if (candles.length > 0) {
        candles.sort((a, b) => a.time - b.time);
        return candles;
      }
    } catch (_) { /* try next mirror */ }
  }
  return null;
}

// ─── SOURCE 4: Binance Spot Klines (Forex fallback for EURUSDT, GBPUSDT) ──────
async function fetchBinanceSpotKlines(spotSymbol, interval, startTime, endTime, limit) {
  const binanceInterval = mapInterval(interval, 'binance');
  const safeLimit = Math.min(parseInt(limit) || 1000, 1000);
  let query = `symbol=${spotSymbol}&interval=${binanceInterval}&limit=${safeLimit}`;
  if (startTime) query += `&startTime=${startTime}`;
  if (endTime)   query += `&endTime=${endTime}`;

  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?${query}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data
        .map(d => ({
          time:  Math.floor(d[0] / 1000),
          open:  parseFloat(d[1]),
          high:  parseFloat(d[2]),
          low:   parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]) || 0,
        }))
        .sort((a, b) => a.time - b.time);
    }
  } catch (_) { /* fall through */ }
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = (searchParams.get('symbol') || 'XAUUSD').toUpperCase().trim();
    const interval  = searchParams.get('interval') || '5m';
    const limit     = parseInt(searchParams.get('limit') || '1000');
    const startTime = searchParams.get('startTime');
    const endTime   = searchParams.get('endTime');

    // Resolve symbol config (default to XAUUSD for unknown symbols)
    const symbolKey = Object.keys(SYMBOL_CONFIG).find(k => k === rawSymbol) || 'XAUUSD';
    const cfg = SYMBOL_CONFIG[symbolKey];

    // ── Metal path (XAUUSD, XAGUSD): Binance/Bybit index + Swissquote calib ──
    if (cfg.type === 'metal') {
      const [candleResult, calibResult] = await Promise.allSettled([
        (async () => {
          let candles = await fetchBinanceIndexKlines(cfg.binancePair, interval, startTime, endTime, limit);
          if (candles?.length > 0) return { candles, provider: 'binance_index' };
          candles = await fetchBybitIndexKlines(cfg.bybitSymbol, interval, startTime, endTime, limit);
          if (candles?.length > 0) return { candles, provider: 'bybit_index' };
          return null;
        })(),
        cfg.calibrate ? getStableCalibrationOffset() : Promise.resolve({ value: 0, sqMid: null, binClose: null }),
      ]);

      const candleData = candleResult.status === 'fulfilled' ? candleResult.value : null;
      if (!candleData?.candles?.length) {
        return NextResponse.json(
          { error: `Failed to fetch ${symbolKey} candles from all providers` },
          { status: 502 }
        );
      }

      const { candles, provider: providerUsed } = candleData;
      const calibration = calibResult.status === 'fulfilled'
        ? calibResult.value
        : { value: 0, sqMid: null, binClose: null };
      const calibrationOffset = (cfg.calibrate ? calibration.value : 0) ?? 0;

      const seenTimes = new Set();
      const uniqueCandles = [];
      for (const c of candles) {
        if (!seenTimes.has(c.time) && isFinite(c.time) && isFinite(c.open)) {
          seenTimes.add(c.time);
          uniqueCandles.push(
            calibrationOffset !== 0
              ? {
                  time:  c.time,
                  open:  parseFloat((c.open  + calibrationOffset).toFixed(cfg.precision)),
                  high:  parseFloat((c.high  + calibrationOffset).toFixed(cfg.precision)),
                  low:   parseFloat((c.low   + calibrationOffset).toFixed(cfg.precision)),
                  close: parseFloat((c.close + calibrationOffset).toFixed(cfg.precision)),
                  volume: c.volume || 0,
                }
              : c
          );
        }
      }
      uniqueCandles.sort((a, b) => a.time - b.time);

      return NextResponse.json({
        success: true,
        symbol:  symbolKey,
        provider: providerUsed,
        calibration: {
          source:        calibrationOffset !== 0 ? 'swissquote_interbank_cached' : 'none',
          offsetUsd:     calibrationOffset,
          swissquoteMid: calibration.sqMid    ?? null,
          binanceLatest: calibration.binClose ?? null,
          cacheExpiresAt: new Date(offsetCache.expiresAt).toISOString(),
        },
        interval,
        count: uniqueCandles.length,
        data:  uniqueCandles,
      });
    }

    // ── Forex path (EURUSD, GBPUSD, USDJPY, etc.): Yahoo Finance + Binance spot fallback ──
    if (cfg.type === 'forex') {
      let candles = await fetchYahooKlines(cfg.yahooSymbol, interval, startTime, endTime);
      let providerUsed = 'yahoo_finance';

      if ((!candles || candles.length === 0) && cfg.binanceSpot) {
        candles = await fetchBinanceSpotKlines(cfg.binanceSpot, interval, startTime, endTime, limit);
        providerUsed = 'binance_spot';
      }

      if (!candles || candles.length === 0) {
        return NextResponse.json(
          { error: `Failed to fetch ${symbolKey} candles from all providers` },
          { status: 502 }
        );
      }

      const seenTimes = new Set();
      const uniqueCandles = [];
      for (const c of candles) {
        if (!seenTimes.has(c.time) && isFinite(c.time) && isFinite(c.open)) {
          seenTimes.add(c.time);
          uniqueCandles.push({
            time:  c.time,
            open:  parseFloat(c.open.toFixed(cfg.precision)),
            high:  parseFloat(c.high.toFixed(cfg.precision)),
            low:   parseFloat(c.low.toFixed(cfg.precision)),
            close: parseFloat(c.close.toFixed(cfg.precision)),
            volume: c.volume || 0,
          });
        }
      }
      uniqueCandles.sort((a, b) => a.time - b.time);

      return NextResponse.json({
        success: true,
        symbol:  symbolKey,
        provider: providerUsed,
        calibration: { source: 'none', offsetUsd: 0 },
        interval,
        count: uniqueCandles.length,
        data:  uniqueCandles,
      });
    }

    return NextResponse.json({ error: 'Unknown symbol type' }, { status: 400 });

  } catch (error) {
    console.error('Error in /api/klines:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
