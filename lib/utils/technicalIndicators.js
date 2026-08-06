export function calculateEMA(data, length) {
  if (!data || data.length < length) return [];
  const k = 2 / (length + 1);
  const result = [];
  let sum = 0;
  
  // Calculate SMA for the first 'length' items
  for (let i = 0; i < length; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / length;
  
  for (let i = length - 1; i < data.length; i++) {
    if (i === length - 1) {
      result.push({ time: data[i].time, value: prevEma });
    } else {
      const ema = (data[i].close - prevEma) * k + prevEma;
      result.push({ time: data[i].time, value: ema });
      prevEma = ema;
    }
  }
  return result;
}

export function calculateSMA(data, length) {
  if (!data || data.length < length) return [];
  const result = [];
  let sum = 0;
  
  for (let i = 0; i < length; i++) {
    sum += data[i].close;
  }
  
  result.push({ time: data[length - 1].time, value: sum / length });
  
  for (let i = length; i < data.length; i++) {
    sum = sum - data[i - length].close + data[i].close;
    result.push({ time: data[i].time, value: sum / length });
  }
  return result;
}

export function calculateSMMA(data, length) {
  if (!data || data.length < length) return [];
  const result = [];
  let sum = 0;
  
  // Calculate SMA for the first 'length' items
  for (let i = 0; i < length; i++) {
    sum += data[i].close;
  }
  let prevSmma = sum / length;
  
  for (let i = length - 1; i < data.length; i++) {
    if (i === length - 1) {
      result.push({ time: data[i].time, value: prevSmma });
    } else {
      const smma = (prevSmma * (length - 1) + data[i].close) / length;
      result.push({ time: data[i].time, value: smma });
      prevSmma = smma;
    }
  }
  return result;
}

export function calculateVolume(data) {
  if (!data || data.length === 0) return [];
  return data.map(d => ({
    time: d.time,
    value: d.volume || 0,
    color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
  }));
}

export function calculateRSI(data, length = 14) {
  if (!data || data.length <= length) return [];
  const result = [];
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= length; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / length;
  let avgLoss = losses / length;
  
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
  
  result.push({ time: data[length].time, value: rsi });
  
  for (let i = length + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    
    avgGain = ((avgGain * (length - 1)) + gain) / length;
    avgLoss = ((avgLoss * (length - 1)) + loss) / length;
    
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    
    result.push({ time: data[i].time, value: rsi });
  }
  return result;
}

export function calculateMACD(data, fast = 12, slow = 26, signalLen = 9) {
  if (!data || data.length <= slow) return { macd: [], signal: [], hist: [] };
  
  const fastEma = calculateEMA(data, fast);
  const slowEma = calculateEMA(data, slow);
  
  const fastMap = new Map(fastEma.map(d => [d.time, d.value]));
  const macdLineRaw = [];
  
  for (const s of slowEma) {
    const fVal = fastMap.get(s.time);
    if (fVal !== undefined) {
      macdLineRaw.push({ time: s.time, close: fVal - s.value });
    }
  }
  
  const signalEma = calculateEMA(macdLineRaw, signalLen);
  const signalMap = new Map(signalEma.map(d => [d.time, d.value]));
  
  const macdData = [];
  const signalData = [];
  const histData = [];
  
  let prevHist = 0;
  
  for (const m of macdLineRaw) {
    macdData.push({ time: m.time, value: m.close });
    const sVal = signalMap.get(m.time);
    if (sVal !== undefined) {
      signalData.push({ time: m.time, value: sVal });
      const h = m.close - sVal;
      let color = 'rgba(38, 166, 154, 0.8)';
      if (h >= 0) {
        color = h >= prevHist ? 'rgba(38, 166, 154, 0.8)' : 'rgba(129, 199, 132, 0.5)';
      } else {
        color = h < prevHist ? 'rgba(239, 83, 80, 0.8)' : 'rgba(229, 115, 115, 0.5)';
      }
      histData.push({ time: m.time, value: h, color });
      prevHist = h;
    }
  }
  
  return { macd: macdData, signal: signalData, hist: histData };
}

export function calculateBollingerBands(data, length = 20, mult = 2) {
  if (!data || data.length < length) return { middle: [], upper: [], lower: [] };
  
  const middleData = [];
  const upperData = [];
  const lowerData = [];
  
  for (let i = length - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < length; j++) {
      sum += data[i - j].close;
    }
    const sma = sum / length;
    
    let varianceSum = 0;
    for (let j = 0; j < length; j++) {
      varianceSum += Math.pow(data[i - j].close - sma, 2);
    }
    const variance = varianceSum / length;
    const stdDev = Math.sqrt(variance);
    
    middleData.push({ time: data[i].time, value: sma });
    upperData.push({ time: data[i].time, value: sma + mult * stdDev });
    lowerData.push({ time: data[i].time, value: sma - mult * stdDev });
  }
  
  return { middle: middleData, upper: upperData, lower: lowerData };
}

