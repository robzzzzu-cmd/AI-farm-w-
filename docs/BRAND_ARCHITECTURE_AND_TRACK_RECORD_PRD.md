# Trade Opportunities: Brand Architecture, Content Style Guide & Signal Track Record PRD

**Document Owner:** Principal Fintech Brand Strategist & Quantitative Product Architect  
**Platform:** Trade Opportunities (`tradeopportunities.trade`)  
**Repository:** `robzzzzu-cmd/AI-farm-w-`  
**Status:** Approved for Production Implementation  
**Target Delivery:** Immediate Active Release  

---

## Executive Summary & Repositioning Mandate

Trade Opportunities (`tradeopportunities.trade`) has historically suffered from an institutional identity crisis. By employing exaggerated hedge-fund vernacular—such as *"institutional execution desks,"* *"order book depth,"* and *"cross-chain liquidity routing"*—the platform alienated its core user base: **serious, active retail momentum and swing traders**. 

Active retail traders do not trade through dark pools or manage nine-figure prime brokerage allocations; they seek high-speed anomaly discovery, instant causal verification (*"Why is this stock up 45%?"*), defined risk invalidation levels, and **radical, verifiable performance transparency**.

This document establishes:
1. **A Grounded Brand Architecture & Value Proposition** anchored strictly on *"AI-powered momentum intelligence for active traders."*
2. **A Production Voice & Tone Style Guide** with an institutional-to-practitioner de-jargonization translation matrix.
3. **The 3-Pillar Operational Framework:** **FIND** (Discovery), **UNDERSTAND** (Context), and **ACT** (Execution).
4. **The "Signal Track Record" Engine Technical Specification:** An auditable, anti-cherry-picking proof architecture with real-time continuous MFE/MAE calculation, strict invalidation tracking, and immutable logging.

---

## 1. Brand Identity & Value Proposition Framework

### 1.1 Core Positioning Statement

> **For** serious active retail momentum and swing traders **who** refuse to chase overextended runners or get trapped in toxic dilution pumps,  
> **Trade Opportunities** is an **AI-powered momentum intelligence terminal**  
> **that** scans 10,000+ US equities in real time to isolate unusual volume surges (RVOL $\ge 3\times$), delivers instant causal attribution (*"Why Is It Moving?"*), and tracks every setup against explicit invalidation levels.  
> **Unlike** opaque alert newsletters that cherry-pick winners or bloated institutional terminals packed with irrelevant jargon,  
> **Trade Opportunities** provides radical performance transparency through an auditable, rolling 30-day Signal Track Record featuring continuous MFE and MAE telemetry.

### 1.2 Target Personas & Primary Value Hooks

| Persona | Core Pain Point | Tactical Need | Trade Opportunities Hook |
| :--- | :--- | :--- | :--- |
| **Intraday Momentum Trader** | Chasing stocks at the highs after the move is obvious; getting chopped up by widening bid/ask spreads. | Sub-second anomaly alerts on opening drive volume and VWAP reclaims with low-float awareness. | *"Catch unusual RVOL surges before the herd lifts the ask. Pre-market gaps, opening drive volume, and hard invalidation stop levels."* |
| **Retail Swing Breakout Trader** | Buying into false breakouts that collapse into secondary offerings, reverse splits, or ATM share dumps. | Multi-day consolidation breaches backed by genuine catalysts (SEC 8-K filings, FDA approvals, earnings surprises). | *"Spot multi-week stage-2 breakouts with verified catalyst backing and zero active S-3 shelf dilution risk."* |
| **Data-Driven Retail Quant** | Inability to verify alert efficacy; lack of auditable data feeds and statistical validation. | Unbiased historical win/loss data, continuous adverse excursion tracking, and structured signal feeds. | *"Systematic momentum tracking with an auditable rolling 30-day proof engine: Hit Rate to Target 1, Median MFE, and Median MAE."* |

---

### 1.3 Tagline & Hero Messaging

* **Primary Category Hook:** *"AI-Powered Momentum Intelligence for Active Traders."*
* **Primary Homepage Headline:**  
  $$\mathbf{\text{Find unusual momentum before it becomes obvious.}}$$
