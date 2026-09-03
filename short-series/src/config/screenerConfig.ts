// short-series/src/config/screenerConfig.ts

export interface CategoryConfig {
  id: 'penny' | 'smallMid' | 'large';
  name: string;
  badge: string;
  subtitle: string;
  priceMax?: number;
  priceMin?: number;
  marketCapMin?: number;
  marketCapMax?: number;
  volumeFloor: number;
  description: string;
}

export interface ScreenerSettings {
  categories: Record<'penny' | 'smallMid' | 'large', CategoryConfig>;
  refreshCadenceMs: number;
  staleAfterSeconds: number;
  defaultCategory: 'penny' | 'smallMid' | 'large';
  defaultSort: string;
  platformNotice: string;
  dataFeedNotice: string;
}

export const SCREENER_CONFIG: ScreenerSettings = {
  categories: {
    penny: {
      id: 'penny',
      name: 'Penny Stocks',
      badge: 'Sub-$5 Equities',
      subtitle: 'Price < $5.00',
      priceMax: 5.0,
      priceMin: 0.0001,
      volumeFloor: 25000,
      description: 'Equities trading below $5.00 per share. Characterized by elevated retail order flow, rapid percentage expansion, and heightened intraday volatility.'
    },
    smallMid: {
      id: 'smallMid',
      name: 'Small & Mid Cap',
      badge: '$300M – $10B Cap',
      subtitle: 'Market Cap $300M–$10B',
      marketCapMin: 300_000_000,      // $300 Million
      marketCapMax: 10_000_000_000,   // $10 Billion
      priceMin: 0.50,
      volumeFloor: 50000,
      description: 'Equities with approximately $300M to $10B market capitalization. Balances growth velocity, momentum breakouts, and institutional accumulation trends.'
    },
    large: {
      id: 'large',
      name: 'Large Cap',
      badge: '>$10B Cap',
      subtitle: 'Market Cap > $10B',
      marketCapMin: 10_000_000_000,   // > $10 Billion
      priceMin: 1.0,
      volumeFloor: 100000,
      description: 'Equities with greater than $10B market capitalization. Primary institutional liquidity anchors, index drivers, and established industry leaders.'
    }
  },
  refreshCadenceMs: 20000,      // 20s fast-polling (free API friendly, respecting rate limits)
  staleAfterSeconds: 90,        // Flag as delayed / stale if update > 90s old
  defaultCategory: 'penny',
  defaultSort: 'momentum',      // Best-performing / strongest momentum first
  platformNotice: 'Platform Classification Framework: Penny Stocks (<$5), Small & Mid Cap ($300M–$10B), and Large Cap (>$10B) thresholds are practical platform categories engineered for quantitative screening and volatility tracking rather than universal regulatory definitions.',
  dataFeedNotice: 'Consolidated Market Data Feeds (Delayed ~15m where required by exchange rules for free consolidated feeds).'
};

export function calculateMomentumScore(changePercent: number, relativeVolume: number, rsi?: number, close?: number, high?: number, low?: number): number {
  let priceScore = 50 + (changePercent * 1.4);
  priceScore = Math.max(5, Math.min(99, priceScore));

  const rvol = relativeVolume || 1.0;
  let rvolScore = 50 + ((rvol - 1.0) * 20);
  rvolScore = Math.max(10, Math.min(99, rvolScore));

  let techScore = 50;
  if (typeof rsi === 'number' && !isNaN(rsi)) {
    techScore = rsi;
  } else if (close && high && low && high > low) {
    techScore = ((close - low) / (high - low)) * 100;
  }
  techScore = Math.max(10, Math.min(95, techScore));

  return Math.max(1, Math.min(99, Math.round((priceScore * 0.45) + (rvolScore * 0.35) + (techScore * 0.20))));
}

export function calculateConvictionScore(recommendAll?: number, momentumScore?: number): { score: number; label: string } {
  let score = 50;
  if (typeof recommendAll === 'number' && !isNaN(recommendAll)) {
    score = Math.round(((recommendAll + 1) / 2) * 100);
  } else if (momentumScore) {
    score = Math.round(momentumScore * 0.9);
  }
  score = Math.max(1, Math.min(99, score));

  let label = 'Neutral';
  if (score >= 80) label = 'High Conviction';
  else if (score >= 65) label = 'Bullish Setup';
  else if (score >= 45) label = 'Balanced Flow';
  else if (score >= 30) label = 'Bearish Pressure';
  else label = 'High Distribution';

  return { score, label };
}
