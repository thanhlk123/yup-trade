import { NextResponse } from 'next/server';

// ─── Symbol Configuration ──────────────────────────────────────────────────────
// Defines routing strategy per asset
const SYMBOL_CONFIG = {
  // ── Metals via Binance/Bybit index ──
  XAUUSD: { type: 'metal', binancePair: 'XAUUSDT', bybitSymbol: 'XAUUSDT', precision: 2 },
  XAGUSD: { type: 'metal', binancePair: 'XAGUSDT', bybitSymbol: 'XAGUSDT', precision: 4 },

  // ── Forex Majors & Minors ──
  EURUSD: { type: 'forex', yahooSymbol: 'EURUSD=X', binanceSpot: 'EURUSDT', precision: 5 },
  GBPUSD: { type: 'forex', yahooSymbol: 'GBPUSD=X', binanceSpot: 'GBPUSDT', precision: 5 },
  USDJPY: { type: 'forex', yahooSymbol: 'USDJPY=X', precision: 3 },
  GBPJPY: { type: 'forex', yahooSymbol: 'GBPJPY=X', precision: 3 },
  AUDUSD: { type: 'forex', yahooSymbol: 'AUDUSD=X', precision: 5 },
  USDCAD: { type: 'forex', yahooSymbol: 'CAD=X', precision: 5 },
  USDCHF: { type: 'forex', yahooSymbol: 'CHF=X', precision: 5 },
  NZDUSD: { type: 'forex', yahooSymbol: 'NZDUSD=X', precision: 5 },
  EURGBP: { type: 'forex', yahooSymbol: 'EURGBP=X', precision: 5 },
  EURJPY: { type: 'forex', yahooSymbol: 'EURJPY=X', precision: 3 },
  EURCHF: { type: 'forex', yahooSymbol: 'EURCHF=X', precision: 5 },
  EURAUD: { type: 'forex', yahooSymbol: 'EURAUD=X', precision: 5 },
  EURNZD: { type: 'forex', yahooSymbol: 'EURNZD=X', precision: 5 },
  EURCAD: { type: 'forex', yahooSymbol: 'EURCAD=X', precision: 5 },
  GBPCHF: { type: 'forex', yahooSymbol: 'GBPCHF=X', precision: 5 },
  GBPAUD: { type: 'forex', yahooSymbol: 'GBPAUD=X', precision: 5 },
  GBPNZD: { type: 'forex', yahooSymbol: 'GBPNZD=X', precision: 5 },
  GBPCAD: { type: 'forex', yahooSymbol: 'GBPCAD=X', precision: 5 },
  AUDJPY: { type: 'forex', yahooSymbol: 'AUDJPY=X', precision: 3 },
  AUDCHF: { type: 'forex', yahooSymbol: 'AUDCHF=X', precision: 5 },
  AUDCAD: { type: 'forex', yahooSymbol: 'AUDCAD=X', precision: 5 },
  AUDNZD: { type: 'forex', yahooSymbol: 'AUDNZD=X', precision: 5 },
  NZDJPY: { type: 'forex', yahooSymbol: 'NZDJPY=X', precision: 3 },
  NZDCHF: { type: 'forex', yahooSymbol: 'NZDCHF=X', precision: 5 },
  NZDCAD: { type: 'forex', yahooSymbol: 'NZDCAD=X', precision: 5 },
  CADJPY: { type: 'forex', yahooSymbol: 'CADJPY=X', precision: 3 },
  CADCHF: { type: 'forex', yahooSymbol: 'CADCHF=X', precision: 5 },
  CHFJPY: { type: 'forex', yahooSymbol: 'CHFJPY=X', precision: 3 },

  // ── Indices ──
  US30:   { type: 'forex', yahooSymbol: '^DJI', precision: 1 },
  NAS100: { type: 'forex', yahooSymbol: '^IXIC', precision: 1 },
  SPX500: { type: 'forex', yahooSymbol: '^GSPC', precision: 1 },
  GER40:  { type: 'forex', yahooSymbol: '^GDAXI', precision: 1 },
  UK100:  { type: 'forex', yahooSymbol: '^FTSE', precision: 1 },
  JPN225: { type: 'forex', yahooSymbol: '^N225', precision: 1 },
  AUS200: { type: 'forex', yahooSymbol: '^AXJO', precision: 1 },

  // ── Commodities ──
  USOIL:  { type: 'forex', yahooSymbol: 'CL=F', precision: 3 },
  UKOIL:  { type: 'forex', yahooSymbol: 'BZ=F', precision: 3 },

  // ── Crypto ──
  BTCUSD: { type: 'forex', yahooSymbol: 'BTC-USD', binanceSpot: 'BTCUSDT', precision: 2 },
  ETHUSD: { type: 'forex', yahooSymbol: 'ETH-USD', binanceSpot: 'ETHUSDT', precision: 2 },

  // ── Stocks (US) ──
  AAPL:   { type: 'forex', yahooSymbol: 'AAPL', precision: 2 },
  TSLA:   { type: 'forex', yahooSymbol: 'TSLA', precision: 2 },
  AMZN:   { type: 'forex', yahooSymbol: 'AMZN', precision: 2 },
  NVDA:   { type: 'forex', yahooSymbol: 'NVDA', precision: 2 },
  MSFT:   { type: 'forex', yahooSymbol: 'MSFT', precision: 2 },
  META:   { type: 'forex', yahooSymbol: 'META', precision: 2 },
  GOOGL:  { type: 'forex', yahooSymbol: 'GOOGL', precision: 2 },
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


// ─── SOURCE: Tiingo FX/Crypto ──────────────────────────────────────────────────
async function fetchTiingoKlines(symbol, interval, startTime, endTime) {
  const tiingoIntervalMap = { '1m': '1min', '3m': '3min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1hour', '4h': '4hour', '1d': '1day' };
  const str = String(interval).trim().toLowerCase();
  let key = str;
  if      (str === '1m'  || str === '1')   key = '1m';
  else if (str === '3m'  || str === '3')   key = '3m';
  else if (str === '5m'  || str === '5')   key = '5m';
  else if (str === '15m' || str === '15')  key = '15m';
  else if (str === '30m' || str === '30')  key = '30m';
  else if (str === '1h'  || str === '60m'  || str === '60')  key = '1h';
  else if (str === '4h'  || str === '240m' || str === '240') key = '4h';
  else if (str === '1d'  || str === 'd')   key = '1d';
  
  const resampleFreq = tiingoIntervalMap[key] || '5min';
  const tiingoSymbol = symbol.toLowerCase();
  const envKeys = [
    process.env.TIINGO_API_KEY,
    process.env.TIINGO_API_KEY_2,
    process.env.TIINGO_API_KEY_3
  ].filter(Boolean);
  const apiKeys = envKeys.length > 0 ? envKeys : ['fe7e2330a3175b6831505e791229ac3350743181', 'cfc86eb31270ea16e1da688d9014d3c5a61bd78f', '6173ba326527fe6782ff56ca75536d6c5c6b83a0'];
  
  for (const apiKey of apiKeys) {
    let url = `https://api.tiingo.com/tiingo/fx/${tiingoSymbol}/prices?resampleFreq=${resampleFreq}&token=${apiKey}`;
    
    if (startTime) {
      url += `&startDate=${new Date(parseInt(startTime)).toISOString()}`;
    }
    if (endTime) {
      url += `&endDate=${new Date(parseInt(endTime)).toISOString()}`;
    }

    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, next: { revalidate: 15 } });
      if (!res.ok) {
        if (res.status === 429) continue;
        continue;
      }
      const data = await res.json();
      // Detail response error
      if (data.detail && typeof data.detail === 'string' && data.detail.includes('limit')) {
        continue;
      }
      if (Array.isArray(data) && data.length > 0) {
        return data.map(d => ({
          time: Math.floor(new Date(d.date).getTime() / 1000),
          open: parseFloat(d.open),
          high: parseFloat(d.high),
          low: parseFloat(d.low),
          close: parseFloat(d.close),
          volume: 0
        })).sort((a, b) => a.time - b.time);
      }
      if (Array.isArray(data)) return [];
    } catch (e) {
      console.error('Tiingo fetch error:', e);
    }
  }
  return null;
}

