// lib/behaviors/tags.js

/**
 * Standardized Hashtag Constants for Behavior Engine
 * Ensure behavior plugins check these exact tags from the database instead of localized strings.
 */
export const TAGS = {
  // --- MISTAKES ---
  MISTAKE_HOLD_LOSS: '#Mistake_GreedHolding',
  MISTAKE_NO_SL: '#Mistake_NoSl', 
  MISTAKE_DCA: '#Mistake_DCA',
  MISTAKE_FOMO: '#Mistake_FOMO',
  MISTAKE_REVENGE: '#Mistake_RevengeTrade',
  MISTAKE_OVERTRADE: '#Mistake_OverTrade',
  MISTAKE_OVERRISK: '#Mistake_OverRisk',
  MISTAKE_MOVED_SL: '#Mistake_MovedSL',
  MISTAKE_EARLY_EXIT: '#Mistake_EarlyExit', 
  MISTAKE_EARLY_ENTRY: '#Mistake_EarlyEntry',
  MISTAKE_LATE_ENTRY: '#Mistake_LateEntry',
  MISTAKE_COUNTER_TREND: '#Mistake_CounterTrend',
  MISTAKE_NEWS: '#Mistake_NewsTrading',

  // --- EMOTIONS ---
  EMOTION_HOPE: '#Emotion_Hope',
  EMOTION_FOMO: '#Emotion_FOMO',
  EMOTION_ANGER: '#Emotion_Anger',
  EMOTION_FEAR: '#Emotion_Fear',
  EMOTION_GREED: '#Emotion_Greed',
  EMOTION_FRUSTRATION: '#Emotion_Frustration',

  // --- TREND & CONTEXT ---
  TREND_BULLISH: '#Trend_Bullish',
  TREND_BEARISH: '#Trend_Bearish',
  TREND_SIDEWAY: '#Trend_Sideway',
  TREND_WITH_TREND: '#Trend_WithTrend',
  TREND_COUNTER: '#Trend_Counter',
  TREND_REVERSAL: '#Trend_Reversal',

  // --- MANAGEMENT & EXECUTION ---
  MGMT_MOVE_BE: '#Mgmt_Move BE',
  MGMT_MANUAL_EXIT: '#Mgmt_Manual Exit',
  EXEC_GOOD: '#Exec_Good',
  EXEC_FOMO: '#Exec_Fomo',
  EXEC_HESITATION: '#Exec_Hesitation',
  EXEC_CHASING: '#Exec_Chasing',
  
  // --- GRADES ---
  GRADE_C: 'C',
  GRADE_C_TAG: '#Grade_C',
  
  // --- RISK ---
  RISK_VIOLATED: 'Violated',
};