export function calculateStochastic(data, kLength = 14, kSmoothing = 1, dLength = 3) {
  if (!data || data.length < kLength) return { kLine: [], dLine: [] };
  
  const rawK = [];
  
  for (let i = kLength - 1; i < data.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    for (let j = 0; j < kLength; j++) {
      const d = data[i - j];
      const h = d.high !== undefined ? d.high : d.close;
      const l = d.low !== undefined ? d.low : d.close;
      if (h > highestHigh) highestHigh = h;
      if (l < lowestLow) lowestLow = l;
    }
    
    const currentClose = data[i].close;
    let k = 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
    if (highestHigh === lowestLow) k = 100; // fallback
    rawK.push({ time: data[i].time, value: k, close: k });
  }
  
  const kLineData = calculateSMA(rawK, kSmoothing);
  
  const kLineMap = new Map(kLineData.map(d => [d.time, d.value]));
  const dLineRaw = [];
  for (const k of kLineData) {
    dLineRaw.push({ time: k.time, close: k.value });
  }
  
  const dLineData = calculateSMA(dLineRaw, dLength);
  
  return { kLine: kLineData, dLine: dLineData };
}

export function calculateATR(data, length = 14) {
  if (!data || data.length < 2) return [];
  
  const h0 = data[0].high !== undefined ? data[0].high : data[0].close;
  const l0 = data[0].low !== undefined ? data[0].low : data[0].close;
  const tr0 = h0 - l0;
  
  const tr = [{ time: data[0].time, value: tr0, close: tr0 }];
  for (let i = 1; i < data.length; i++) {
    const currentHigh = data[i].high !== undefined ? data[i].high : data[i].close;
    const currentLow = data[i].low !== undefined ? data[i].low : data[i].close;
    const prevClose = data[i - 1].close;
    
    const tr1 = currentHigh - currentLow;
    const tr2 = Math.abs(currentHigh - prevClose);
    const tr3 = Math.abs(currentLow - prevClose);
    
    const trueRange = Math.max(tr1, tr2, tr3);
    tr.push({ time: data[i].time, value: trueRange, close: trueRange });
  }
  
  return calculateEMA(tr, length);
}

export function calculatePSAR(data, step = 0.02, maxStep = 0.2) {
  if (!data || data.length < 2) return [];

  const results = [];
  
  let isLong = true;
  let sar = data[0].low !== undefined ? data[0].low : data[0].close;
  let ep = data[0].high !== undefined ? data[0].high : data[0].close;
  let af = step;
  
  results.push({ time: data[0].time, value: sar });

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    
    const currHigh = curr.high !== undefined ? curr.high : curr.close;
    const currLow = curr.low !== undefined ? curr.low : curr.close;
    const prevHigh = prev.high !== undefined ? prev.high : prev.close;
    const prevLow = prev.low !== undefined ? prev.low : prev.close;
    
    sar = sar + af * (ep - sar);
    
    if (isLong) {
      if (currLow < sar) {
        isLong = false;
        sar = ep;
        ep = currLow;
        af = step;
      } else {
        if (currHigh > ep) {
          ep = currHigh;
          af = Math.min(af + step, maxStep);
        }
        if (i >= 2) {
          const prev2Low = data[i - 2].low !== undefined ? data[i - 2].low : data[i - 2].close;
          sar = Math.min(sar, prevLow, prev2Low);
        }
      }
    } else {
      if (currHigh > sar) {
        isLong = true;
        sar = ep;
        ep = currHigh;
        af = step;
      } else {
        if (currLow < ep) {
          ep = currLow;
          af = Math.min(af + step, maxStep);
        }
        if (i >= 2) {
          const prev2High = data[i - 2].high !== undefined ? data[i - 2].high : data[i - 2].close;
          sar = Math.max(sar, prevHigh, prev2High);
        }
      }
    }
    
    results.push({ time: curr.time, value: sar });
  }

  return results;
}