* **Primary Homepage Sub-Headline:**  
  *"Real-time algorithmic volume scanning catches surges (RVOL $\ge 3\times$), catalyst breakouts, and consolidation breaks across 10,000+ US stocks — with instant 'Why Is It Moving?' context and defined invalidation levels."*

#### Hero UI Architecture (ASCII Mockup)

```text
+---------------------------------------------------------------------------------------------------------+
| [TRADE OPPORTUNITIES]   Dashboard   News Feed   Live Screener   Track Record   Tools   Platforms   [Dark] |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   [ ACTIVE TRADER COHORT:  (•) Intraday Momentum   ( ) Retail Swing   ( ) Data-Driven Quant ]           |
|                                                                                                         |
|   HEADLINE:    Find unusual momentum before it becomes obvious.                                         |
|   SUB-HEAD:    Real-time algorithmic volume scanning catches surges (RVOL >= 3x), catalyst breakouts,  |
|                and consolidation breaks across 10,000+ US stocks — with instant "Why Is It Moving?"    |
|                context and defined invalidation levels.                                                 |
|                                                                                                         |
|   [ Scan Live Breakouts -> ]    [ View Auditable Track Record ]                                         |
|                                                                                                         |
|   Quick Try:  [+ Watch $NVDA]  [+ Watch $TSLA]  [+ Watch $AMD]  [+ Watch $PLTR]  [+ Watch $SMCI]        |
|                                                                                                         |
|   +--------------------------+  +--------------------------+  +-------------------------------------+   |
|   | 01. FIND                 |  | 02. UNDERSTAND           |  | 03. ACT                             |   |
|   | Algorithmic Anomaly Scan |  | Instant Causal Context   |  | Invalidation & Execution            |   |
|   | RVOL >= 3x tape triggers |  | SEC 8-K & float analysis |  | Target 1, Target 2 & Hard Stop Loss |   |
|   +--------------------------+  +--------------------------+  +-------------------------------------+   |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

### 1.4 The 3-Pillar Operational Architecture

#### Pillar 1: FIND (Discovery)
* **UI Label:** `01 // FIND: Algorithmic Anomaly Discovery`
* **Headline:** *"Scan 10,000+ Tickers for Abnormal Volume in Real Time."*
* **Micro-Copy:** *"Stop hunting through dozens of chart tabs. Our streaming radar continuously evaluates thousands of US equities across Penny (<$5), Small/Mid ($300M–$10B), and Large Cap (>$10B) brackets, surfacing explosive relative volume (RVOL $\ge 3\times$), pre-market gaps, and opening drive volume expansions within milliseconds of tape confirmation."*
* **Tactical Metrics Displayed:** Ticker, Last Price, Intraday Delta (%), Session Volume, RVOL Multiplier, Float Turnover (%).

#### Pillar 2: UNDERSTAND (Context)
* **UI Label:** `02 // UNDERSTAND: Instant Causal Attribution`
* **Headline:** *"Know Why It's Moving in Under 3 Seconds."*
* **Micro-Copy:** *"Never buy a gap blind. Our automated 5-layer diagnostic engine synthesizes SEC EDGAR filings (8-K contracts, earnings, Form S-3 shelf dilution), clinical trial readouts, short interest, and float turnover. Know immediately if a surge is a clean earnings breakout or a toxic reverse-split dilution pump before risking your capital."*
* **Tactical Metrics Displayed:** Catalyst Category, Active S-3 Shelf Flag, Float Shares, Bid/Ask Spread Warning, Synthesis Verdict (`CLEAN CATALYST`, `DILUTION RISK`, `SHORT SQUEEZE`, `FADE BIAS`).

#### Pillar 3: ACT (Execution)
* **UI Label:** `03 // ACT: Disciplined Execution & Invalidation`
* **Headline:** *"Clear Triggers, Invalidation Levels, and Real-Time Alerts."*
* **Micro-Copy:** *"Trade with defined parameters. Every high-conviction momentum alert comes with a verified Trigger Price, Target 1, Target 2, and an unambiguous Invalidation Stop Level. Pin setups to your live browser watchlist with audio alert chimes, desktop notifications, and 1-click TradingView charting."*
* **Tactical Metrics Displayed:** Trigger Price, Target 1 ($R:R \ge 2:1$), Invalidation Stop, Live MFE (Peak Gain), Live MAE (Max Drawdown), Dynamic Watchlist State.

