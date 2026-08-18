// TDD v1.0 Configuration Layer for Behavior Analytics

export const BehaviorConfig = {
  version: '1.0',
  timeWindows: {
    REVENGE_WINDOW_MINS: 30,
    COMPULSIVE_REENTRY_MINS: 15,
    DCA_CLUSTER_MINS: 240,
    PREMATURE_BE_MINS: 60,
    HOLD_TOO_LONG_HOURS: 24,
    NEWS_SLIPPAGE_MINS: 5
  },
  thresholds: {
    ASYMMETRIC_SIZING_RATIO: 1.5,
    OVERSIZED_MEDIAN_MULTIPLIER: 3.0,
    MARTINGALE_VOLUME_BUMP: 1.8,
    RR_INVERSION_RATIO: 1.5,
    OVERTRADING_DAILY_TRADES: 8,
    GAP_RISK_MIN_LOSS: 50, // USD
    QUICK_LOSS_CUT_RATIO: 0.5,
    CONVICTION_SIZING_MULTIPLIER: 1.5,
    CONVICTION_WINRATE: 0.6,
    MIN_BASELINE_TRADES: 10,
    MIN_TAIL_SAMPLE: 10
  },
  falsePositives: {
    MENTAL_STOP_MAX_LOSS_RATIO: 1.0, // If Avg Loss < 1R, No SL is Mental Stop (Reject)
    SCALPER_MIN_RR_PROFIT: 2.0    // If Avg Profit > 2R, Exit Too Early is Manual Scalp (Reject)
  }
};