// ─── SOURCE: TwelveData ────────────────────────────────────────────────────────
async function fetchTwelveDataKlines(symbol, interval, limit) {
  const tdIntervalMap = { '1m': '1min', '3m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1h', '4h': '4h', '1d': '1day' };
  const str = String(interval).trim().toLowerCase();
  let key = str;
  if      (str === '1m'  || str === '1')   key = '1m';
  else if (str === '3m'  || str === '3')   key = '1m';
  else if (str === '5m'  || str === '5')   key = '5m';
  else if (str === '15m' || str === '15')  key = '15m';
  else if (str === '30m' || str === '30')  key = '30m';
  else if (str === '1h'  || str === '60m'  || str === '60')  key = '1h';
  else if (str === '4h'  || str === '240m' || str === '240') key = '4h';
  else if (str === '1d'  || str === 'd')   key = '1d';
  
  const tdInterval = tdIntervalMap[key] || '5min';
  let tdSymbol = symbol;
  if (symbol.length === 6) {
    tdSymbol = symbol.slice(0, 3) + '/' + symbol.slice(3); // e.g. EUR/USD
  }
  const safeLimit = Math.min(parseInt(limit) || 1000, 1000);
  const envKeys = [
    process.env.TWELVEDATA_API_KEY,
    process.env.TWELVEDATA_API_KEY_2,
    process.env.TWELVEDATA_API_KEY_3
  ].filter(Boolean);
  const apiKeys = envKeys.length > 0 ? envKeys : ['768f1eba580d41598f5cba2f748fa272', '25fa814b19ad4be0b025832e024d868b', 'e5329b9159a244659209bd5590fedc54'];
  
  for (const apiKey of apiKeys) {
    let url = `https://api.twelvedata.com/time_series?symbol=${tdSymbol}&interval=${tdInterval}&outputsize=${safeLimit}&timezone=UTC&apikey=${apiKey}`;
    
    try {
      const res = await fetch(url, { next: { revalidate: 15 } });
      if (!res.ok) {
        if (res.status === 429) continue;
        continue;
      }
      const data = await res.json();
      
      if (data.status === 'error') {
        if (data.code === 429) continue;
        return null;
      }
      
      if (data.status === 'ok' && Array.isArray(data.values) && data.values.length > 0) {
        return data.values.map(d => ({
          time: Math.floor(new Date(d.datetime + 'Z').getTime() / 1000),
          open: parseFloat(d.open),
          high: parseFloat(d.high),
          low: parseFloat(d.low),
          close: parseFloat(d.close),
          volume: 0
        })).sort((a, b) => a.time - b.time);
      }
      
      if (data.status === 'ok') return [];
    } catch (e) {
      console.error('TwelveData fetch error:', e);
    }
  }
  return null;
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
    const cleanSymbol = rawSymbol.replace(/[^A-Z0-9]/g, '');
    let symbolKey = Object.keys(SYMBOL_CONFIG).find(k => k === cleanSymbol);
    if (!symbolKey) {
      symbolKey = Object.keys(SYMBOL_CONFIG).find(k => cleanSymbol.startsWith(k)) || 'XAUUSD';
    }
    const cfg = SYMBOL_CONFIG[symbolKey];

    // ── Metal path (XAUUSD, XAGUSD) ──
    if (cfg.type === 'metal') {
      let candles = await fetchTiingoKlines(symbolKey, interval, startTime, endTime);
      let providerUsed = 'tiingo';

      if (!candles || candles.length === 0) {
        candles = await fetchTwelveDataKlines(symbolKey, interval, limit);
        providerUsed = 'twelvedata';
      }

      if (!candles || candles.length === 0) {
        candles = await fetchBinanceIndexKlines(cfg.binancePair, interval, startTime, endTime, limit);
        providerUsed = 'binance_index';
      }

      if (!candles || candles.length === 0) {
        candles = await fetchBybitIndexKlines(cfg.bybitSymbol, interval, startTime, endTime, limit);
        providerUsed = 'bybit_index';
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
        interval,
        count: uniqueCandles.length,
        data:  uniqueCandles,
      });
    }

    if (cfg.type === 'forex') {
      let candles = await fetchTiingoKlines(symbolKey, interval, startTime, endTime);
      let providerUsed = 'tiingo';

      if (!candles || candles.length === 0) {
        candles = await fetchTwelveDataKlines(symbolKey, interval, limit);
        providerUsed = 'twelvedata';
      }

      if (!candles || candles.length === 0) {
        candles = await fetchYahooKlines(cfg.yahooSymbol, interval, startTime, endTime);
        providerUsed = 'yahoo_finance';
      }

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
