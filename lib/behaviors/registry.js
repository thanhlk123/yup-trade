// Execution (5)
import noSl from './execution/noSl';
import noTp from './execution/noTp';
import exitTooEarly from './execution/exitTooEarly';
import holdTooLong from './execution/holdTooLong';
import prematureBreakeven from './execution/prematureBreakeven';

// Risk Management (5)
import dca from './risk/dca';
import martingale from './risk/martingale';
import oversized from './risk/oversized';
import pyramidMismanagement from './risk/pyramidMismanagement';
import asymmetricSizing from './risk/asymmetricSizing';

// Trading Pattern (4)
import revengeTrading from './sequence/revengeTrading';
import compulsiveReEntry from './sequence/compulsiveReEntry';
import overtrading from './sequence/overtrading';
import rrInversion from './risk/rrInversion';

// Market Context (4)
import counterTrend from './context/counterTrend';
import highImpactNews from './context/highImpactNews';
import weekendHolding from './context/weekendHolding';
import sessionBias from './context/sessionBias';

// Good Behaviors (8)
import strictSl from './good/strictSl';
import plannedTp from './good/plannedTp';
import riskConsistency from './good/riskConsistency';
import streakManagement from './good/streakManagement';
import quickLossCutting from './good/quickLossCutting';
import highConvictionSizing from './good/highConvictionSizing';
import postLossDiscipline from './good/postLossDiscipline';
import patientEntry from './good/patientEntry';

// Registry of all active behaviors (18 Standardized)
export const BAD_BEHAVIORS = [
  noSl,
  noTp,
  exitTooEarly,
  holdTooLong,
  prematureBreakeven,
  
  dca,
  martingale,
  oversized,
  pyramidMismanagement,
  asymmetricSizing,

  revengeTrading,
  compulsiveReEntry,
  overtrading,
  rrInversion,

  counterTrend,
  highImpactNews,
  weekendHolding,
  sessionBias
];

export const GOOD_BEHAVIORS = [
  streakManagement,
  quickLossCutting,
  highConvictionSizing,
  postLossDiscipline,
  patientEntry,
  strictSl,
  plannedTp,
  riskConsistency
];
