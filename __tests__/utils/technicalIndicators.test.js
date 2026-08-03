import {
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateATR
} from '../../lib/utils/technicalIndicators';

// Mock Data OHLCV for testing
const mockCandles = [
  { time: '2023-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 },
  { time: '2023-01-02', open: 105, high: 115, low: 100, close: 112, volume: 1200 },
  { time: '2023-01-03', open: 112, high: 120, low: 110, close: 118, volume: 1500 },
  { time: '2023-01-04', open: 118, high: 125, low: 115, close: 115, volume: 1300 },
  { time: '2023-01-05', open: 115, high: 122, low: 112, close: 120, volume: 1400 },
  { time: '2023-01-06', open: 120, high: 128, low: 118, close: 125, volume: 1600 },
  { time: '2023-01-07', open: 125, high: 130, low: 120, close: 122, volume: 1100 },
  { time: '2023-01-08', open: 122, high: 132, low: 121, close: 130, volume: 1800 },
  { time: '2023-01-09', open: 130, high: 135, low: 128, close: 132, volume: 1900 },
  { time: '2023-01-10', open: 132, high: 140, low: 130, close: 138, volume: 2000 },
  { time: '2023-01-11', open: 138, high: 142, low: 135, close: 136, volume: 1500 },
  { time: '2023-01-12', open: 136, high: 145, low: 135, close: 140, volume: 1700 },
  { time: '2023-01-13', open: 140, high: 148, low: 138, close: 145, volume: 2200 },
  { time: '2023-01-14', open: 145, high: 150, low: 142, close: 148, volume: 2100 },
  { time: '2023-01-15', open: 148, high: 155, low: 145, close: 152, volume: 2400 },
];

describe('Technical Indicators Utility', () => {

  describe('calculateSMA', () => {
    it('returns empty array if data length is less than SMA length', () => {
      const result = calculateSMA(mockCandles, 20);
      expect(result).toEqual([]);
    });

    it('calculates Simple Moving Average correctly for length 3', () => {
      const result = calculateSMA(mockCandles, 3);
      // Data size: 15. SMA 3 starts at index 2 (the 3rd element). Result length = 15 - 3 + 1 = 13.
      expect(result.length).toBe(13);
      
      // First SMA 3 value = (105 + 112 + 118) / 3 = 111.666...
      expect(result[0].value).toBeCloseTo(111.667, 3);
    });
  });

  describe('calculateEMA', () => {
    it('calculates Exponential Moving Average correctly', () => {
      const result = calculateEMA(mockCandles, 3);
      expect(result.length).toBe(13);
      // The first value of EMA is initialized using SMA
      expect(result[0].value).toBeCloseTo(111.667, 3);
    });
  });

  describe('calculateRSI', () => {
    it('calculates RSI values safely within 0 to 100', () => {
      const result = calculateRSI(mockCandles, 14);
      // result length should be 15 - 14 = 1
      expect(result.length).toBe(1);
      
      result.forEach(item => {
        expect(item.value).toBeGreaterThanOrEqual(0);
        expect(item.value).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateMACD', () => {
    it('returns macd, signal, and histogram arrays safely', () => {
      // Using very small periods to fit the mock data of 15 candles
      const result = calculateMACD(mockCandles, 3, 6, 3);
      
      expect(result).toHaveProperty('macd');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('hist');
      
      // The histogram should determine its color properly
      if (result.hist.length > 0) {
        expect(result.hist[0]).toHaveProperty('color');
      }
    });
  });

  describe('calculateATR - NaN Prevention Test', () => {
    it('handles first element correctly without producing NaN', () => {
      const result = calculateATR(mockCandles, 5);
      expect(result.length).toBeGreaterThan(0);
      
      // Verify no NaN leaked into calculations
      result.forEach(item => {
        expect(Number.isNaN(item.value)).toBe(false);
        expect(item.value).toBeGreaterThan(0);
      });
    });

    it('falls back to close if high/low are missing', () => {
      // Malformed data
      const malformedData = [
        { time: '1', close: 100 },
        { time: '2', close: 105 },
        { time: '3', close: 110 }
      ];
      
      const result = calculateATR(malformedData, 2);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(item => {
        expect(Number.isNaN(item.value)).toBe(false);
      });
    });
  });

  describe('calculateStochastic', () => {
    it('calculates Stoch values correctly within bounds', () => {
      const result = calculateStochastic(mockCandles, 5, 1, 3);
      
      expect(result).toHaveProperty('kLine');
      expect(result).toHaveProperty('dLine');
      
      result.kLine.forEach(item => {
        expect(item.value).toBeGreaterThanOrEqual(0);
        expect(item.value).toBeLessThanOrEqual(100);
      });
    });
  });

});
