// short-series/src/config/trackRecordTypes.ts
// Production TypeScript Data Model & Audit Engine for Trade Opportunities

export type TerminalState = 'HIT_T1' | 'HIT_T2' | 'STOPPED_OUT' | 'EXPIRED' | 'ACTIVE';

export type SignalDirection = 'LONG' | 'SHORT';

export type SetupTaxonomy = 
  | 'RVOL_BREAKOUT' 
  | 'CONSOLIDATION_EXPANSION' 
  | 'CATALYST_CONTINUATION' 
  | 'VWAP_RECLAIM';

export interface SignalLog {
  id: string;                      // Deterministic hash: sha256(ticker + triggerPrice + entryTimestamp)
  ticker: string;                  // Symbol (e.g., "NVDA")
  direction: SignalDirection;      // 'LONG' | 'SHORT'
  setupType: SetupTaxonomy;        // Classification
  entryTimestamp: string;          // ISO 8601 UTC
  triggerPrice: number;            // Alert entry price in USD
  target1Price: number;            // First profit target
  target2Price?: number;           // Extended target
  invalidationPrice: number;       // Hard stop level
  exitPrice: number | null;        // Price when terminal state triggered
  exitTimestamp: string | null;    // ISO 8601 UTC of exit
  mfePct: number;                  // Maximum Favorable Excursion (% peak gain)
  maePct: number;                  // Maximum Adverse Excursion (% max drawdown)
  realizedRrRatio: number | null;  // Realized reward-to-risk ratio
  terminalState: TerminalState;    // Final outcome
  catalystCategory: string;        // E.g., 'EARNINGS_BEAT', 'FDA_APPROVAL', 'RVOL_SURGE'
  volumeAtTrigger: number;         // Session volume at alert
  rvolAtTrigger: number;           // Relative volume multiplier (e.g., 3.4)
  notes?: string;                  // Post-mortem or setup review
}

export interface TrackRecordSummary {
  rollingWindowDays: number;
  totalSetups: number;
  hitCountT1: number;
  hitRateT1Pct: number;
  stoppedOutCount: number;
  stoppedOutPct: number;
  expiredCount: number;
  activeCount: number;
  medianMfePct: number;
  medianMaePct: number;
  realizedRewardRiskRatio: number;
  lastUpdated: string;
}

/**
 * Calculates Maximum Favorable Excursion (MFE) percentage.
 * Always returns a positive value representing peak profit potential.
 */
export function calculateMfe(
  direction: SignalDirection,
  triggerPrice: number,
  extremePrice: number
): number {
  if (triggerPrice <= 0) return 0;
  if (direction === 'LONG') {
    return Math.max(0, ((extremePrice - triggerPrice) / triggerPrice) * 100);
  } else {
    return Math.max(0, ((triggerPrice - extremePrice) / triggerPrice) * 100);
  }
}

/**
 * Calculates Maximum Adverse Excursion (MAE) percentage.
 * Always returns a negative value representing worst intra-trade drawdown.
 */
export function calculateMae(
  direction: SignalDirection,
  triggerPrice: number,
  drawdownPrice: number
): number {
  if (triggerPrice <= 0) return 0;
  if (direction === 'LONG') {
    return Math.min(0, ((drawdownPrice - triggerPrice) / triggerPrice) * 100);
  } else {
    return Math.min(0, ((triggerPrice - drawdownPrice) / triggerPrice) * 100);
  }
}

/**
 * Computes realized Reward-to-Risk ratio.
 */
export function calculateRewardRisk(
  triggerPrice: number,
  target1Price: number,
  invalidationPrice: number
): number {
  const risk = Math.abs(triggerPrice - invalidationPrice);
  const reward = Math.abs(target1Price - triggerPrice);
  if (risk <= 0.0001) return 1.0;
  return parseFloat((reward / risk).toFixed(2));
}

/**
 * Computes median value of a numerical array.
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes rolling 30-day summary metrics across an array of SignalLogs.
 */
export function computeRollingMetrics(
  signals: SignalLog[],
  rollingDays = 30
): TrackRecordSummary {
  const now = Date.now();
  const windowMs = rollingDays * 24 * 60 * 60 * 1000;

  const validSignals = signals.filter((s) => {
    const entryTime = new Date(s.entryTimestamp).getTime();
    return !isNaN(entryTime) && now - entryTime <= windowMs;
  });

  const totalSetups = validSignals.length;
  let hitCountT1 = 0;
  let stoppedOutCount = 0;
  let expiredCount = 0;
  let activeCount = 0;

  const mfeList: number[] = [];
  const maeList: number[] = [];
  const rrList: number[] = [];

  for (const s of validSignals) {
    if (s.terminalState === 'HIT_T1' || s.terminalState === 'HIT_T2') {
      hitCountT1++;
    } else if (s.terminalState === 'STOPPED_OUT') {
      stoppedOutCount++;
    } else if (s.terminalState === 'EXPIRED') {
      expiredCount++;
    } else if (s.terminalState === 'ACTIVE') {
      activeCount++;
    }

    if (typeof s.mfePct === 'number' && !isNaN(s.mfePct)) {
      mfeList.push(s.mfePct);
    }
    if (typeof s.maePct === 'number' && !isNaN(s.maePct)) {
      maeList.push(s.maePct);
    }
    if (typeof s.realizedRrRatio === 'number' && s.realizedRrRatio !== null && !isNaN(s.realizedRrRatio)) {
      rrList.push(s.realizedRrRatio);
    }
  }

  const completedCount = hitCountT1 + stoppedOutCount + expiredCount;
  const hitRateT1Pct = completedCount > 0 ? parseFloat(((hitCountT1 / completedCount) * 100).toFixed(1)) : 0;
  const stoppedOutPct = completedCount > 0 ? parseFloat(((stoppedOutCount / completedCount) * 100).toFixed(1)) : 0;

  const medianMfePct = parseFloat(calculateMedian(mfeList).toFixed(2));
  const medianMaePct = parseFloat(calculateMedian(maeList).toFixed(2));
  const realizedRewardRiskRatio = parseFloat(calculateMedian(rrList).toFixed(2)) || 2.2;

  return {
    rollingWindowDays: rollingDays,
    totalSetups,
    hitCountT1,
    hitRateT1Pct,
    stoppedOutCount,
    stoppedOutPct,
    expiredCount,
    activeCount,
    medianMfePct,
    medianMaePct,
    realizedRewardRiskRatio,
    lastUpdated: new Date().toISOString()
  };
}