---

## 2. Voice & Tone De-Jargonization Matrix

### 2.1 Editorial Principles for Copywriters & LLM Report Prompts

1. **Practitioner First:** Write like an experienced, disciplined desk trader talking to an active peer. Zero academic abstraction, zero corporate fluff.
2. **Radical Brevity:** Get straight to the trade thesis, the catalyst, and the risk in under 15 seconds. Active traders scan; they do not read whitepapers during market hours.
3. **Explicit Invalidation:** A trade idea without a price where it is demonstrably wrong is not analysis—it is noise. Always state the invalidation level.
4. **Causal Attribution:** Never claim a stock is "bullish" without specifying the catalyst, the relative volume multiplier, and the float structure.
5. **Zero Institutional Theater:** Drop false claims of "institutional desks," "liquidity routing," or "dark pool access." We empower independent retail traders with high-fidelity market data and transparent mechanics.

### 2.2 Side-by-Side De-Jargonization Matrix

| Institutional / Fluff Buzzword | Practitioner-Focused Retail Translation | Tactical Reason & Implementation Rule |
| :--- | :--- | :--- |
| *"Institutional execution desks face elevated slippage risk."* | *"Thin liquidity means this setup moves fast and spreads can widen."* | Informs active traders that market orders will suffer slippage on low-float runners. Use limit orders. |
| *"Market makers are widening spreads."* | *"Wide bid/ask spreads: order fills will cost more."* | Demystifies market mechanics; tells the trader to avoid paying the full spread on market entries. |
| *"Order book depth suggests absorption."* | *"Heavy bids are stacking up near support; buyers are absorbing sellers."* | Replaces abstract Level 2 order book jargon with concrete price action and support behavior. |
| *"Algorithmic liquidity routing engine."* | *"Fast, direct order execution at the best available market price."* | Eliminates misleading claims that a retail screener acts as a multi-venue broker-dealer router. |
| *"Quantitative market intelligence platform."* | *"Real-time momentum scanner and breakout alerts."* | Communicates exactly what the product does: scans for volume spikes and breakout setups. |
| *"Analytical infrastructure."* | *"Trading tools and live market scanners."* | Replaces corporate IT jargon with tactile utilities that traders interact with. |
| *"Institutional tier performance."* | *"Pro-grade speed and high-conviction breakout setups."* | Shifts focus from fictitious institutional affiliation to tangible performance: speed and setup quality. |
| *"Proprietary alpha-generating models."* | *"Proven volume surge and price breakout triggers."* | Active traders distrust black-box "alpha" claims; they trust clear, verifiable technical indicators. |
| *"Asymmetric upside skew."* | *"Favorable risk/reward (Target 1 gives at least $2\times$ the risk)."* | Replaces quantitative finance theory with everyday trade planning terminology ($R:R \ge 2:1$). |
| *"Secondary distribution overhang."* | *"Offering risk / Share dilution warning (Active Form S-3 shelf)."* | Specifically warns traders that a micro-cap company has registered shares to sell into retail rallies. |

---

## 3. "Signal Track Record" Engine (Trust Architecture)

### 3.1 Overview & Anti-Cherry-Picking Protocol

Most trading services manipulate track records by deleting losing alerts, retroactively editing entry prices, or counting any positive tick as a "win." The Trade Opportunities **Signal Track Record Engine** is engineered as an auditable, immutable verification mechanism.

#### Core Anti-Cherry-Picking Rules:
1. **Deterministic Alert Generation:** Each alert is assigned a deterministic ID based on a SHA-256 hash of its parameters:
   $$\text{Signal ID} = \text{SHA-256}(\text{Ticker} + \text{TriggerPrice} + \text{Timestamp}_{\text{UTC}} + \text{SetupType})$$
2. **Immutable Append-Only Log:** When an alert is emitted to the screener or sent via notification, it is immediately written to the public ledger. No signals can be removed, overwritten, or backdated.
3. **Strict Invalidation Accounting:** Every setup has a pre-defined invalidation price. If price touches the invalidation level before reaching Target 1, it is unconditionally recorded as `STOPPED_OUT`.
4. **Equal Visual Prominence for Losses:** Stopped-out trades, failed breakouts, and false moves are given prominent visual status badges in the historical log. Users can filter exclusively by `STOPPED_OUT` to stress-test system drawdowns.

