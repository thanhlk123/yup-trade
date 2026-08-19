// Execution (5)
import noSl from './execution/noSl';
import exitTooEarly from './execution/exitTooEarly';
import holdTooLong from './execution/holdTooLong';
import prematureBreakeven from './execution/prematureBreakeven';
import poorExecution from './execution/poorExecution';

// Risk Management (5)
import dca from './risk/dca';
import oversized from './risk/oversized';
import pyramidMismanagement from './risk/pyramidMismanagement';
import asymmetricSizing from './risk/asymmetricSizing';

// Psychological (2 so far)
import revengeTrading from './psychological/revenge';
import fomo from './psychological/fomo';
import compulsiveReEntry from './sequence/compulsiveReEntry';
import overtrading from './sequence/overtrading';
import poorSetupGrade from './process/poorSetupGrade';
import rrInversion from './risk/rrInversion';

// Market Context (4)
import counterTrend from './context/counterTrend';
import highImpactNews from './context/highImpactNews';
import weekendHolding from './context/weekendHolding';
import sessionBias from './context/sessionBias';
import lowConfirmation from './execution/lowConfirmation';

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
  exitTooEarly,
  holdTooLong,
  prematureBreakeven,
  poorExecution,
  
  dca,
  oversized,
  pyramidMismanagement,
  asymmetricSizing,

  revengeTrading,
  fomo,
  compulsiveReEntry,
  overtrading,
  poorSetupGrade,
  rrInversion,

  counterTrend,
  highImpactNews,
  weekendHolding,
  sessionBias,
  lowConfirmation
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