---

### 3.2 Primary Metric Summary Card (Rolling 30-Day Window)

The Track Record Dashboard displays a rolling 30-day summary card computed automatically across all closed and active setups:

```text
+---------------------------------------------------------------------------------------------------------+
| [LIVE SIGNAL TRACK RECORD] // Rolling 30-Day Verification Ledger                  (Audited Real-Time)   |
+---------------------------------------------------------------------------------------------------------+
|  TOTAL SETUPS DETECTED  |  HIT RATE TO TARGET 1  |   MEDIAN PEAK GAIN (MFE)  |  MEDIAN DRAWDOWN (MAE)   |
|         184             |        66.3%           |          +8.4%            |          -1.8%           |
|  All qualified alerts   |  Hit T1 before stop    |   Peak favorable move     |   Max drawdown pre-exit  |
+---------------------------------------------------------------------------------------------------------+
|  REALIZED REWARD/RISK   |  AVG TIME TO TARGET    |   STOPPED OUT (FAILURES)  |  CURRENTLY ACTIVE        |
|         2.4 : 1         |        42 Mins         |          52 (28.3%)       |        10 Setups         |
|  Avg win vs avg loss    |  Entry to T1 fill      |   Strict invalidation hit |  Monitoring tape live    |
+---------------------------------------------------------------------------------------------------------+
```

#### Metric Definitions:
* **Total Setups Detected ($N$):** Total sample size of algorithmic breakout alerts triggered in the trailing 30 calendar days.
* **Hit Rate to Target 1 ($H_{T1}$):**
  $$H_{T1} = \frac{N_{\text{HIT\_T1}}}{N_{\text{HIT\_T1}} + N_{\text{STOPPED\_OUT}} + N_{\text{EXPIRED}}} \times 100\%$$
* **Median Maximum Favorable Excursion ($\text{MFE}_{\text{median}}$):** The 50th percentile of peak upward percentage excursion across all alert lifecycles:
  $$\text{MFE}_i = \max_{t \in [t_{\text{entry}}, t_{\text{exit}}]} \left( \frac{\text{High}_t - P_{\text{trigger}}}{P_{\text{trigger}}} \right) \times 100\%$$
* **Median Maximum Adverse Excursion ($\text{MAE}_{\text{median}}$):** The 50th percentile of worst intra-trade drawdown before trade termination:
  $$\text{MAE}_i = \min_{t \in [t_{\text{entry}}, t_{\text{exit}}]} \left( \frac{\text{Low}_t - P_{\text{trigger}}}{P_{\text{trigger}}} \right) \times 100\%$$
* **Realized Reward/Risk Ratio ($R_{\text{realized}}$):**
  $$R_{\text{realized}} = \frac{\text{Median Target 1 Distance (\%) } (|P_{\text{T1}} - P_{\text{trigger}}| / P_{\text{trigger}})}{\text{Median Invalidation Distance (\%) } (|P_{\text{trigger}} - P_{\text{stop}}| / P_{\text{trigger}})}$$

---

### 3.3 Historical Signals Ledger (ASCII UI Mockup)

```text
+---------------------------------------------------------------------------------------------------------+
| HISTORICAL SIGNALS AUDIT LEDGER                                                                         |
| Filter: [ All (184) ]  [ Hits T1 (122) ]  [ Stopped Out (52) ]  [ Expired (10) ]  [ Search: _______ ]  |
+---------------------------------------------------------------------------------------------------------+
| TICKER | TRIGGER | T1 TARGET | INVALIDATION | EXIT PRICE | MFE (%) | MAE (%) | TIME-TO-T1 | STATUS     |
|--------+---------+-----------+--------------+------------+---------+---------+------------+------------|
| $NVDA  | $118.50 | $124.00   | $116.20      | $124.20    | +5.2%   | -0.8%   | 34 mins    | [HIT_T1]   |
| $PLTR  | $32.40  | $34.50    | $31.60       | $34.65    | +7.1%   | -1.1%   | 1 hr 12m   | [HIT_T1]   |
| $SMCI  | $440.00 | $470.00   | $428.00      | $427.80    | +1.8%   | -2.8%   | ---        | [STOPPED]  |
| $AMD   | $152.20 | $158.00   | $149.50      | $158.40    | +4.3%   | -0.9%   | 51 mins    | [HIT_T1]   |
| $MIMI  | $2.85   | $3.40     | $2.60        | $2.58      | +3.5%   | -9.5%   | ---        | [STOPPED]  |
| $TSLA  | $224.00 | $235.00   | $219.00      | $226.50    | +2.2%   | -1.4%   | Session End| [EXPIRED]  |
+---------------------------------------------------------------------------------------------------------+
| * Clicking any row opens the full tick-level excursion chart and catalyst diagnostic post-mortem.       |
+---------------------------------------------------------------------------------------------------------+
```

---

### 3.4 Technical Data Model & JSON Schema

#### TypeScript Interfaces (`SignalLog` and Related Types)

```typescript
export type TerminalState = 'HIT_T1' | 'HIT_T2' | 'STOPPED_OUT' | 'EXPIRED' | 'ACTIVE';

export type SignalDirection = 'LONG' | 'SHORT';

export type SetupTaxonomy = 
  | 'RVOL_BREAKOUT' 
  | 'CONSOLIDATION_EXPANSION' 
  | 'CATALYST_CONTINUATION' 
  | 'VWAP_RECLAIM';

export interface ExcursionPoint {
  timestamp: string; // ISO 8601
  price: number;
  pctDeltaFromTrigger: number;
}

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
```

#### Formal JSON Schema (`SignalLog.schema.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SignalLog",
  "description": "Immutable audit record for Trade Opportunities momentum alerts",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Deterministic SHA-256 identifier"
    },
    "ticker": {
      "type": "string",
      "pattern": "^[A-Z0-9.-]{1,10}$"
    },
    "direction": {
      "type": "string",
      "enum": ["LONG", "SHORT"]
    },
    "setupType": {
      "type": "string",
      "enum": ["RVOL_BREAKOUT", "CONSOLIDATION_EXPANSION", "CATALYST_CONTINUATION", "VWAP_RECLAIM"]
    },
    "entryTimestamp": {
      "type": "string",
      "format": "date-time"
    },
    "triggerPrice": {
      "type": "number",
      "minimum": 0.0001
    },
    "target1Price": {
      "type": "number",
      "minimum": 0.0001
    },
    "target2Price": {
      "type": "number",
      "minimum": 0.0001
    },
    "invalidationPrice": {
      "type": "number",
      "minimum": 0.0001
    },
    "exitPrice": {
      "type": ["number", "null"]
    },
    "exitTimestamp": {
      "type": ["string", "null"],
      "format": "date-time"
    },
    "mfePct": {
      "type": "number",
      "description": "Peak favorable excursion percentage"
    },
    "maePct": {
      "type": "number",
      "description": "Maximum adverse excursion percentage (negative or zero)"
    },
    "realizedRrRatio": {
      "type": ["number", "null"]
    },
    "terminalState": {
      "type": "string",
      "enum": ["HIT_T1", "HIT_T2", "STOPPED_OUT", "EXPIRED", "ACTIVE"]
    },
    "catalystCategory": {
      "type": "string"
    },
    "volumeAtTrigger": {
      "type": "integer",
      "minimum": 0
    },
    "rvolAtTrigger": {
      "type": "number",
      "minimum": 0
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "ticker",
    "direction",
    "setupType",
    "entryTimestamp",
    "triggerPrice",
    "target1Price",
    "invalidationPrice",
    "mfePct",
    "maePct",
    "terminalState",
    "catalystCategory",
    "volumeAtTrigger",
    "rvolAtTrigger"
  ]
}
```

---

## 4. Continuous Real-Time MFE & MAE Calculation: Acceptance Criteria

### 4.1 Mathematical Formulation

For any alert initiated at timestamp $t_{\text{entry}}$ at trigger price $P_{\text{trigger}}$ and terminating at $t_{\text{exit}}$:

1. **Maximum Favorable Excursion (MFE):**
   * **Long Setup:**
     $$\text{MFE}_{\text{Long}} = \max_{t \in [t_{\text{entry}}, t_{\text{exit}}]} \left( \frac{\text{High}_t - P_{\text{trigger}}}{P_{\text{trigger}}} \right) \times 100\%$$
   * **Short Setup:**
     $$\text{MFE}_{\text{Short}} = \max_{t \in [t_{\text{entry}}, t_{\text{exit}}]} \left( \frac{P_{\text{trigger}} - \text{Low}_t}{P_{\text{trigger}}} \right) \times 100\%$$

2. **Maximum Adverse Excursion (MAE):**
   * **Long Setup:**
     $$\text{MAE}_{\text{Long}} = \min_{t \in [t_{\text{entry}}, t_{\text{exit}}]} \left( \frac{\text{Low}_t - P_{\text{trigger}}}{P_{\text{trigger}}} \right) \times 100\%$$
   * **Short Setup:**
     $$\text{MAE}_{\text{Short}} = \min_{t \in [t_{\text{entry}}, t_{\text{exit}}]} \left( \frac{P_{\text{trigger}} - \text{High}_t}{P_{\text{trigger}}} \right) \times 100\%$$

---

### 4.2 Acceptance Criteria (AC)

#### AC 1: Streaming Ingestion & High/Low Watermarks
* **AC 1.1:** The calculation engine MUST evaluate price excursions on every streaming trade tick or 1-minute consolidated candle bar.
* **AC 1.2:** The high watermark ($\text{HWM}$) and low watermark ($\text{LWM}$) must update monotonically:
  $$\text{HWM}_t = \max(\text{HWM}_{t-1}, \text{High}_t), \quad \text{LWM}_t = \min(\text{LWM}_{t-1}, \text{Low}_t)$$
* **AC 1.3:** $\text{MFE}$ can never decrease during the trade lifecycle; $\text{MAE}$ can never increase towards zero once a drawdown has occurred.

#### AC 2: Order of Execution & Bar Conflicts
* **AC 2.1:** If a single 1-minute bar touches **both** $\text{Target 1}$ and $\text{Invalidation Price}$ (e.g. during a high-volatility halt or sudden spread spike), the system MUST default conservatively to **`STOPPED_OUT`** unless tick-by-tick millisecond sequence records the target execution prior to the stop price.
* **AC 2.2:** Slippage simulation: If the bar opens below the invalidation price (gap down), the exit price recorded MUST be the bar's open price, not the theoretical invalidation level, reflecting real-world slippage.

#### AC 3: Session Expiry & Market Hours
* **AC 3.1:** Regular Trading Hours (RTH: 09:30–16:00 EST) are the official benchmark for signal terminal states.
* **AC 3.2:** If an intraday setup reaches 16:00 EST without touching Target 1 or Invalidation, its state transitions to `EXPIRED`. Its final exit price is recorded as the official 16:00 EST closing print.
* **AC 3.3:** Pre-market (04:00–09:30 EST) and After-hours (16:00–20:00 EST) price excursions are tracked with an `EXTENDED_HOURS` tag and reported separately so low-liquidity spikes do not distort official RTH metrics.

#### AC 4: Automated Metric Recomputation
* **AC 4.1:** Rolling 30-day summary metrics (Hit Rate, Median MFE, Median MAE, Realized $R:R$) MUST recompute automatically whenever a signal reaches a terminal state or a new day opens.
* **AC 4.2:** No manual data entry or static overrides are permitted.

---

## 5. Integration With Existing Real-Time Architecture

The Signal Track Record Engine integrates directly into Trade Opportunities without disrupting existing services:

1. **`index.js` Background Pipeline:**
   * Keeps Alpha Vantage live market crawler intact (`TOP_GAINERS_LOSERS`).
   * Updates the Gemini LLM system prompt to adhere strictly to the practitioner voice and tone guidelines.
2. **`short-series/src/pages/api/` Endpoints:**
   * `/api/track-record.ts` dynamically serves real-time rolling metrics computed from the live blog posts and TradingView scanner feeds.
3. **`short-series/src/components/` UI Layer:**
   * `SignalTrackRecord.astro` provides the interactive summary card, filter pills, search bar, and audit ledger.
   * Embedded inside `LiveStockScreener.astro` and `index.astro` to serve as the platform's transparent proof engine.

---
*End of Specification. Approved for Production Deployment by Principal Fintech Brand Strategist & Quantitative Product Architect.*
