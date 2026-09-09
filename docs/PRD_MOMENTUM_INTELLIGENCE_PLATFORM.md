# Product Requirements Document (PRD) & Technical Specification

**Product:** Trade Opportunities (`tradeopportunities.trade`)  
**Document Owner:** Principal Fintech Product Manager & Full-Stack Architect  
**Status:** Approved for Implementation / Architecture Baseline  
**Target Delivery:** Q4 2026 / Q1 2027  
**Repository:** `robzzzzu-cmd/AI-farm-w-`  

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 Background
Trade Opportunities (`tradeopportunities.trade`) operates as an algorithmic market discovery terminal designed to surface equity momentum, volume breakouts, and volatility anomalies. While its underlying quantitative scanner (powered by TradingView Scanner APIs and Alpha Vantage feeds) reliably captures large price fluctuations, the platform currently suffers from critical retention and positioning bottlenecks that impede user acquisition, engagement, and conversion.

### 1.2 Core Friction Points & Root Causes

| Friction Point | Current Architecture / State | Root Cause Analysis | Target State |
| :--- | :--- | :--- | :--- |
| **1. Jargon-Heavy Positioning** | Hero declares: *"Quantitative Market Intelligence & Volatility Monitoring"*; descriptions highlight *"Automated quantitative tracking of high-momentum equity breakouts..."* | Positioned as an institutional quant lab rather than an actionable retail trading tool. Retail momentum and swing traders land on the site without immediate clarity on *what to do next*. | Action-oriented, retail-accessible momentum discovery engine with clear trader personas, explicit utility, and instant 1-click CTA pathways. |
| **2. Low Daily Retention** | Users consume a read-only list of top gainers/losers or static tables. No personalized tracking, no stateful session memory, no push triggers. | Absence of a personalized monitoring engine. Traders leave the tab because they cannot pin their active watchlist or get alerted when specific breakout thresholds trigger. | Embedded dynamic watchlist and real-time alert matrix directly in the `Live Screener` view with client-side persistence and WebSocket delta pushes. |
| **3. Content Bloat & Feed Spam** | Background runner (`index.js`) executes repeatedly against Alpha Vantage `TOP_GAINERS_LOSERS`, generating up to 8–12 repetitive micro-articles per day (e.g. 5+ distinct posts on Sep 4 & Sep 8). | Ingestion script creates a standalone Markdown post for individual ticker moves with redundant templated prose, diluting SEO domain authority and exhausting reader signal-to-noise ratio. | Single continuously updating real-time dashboard module (**Market Radar**), backed by exactly three time-gated high-signal narrative daily briefs (Morning, Midday, Close). |
| **4. Raw Gainers Without Attribution** | Tables show raw ticker, price, change %, and volume without context. | Retail traders cannot discern between a legitimate catalyst breakout (e.g. biotech Phase 3 FDA approval) and a toxic penny stock dilution pump (e.g. reverse-split S-3 ATM offering). | Automated 5-layer diagnostic attribution engine: **"Why Is It Moving?"** detailing Catalyst, Technical context, Liquidity, Market Behavior, and Risk Rating with a standardized 2–3 word synthesis verdict. |

---

## 2. Hero & Value Proposition Repositioning

### 2.1 Persona-Tailored Value Propositions

To eliminate friction and jargon paralysis, the hero section will support three targeted positioning angles dynamically selectable or tailored to user cohorts:

```
+---------------------------------------------------------------------------------------------------+
| [TRADE OPPORTUNITIES]                                                [Dashboard]  [Theme]  [Scan]  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|   [ ACTIVE PERSONA PILLS:  (Intraday Momentum)  |  (Retail Swing)  |  (Data-Driven Quant) ]       |
|                                                                                                   |
|   HEADLINE: Catch Breakouts Before the Crowd — Backed by Volume & Catalyst Proof.                |
|   SUBHEAD:  Filter 10,000+ US stocks in real time. Track volume surges (RVOL ≥ 3x), consolidated  |
|             range breaches, and instant "Why Is It Moving?" diagnostics without latency.          |
|                                                                                                   |
|   [ Scan Live Breakouts -> ]    [ + Pin First Ticker ]     [ Quick Try: NVDA  TSLA  AMD  PLTR ]   |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

#### Persona 1: Intraday Momentum Traders
* **Headline:**  
  *“Spot Explosive RVOL Surges & Opening Drive Momentum in Real Time.”*
* **Subheadline:**  
  *“Stop chasing extended runners. Our real-time scanner flags sub-$10 and mid-cap runners the moment Relative Volume spikes past $3.0\times$ with aggressive bid lifting.”*
* **Value Hooks:** Sub-second ticker latency, VWAP breakout detection, micro-cap spread warnings, float turnover tracking.

#### Persona 2: Retail Swing Traders Looking for Breakout Alerts
* **Headline:**  
  *“Catch Multi-Day Stage-2 Breakouts with Verified Catalyst Backing.”*
* **Subheadline:**  
  *“Filter out dead-cat bounces and toxic dilution pumps. Isolate multi-week consolidation breaches backed by clean earnings surprises, institutional accumulation, and zero shelf-offering risk.”*
* **Value Hooks:** 20-day / 52-week high breaches, S-3 dilution risk checks, multi-day continuation indicators, swing alert matrix.

#### Persona 3: Data-Driven Retail Quants
* **Headline:**  
  *“Systematic Momentum Discovery Powered by Volume Profiling & Attribution Layers.”*
* **Subheadline:**  
  *“Replace raw percentage noise with multi-variable market telemetry: float turnover distribution, relative volume standard deviations, order flow tilt, and structured narrative classification.”*
* **Value Hooks:** Transparent conviction and momentum scoring algorithms, cross-sectional sector liquidity flows, JSON API exportability.

### 2.2 Call-to-Action (CTA) Architecture & Placement

1. **Primary Action ("Scan Live Breakouts"):**
   * **Placement:** Primary high-contrast button (`--brand-accent`) placed in the upper-left focal zone of the Hero.
   * **Behavior:** Smooth-scrolls directly to `#screener-engine` and auto-focuses the high-conviction momentum tab.
2. **Secondary Action ("Track Your First Ticker"):**
   * **Placement:** Secondary bordered button (`--bg-surface-elevated`) adjacent to primary CTA.
   * **Behavior:** Opens the embedded Quick-Add Watchlist popover, enabling the user to input a ticker symbol (`e.g. NVDA`) in under 2 seconds.
3. **Interactive Friction Reducer ("Instant Chip Bar"):**
   * **Placement:** Directly underneath CTAs.
   * **Content:** Preset clickable ticker pills: `+ Watch $NVDA`, `+ Watch $TSLA`, `+ Watch $AMD`, `+ Watch $PLTR`, `+ Watch $SMCI`.
   * **Action:** Clicking immediately writes the symbol to client-side storage and populates the Watchlist Matrix without navigating away.

---

## 3. Retention Engine: Dynamic Watchlist & Alert Matrix

### 3.1 UX Architecture & Embedded Placement
The Watchlist & Alert Matrix is embedded directly within the primary `Live Screener` interface (`/screener` and the home terminal), pinned either as a dedicated collapsible left/top split pane or a toggleable sticky panel above the screener data grid.

### 3.2 Watchlist Mechanics & Telemetry Matrix
Users can add any valid US ticker. Each ticker row continuously updates with the following telemetry:
* **Price & Delta:** Last traded price, intraday absolute delta, and percentage change.
* **RVOL ($\text{Relative Volume}$):** Calculated as $\frac{\text{Current Cumulative Volume at Minute } t}{\text{10-Day Benchmark Volume at Minute } t}$.
* **Signal State:** Automated finite state machine computing:
  * `MOMENTUM`: Change $> +3.5\%$, $\text{RVOL} \ge 2.0$, RSI $> 55$.
  * `BREAKOUT`: Breaking above 20-day high or consolidating range within $1.5\%$ of session highs on elevated RVOL.
  * `WEAKNESS`: Dropping below VWAP, change $< -2.5\%$, or RSI $< 40$ with distribution volume.
  * `NEUTRAL`: Rangebound within consolidation boundaries.
* **User Trigger Matrix (Checkboxes per Ticker):**
  * `[x] Move >= ±5%`: Trigger when intraday absolute move crosses 5%.
  * `[x] RVOL >= 3.0x`: Trigger when session volume is 300% of historical expectation.
  * `[x] Technical Breakout`: Trigger on consolidation breach (e.g. 20-day high or multi-session resistance breach).
  * `[x] Catalyst Indexed`: Trigger when a new SEC filing (8-K, 13D), earnings PR, or FDA update is indexed for the ticker.

### 3.3 Data Schema: User Watchlist & Alert Settings (JSON)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UserWatchlistSettings",
  "type": "object",
  "properties": {
    "userId": { "type": "string", "format": "uuid" },
    "anonymousSessionId": { "type": "string" },
    "lastUpdated": { "type": "string", "format": "date-time" },
    "preferences": {
      "audioAlertsEnabled": { "type": "boolean", "default": true },
      "browserNotificationsEnabled": { "type": "boolean", "default": false },
      "toastNotificationsEnabled": { "type": "boolean", "default": true },
      "refreshCadenceSeconds": { "type": "integer", "default": 5, "minimum": 2, "maximum": 60 }
    },
    "watchlist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ticker": { "type": "string", "pattern": "^[A-Z]{1,5}$" },
          "addedAt": { "type": "string", "format": "date-time" },
          "notes": { "type": "string", "maxLength": 140 },
          "alertTriggers": {
            "type": "object",
            "properties": {
              "pctMoveThreshold": { "type": "number", "default": 5.0 },
              "pctMoveEnabled": { "type": "boolean", "default": true },
              "rvolThreshold": { "type": "number", "default": 3.0 },
              "rvolEnabled": { "type": "boolean", "default": true },
              "breakoutEnabled": { "type": "boolean", "default": true },
              "breakoutType": { 
                "type": "string", 
                "enum": ["20_DAY_HIGH", "52_WEEK_HIGH", "RESISTANCE_RANGE", "VWAP_CROSS"], 
                "default": "20_DAY_HIGH" 
              },
              "catalystIndexedEnabled": { "type": "boolean", "default": true }
            },
            "required": ["pctMoveEnabled", "rvolEnabled", "breakoutEnabled", "catalystIndexedEnabled"]
          }
        },
        "required": ["ticker", "addedAt", "alertTriggers"]
      }
    }
  },
  "required": ["lastUpdated", "preferences", "watchlist"]
}
```

### 3.4 WebSocket Telemetry & Push Alert Payload Specification

To eliminate full-page re-renders and excessive polling overhead, client terminals maintain a single persistent WebSocket connection (`wss://stream.tradeopportunities.trade/v1/telemetry`) with client-side subscription channels.

#### Client Subscription Message:
```json
{
  "action": "SUBSCRIBE_WATCHLIST",
  "symbols": ["NVDA", "TSLA", "AMD", "PLTR"],
  "clientId": "usr_anon_7f8a9e21",
  "clientTimestamp": 1788960957000
}
```

#### Real-Time Telemetry Delta Payload (`TELEMETRY_DELTA`):
```json
{
  "event": "TELEMETRY_DELTA",
  "timestamp": 1788960957450,
  "data": {
    "ticker": "NVDA",
    "price": 128.45,
    "delta": 6.85,
    "pctChange": 5.63,
    "volume": 48291000,
    "rvol": 3.42,
    "vwap": 124.10,
    "signalState": "BREAKOUT",
    "dayHigh": 129.00,
    "dayLow": 122.30,
    "spreadPct": 0.02
  }
}
```

#### Real-Time Alert Event Trigger (`ALERT_TRIGGERED`):
```json
{
  "event": "ALERT_TRIGGERED",
  "alertId": "alt_99f2b1a8-9b87",
  "timestamp": 1788960957480,
  "ticker": "NVDA",
  "triggersSatisfied": [
    {
      "trigger": "PCT_MOVE",
      "threshold": 5.0,
      "actual": 5.63,
      "message": "Intraday move exceeded +5.0% (+5.63%)"
    },
    {
      "trigger": "RVOL",
      "threshold": 3.0,
      "actual": 3.42,
      "message": "Relative volume crossed 3.0x (3.42x ADV)"
    },
    {
      "trigger": "TECHNICAL_BREAKOUT",
      "breakoutType": "20_DAY_HIGH",
      "keyLevel": 127.80,
      "message": "Breached 20-day high ($127.80) on high relative volume"
    }
  ],
  "urgency": "HIGH",
  "audioSound": "CHIME_ASCENDING",
  "whyIsItMovingPreview": "Q3 Datacenter Revenue beat consensus by 14%; multiple analyst price target revisions."
}
```

---

## 4. Content Streamlined: "Market Radar" & Scheduled Dispatches

### 4.1 Decommissioning Automated Micro-Article Spam
The existing system (`index.js` triggering Alpha Vantage to write duplicate markdown posts) will be replaced. Instead of flooding `/src/content/blog/` with individual ticker updates every few hours:
1. All individual ticker updates feed into the **Market Radar** live module.
2. The publishing system publishes exactly **three structured, narrative market briefs** per trading day.

### 4.2 Live Dashboard Module: "Market Radar" Specification
The Market Radar is a centralized, live updating HUD container located on the terminal home view and top of the screener.

#### Live Radar Structure & Elements:
* **EST & UTC Market Clock:** Precise session countdown (Pre-market, Regular Hours, After-hours countdown).
* **Macro Regime Gauge:** Real-time algorithmic classification:
  * `RISK-ON`: $SPY > 20 EMA, $QQQ outperforming, $VIX < 16, Sector Breadth > 65% advancing.
  * `RISK-OFF`: $SPY < VWAP, $VIX spiking > 20, Defensive sectors (XLU, XLV, XLP) leading.
  * `ROTATION / MIXED`: Tech lagging while cyclicals/energy lead; dispersion elevated.
* **Top Setup of the Session:** Lead stock matching highest algorithmic conviction (Highest combined Momentum Score, clean float, verifiable catalyst).
* **Breakout Candidates (Top 3):** Stocks breaking key technical structures on $RVOL \ge 2.5\times$.
* **Reversal Candidates (Top 3):** Exhaustion gainers or gap-down bounce plays holding VWAP support.
* **Large-Cap Anchor Leader:** Heaviest weighted stock ($> \$10\text{B}$) exhibiting institutional accumulation.

### 4.3 Scheduled Publishing Cadence & Production Prompts

```
+-----------------------------------------------------------------------------------------------+
| SCHEDULED DISPATCH CADENCE (US Eastern Time)                                                  |
+------------------------------------+------------------------------------+---------------------+
| 1. Morning Momentum Brief           | 2. Midday Market Update            | 3. Closing Report   |
| 08:45 AM - 09:15 AM EST            | 12:00 PM - 12:30 PM EST            | 16:15 PM - 16:45 PM |
| Focus: Pre-market gaps & catalysts | Focus: Consolidation & midday VWAP | Focus: Daily wrap   |
+------------------------------------+------------------------------------+---------------------+
```

#### Brief 1: Morning Momentum Brief (Pre-Market / Open, 08:45 – 09:15 AM EST)
* **Objective:** Prepare active traders with top pre-market gap leaders, catalyst attribution, macro economic releases (CPI, Jobs, Fed), and key support/resistance levels before the opening bell.
* **Structured Generation Prompt:**
```text
SYSTEM PROMPT:
You are the Chief Market Strategist for Trade Opportunities (tradeopportunities.trade).
Generate the "Morning Momentum Brief" for [DATE] using the provided pre-market quantitative telemetry.
Follow this rigid markdown template:

# Morning Momentum Brief: [Macro Hook / Lead Catalyst Ticker] — [DATE]

## 1. Macro Regime & Pre-Market Tone
- SPY / QQQ Pre-market status & delta
- 10-Year Treasury Yield and VIX status
- Key economic data releases scheduled for today (e.g. 08:30 AM / 10:00 AM releases)
- Primary Regime: [RISK-ON | RISK-OFF | SELECTIVE ROTATION]

## 2. Top Catalyst Movers & Gap Leaders
(Provide a table for top 4 gap movers with Ticker, Gap %, Pre-Market Volume, RVOL, and 1-sentence catalyst attribution)

## 3. High-Conviction Opening Drive Setups
For each of the top 2 setups:
### $[TICKER] — [Key Level to Hold]
- Catalyst Context
- Pivot Levels: Long entry trigger, Risk invalidation level, Target expansion
- Float & Risk Warning (Short interest, float turnover, dilution flags)

## 4. Key Execution Parameters for the Open
- Spread precautions, liquidity traps, and sector sympathy plays to monitor.

TONE & CONSTRAINTS:
Direct, actionable, professional trader vernacular. No financial advice disclaimers in the main body (handled by global footer). Zero repetitive filler. Keep total length under 600 words.
```

#### Brief 2: Midday Market Update (Consolidation & Continuation, 12:00 – 12:30 PM EST)
* **Objective:** Identify morning winners consolidating above VWAP, afternoon continuation setups, false breakout traps, and midday institutional block trades.
* **Structured Generation Prompt:**
```text
SYSTEM PROMPT:
You are the Chief Market Strategist for Trade Opportunities.
Generate the "Midday Market Update" for [DATE] based on session telemetry at 12:00 PM EST.

# Midday Market Update: Range Breakouts & Afternoon Continuation Plays — [DATE]

## 1. Midday Session Temperature
- Morning trend confirmation or failure
- Volume trajectory (Is afternoon volume expected to taper?)
- Leading vs Lagging Sectors (XLK, XBI, XLE, etc.)

## 2. Morning Runners: Hold vs Fade
(Analyze whether the morning's top 3 momentum leaders are consolidating above VWAP or experiencing distribution)

## 3. Afternoon Breakout Watchlist
- 3 tickers compressing near high-of-day with volume drying up on pullbacks.
- Breakout trigger prices and volume confirmation rules.

TONE: Objective, tactical, focused on midday trap avoidance and volume dry-up analysis. Under 450 words.
```

#### Brief 3: Closing Momentum Report (Daily Wrap & Overnight Setups, 16:15 – 16:45 PM EST)
* **Objective:** Comprehensive review of the trading day, post-market earnings movers, sector performance summary, and overnight gap-watch candidate list.
* **Structured Generation Prompt:**
```text
SYSTEM PROMPT:
You are the Chief Market Strategist for Trade Opportunities.
Generate the "Closing Momentum Report" for [DATE] following the 4:00 PM EST cash close.

# Closing Momentum Report: Session Recap & Overnight Catalyst Watch — [DATE]

## 1. Cash Session Summary & Breadth Metrics
- SPY, QQQ, IWM closing metrics
- Advance/Decline ratio, 52-week new highs vs new lows
- Regime verdict of the session

## 2. Day's Top Momentum Leaders: Attribution Post-Mortem
(Table of top 5 gainers with closing % change, total volume, RVOL, and attribution verdict)

## 3. Post-Market Earnings & Breaking News
- Key after-hours earnings reports and immediate price reactions.

## 4. Tomorrow's Watchlist Candidates
- 3 tickers showing strong daily closes on highest volume percentiles poised for multi-day continuation.

TONE: Analytical, educational, concise. Under 550 words.
```

---

## 5. Proprietary Differentiator: "Why Is It Moving?" Context Layer

### 5.1 Ingestion & Parsing Pipeline Architecture
Rather than displaying naked percent gainers that leave retail traders vulnerable to pump-and-dump dilution traps, Trade Opportunities executes an automated real-time enrichment pipeline:

```
+----------------------------------------------------------------------------------------------------+
| DATA INGESTION SOURCES                                                                            |
| 1. SEC EDGAR API (8-K, 13D/G, S-3, Form 4)                                                         |
| 2. News Feeds (Benzinga / Polygon / PR Newswire / GlobeNewswire)                                   |
| 3. Order Flow & Tick Telemetry (Consolidated tape, VWAP, Level 2 spread, RVOL)                    |
+----------------------------------------------------------------------------------------------------+
                                      |
                                      v
+----------------------------------------------------------------------------------------------------+
| 5-LAYER DIAGNOSTIC ENRICHMENT PIPELINE                                                             |
|                                                                                                    |
|  [ Layer 1: Catalyst Extraction ]  --> NLP extraction of core news trigger / filings               |
|  [ Layer 2: Technical Structure ]  --> 20D/52W highs, VWAP delta, ATR expansion, RVOL              |
|  [ Layer 3: Liquidity Profile   ]  --> Float size, ADV comparison, Float turnover %                |
|  [ Layer 4: Market Behavior     ]  --> Short squeeze index, bid aggression, spread velocity       |
|  [ Layer 5: Risk & Dilution     ]  --> S-3 ATM offering on file, micro-cap warning, wide spreads    |
+----------------------------------------------------------------------------------------------------+
                                      |
                                      v
+----------------------------------------------------------------------------------------------------+
| SYNTHESIS VERDICT CLASSIFIER                                                                       |
| Outputs standardized 2-3 word verdict: e.g. "HIGH MOMENTUM / HIGH RISK" or "CLEAN BREAKOUT"        |
+----------------------------------------------------------------------------------------------------+
```

### 5.2 The 5 Diagnostic Layers Explained

1. **Layer 1: Catalyst Extraction:**
   * Natural language parsing of press releases, SEC filings, or FDA decisions.
   * Categorization into standardized catalyst types: `EARNINGS_BEAT`, `FDA_APPROVAL`, `CONTRACT_AWARD`, `PARTNERSHIP`, `M&A_SPECULATION`, `ANALYST_UPGRADE`, `OFFERING_DILUTION`, `UNCONFIRMED_SOCIAL_MOMENTUM`.
2. **Layer 2: Technical Structure:**
   * Price context relative to key milestones: Distance to 52-week High, 20-day High, Intraday VWAP, and multi-week consolidation resistance.
   * Volume metrics: RVOL multiplier ($\text{RVOL} \ge 3.0\times$ baseline) and ATR expansion percentage.
3. **Layer 3: Liquidity Profile:**
   * Free trading float evaluation (e.g. Low Float: $< 15\text{M}$ shares; Mid Float: $15\text{M} - 100\text{M}$; High Float: $> 100\text{M}$).
   * **Float Turnover:** $\frac{\text{Current Session Volume}}{\text{Free Float}}$. Turnover $> 100\%$ indicates extreme hyper-rotation.
   * Dollar Volume liquidity check ($\text{Price} \times \text{Volume}$) guaranteeing trade execution feasibility.
4. **Layer 4: Market Behavior:**
   * Short Interest Estimate & Days-to-Cover (DTC).
   * Aggressive Bid Lifting: Proportion of trades printing at the Ask vs the Bid.
   * Uptick-to-Downtick ratio and consecutive green bar velocity.
5. **Layer 5: Risk Rating:**
   * Dilution Risk Scanner: Detects active Form S-3 (shelf registration), At-The-Market (ATM) financing agreements, or convertible debt history.
   * Spread & Slippage Warning: Spreads $> 1.0\%$ flagged with `WIDE SPREAD / EXECUTION RISK`.
   * Penny Stock Classification: Sub-$1.00 equities with reverse split histories flagged with `PUMP DILUTION HAZARD`.

### 5.3 Standardized Synthesis Verdicts
Every analyzed stock receives one of 8 standardized, color-coded 2-to-3-word output badges:
* 🟢 `CLEAN CATALYST / LOW RISK` (Institutional earnings beat, large cap, tight spreads).
* 🟢 `INSTITUTIONAL ACCUMULATION` (High dollar volume, multi-week consolidation breach).
* 🟡 `HIGH MOMENTUM / HIGH RISK` (Sub-$5, RVOL $> 5.0\times$, high volatility, low float).
* 🟡 `SHORT SQUEEZE EXPANSION` (High short interest $> 25\%$, float turnover $> 100\%$).
* 🔴 `DILUTION RISK / OFFERING PENDING` (Active S-3 shelf registration or recent warrant filing).
* 🔴 `EXHAUSTION GAP / FADE BIAS` (Extreme gap $> 40\%$ on micro-cap without fundamental backing).
* 🔵 `SYMPATHY ROTATION / SECTOR FLOW` (Riding coattails of sector leader without independent news).
* ⚪ `BALANCED FLOW / RANGEBOUND` (No identifiable dominant catalyst).

---

## 6. Functional Specifications & User Stories

### Feature 1: Hero Discovery & Instant Watchlist Onboarding
* **User Story:** As an intraday momentum trader landing on Trade Opportunities, I want to immediately see actionable live breakouts and pin a ticker to my watchlist with 1 click, so that I can monitor momentum without navigating complex setups.
* **Acceptance Criteria:**
  * **Given** a user loads `tradeopportunities.trade` on desktop or mobile,
  * **When** they view the Hero container,
  * **Then** they must see persona selector pills, dynamic headline/subheadlines, a primary "Scan Live Breakouts" CTA, and an interactive ticker quick-add bar (`NVDA`, `TSLA`, `AMD`, `PLTR`).
  * **Given** an unauthenticated visitor clicks "+ Watch $NVDA",
  * **When** the click event fires,
  * **Then** `$NVDA` is instantly added to `localStorage['to_watchlist_v1']`, a confirmation toast appears ("$NVDA added to Live Watchlist"), and the embedded Watchlist drawer increments its counter without page reload.

### Feature 2: Watchlist Matrix & Multi-Condition Alert Engine
* **User Story:** As a retail swing trader, I want to configure multi-condition alert checkboxes ($\pm 5\%$, $\text{RVOL} \ge 3.0\times$, 20-day high breach, catalyst index) on my watchlisted tickers, so that I receive immediate audiovisual notifications when my setup criteria are met.
* **Acceptance Criteria:**
  * **Given** a watchlisted ticker in the Screener matrix,
  * **When** the user toggles any of the 4 trigger checkboxes (`Move ±5%`, `RVOL 3x`, `Breakout`, `Catalyst`),
  * **Then** the updated trigger states are debounced and saved to client storage in $< 100\text{ms}$.
  * **Given** incoming WebSocket telemetry pushes a price tick causing RVOL to reach $3.2\times$ and change % to hit $+5.2\%$,
  * **When** both enabled criteria are met for ticker `$XYZ`,
  * **Then** the row flashes an alert accent color (`#3b82f6`), an audio chime triggers (if sound enabled), and a desktop browser notification fires (if permission granted).
  * **Given** an alert triggers for `$XYZ`,
  * **When** subsequent ticks continue to exceed thresholds within 15 minutes,
  * **Then** the engine suppresses repeat alerts using a 15-minute cooldown debounce to prevent alert storming.

### Feature 3: Real-Time Market Radar Dashboard
* **User Story:** As a retail trader, I want a single centralized "Market Radar" dashboard card that displays real-time regime, top setups, breakout candidates, and reversal risks, so that I don't have to scroll through repetitive micro-articles to understand market posture.
* **Acceptance Criteria:**
  * **Given** the Market Radar component is mounted,
  * **When** market telemetry updates every 5–15 seconds,
  * **Then** the component displays: Live UTC/EST market clock, Macro Regime (`RISK-ON` / `RISK-OFF`), Top Setup with Conviction Score, Top 3 Breakout Candidates, Top 3 Reversal Risks, and Large-Cap Anchor Leader.
  * **Given** the three daily brief publication windows (08:45 AM, 12:00 PM, 16:15 PM EST),
  * **When** a new scheduled brief is generated,
  * **Then** the Market Radar features a 1-click preview link to the latest brief, completely replacing individual ticker blog posts.

### Feature 4: "Why Is It Moving?" Attribution Drawer
* **User Story:** As a trader evaluating a $+25\%$ penny stock gainer, I want to click "Why Is It Moving?" to inspect a structured 5-layer diagnostic breakdown, so that I do not buy into an imminent secondary offering or illiquid spread trap.
* **Acceptance Criteria:**
  * **Given** any ticker displayed in the Screener or Watchlist,
  * **When** the user clicks the "Why Moving?" pill or row action,
  * **Then** a modal/drawer opens within $200\text{ms}$ rendering:
    1. Catalyst Summary & Category,
    2. Technical Pivot Context & RVOL multiplier,
    3. Float size and Float Turnover %,
    4. Order flow aggression & short interest estimate,
    5. Dilution & Spread Risk Rating,
    6. Prominent Standardized Verdict Badge (e.g., `HIGH MOMENTUM / HIGH RISK`).

---

## 7. UI/UX Wireframe Specifications

### 7.1 Unified Dashboard & Live Screener Layout (Desktop View)

```
====================================================================================================
[TRADE OPPORTUNITIES]   [Radar] [Screener] [Watchlist (4)] [Briefs] [About]    [Search: Ticker] [Theme]
====================================================================================================

+--------------------------------------------------------------------------------------------------+
| HERO REPOSITIONING BANNER                                                                        |
| [ Intraday Momentum ]  [ Retail Swing Alerts ]  [ Quantitative Edge ]                            |
| Catch High-Velocity Breakouts Before The Crowd — Backed by Volume & Catalyst Proof              |
| [ Scan Live Breakouts -> ]    [ + Pin Ticker ]       Trending: [NVDA +6.2%] [AMD +4.1%] [TSLA]   |
+--------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------+
| MARKET RADAR HUD                                                   [Live Feed • 14:22:05 EST]    |
+----------------------+--------------------+--------------------+---------------------------------+
| MACRO REGIME         | TOP CONVICTION     | BREAKOUT SURGES    | REVERSAL / FADE RISKS           |
| [ RISK-ON (82%) ]    | $NVDA ($128.45)    | 1. $SMCI (RVOL 4.1)| 1. $XYZ (Exhaustion +38%)       |
| SPY +1.1% | VIX 14.2 | Verdict: CLEAN RUN | 2. $IONQ (RVOL 3.6)| 2. $ABC (-8% below VWAP)        |
+----------------------+--------------------+--------------------+---------------------------------+
| Daily Briefs: [08:45 Morning Brief ->]   [12:00 Midday Update ->]   [16:15 Closing Wrap ->]      |
+--------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------+
| WATCHLIST & REAL-TIME ALERT MATRIX                                     [+ Add Ticker: ________ ]  |
+--------+---------+--------+--------+------------------+----------------------------------+--------+
| Ticker | Price   | Delta  | RVOL   | Signal State     | Active Alert Trigger Checkboxes  | Action |
+--------+---------+--------+--------+------------------+----------------------------------+--------+
| $NVDA  | $128.45 | +5.63% | 3.42x  | [🟢 BREAKOUT]   | [x] ±5%  [x] 3x RVOL  [x] Brkout | [Why?] |
| $PLTR  | $32.10  | +3.85% | 2.15x  | [🟢 MOMENTUM]   | [x] ±5%  [ ] 3x RVOL  [x] Brkout | [Why?] |
| $TSLA  | $214.20 | -1.15% | 1.10x  | [⚪ NEUTRAL]    | [x] ±5%  [x] 3x RVOL  [ ] Brkout | [Why?] |
| $CDTG  | $4.15   | +28.4% | 6.80x  | [🟡 HIGH RISK]  | [x] ±5%  [x] 3x RVOL  [x] Brkout | [Why?] |
+--------+---------+--------+--------+------------------+----------------------------------+--------+

+--------------------------------------------------------------------------------------------------+
| UNIFIED LIVE SCREENER ENGINE                                                                     |
| Filters: [Penny (<$5)]  [Small/Mid ($300M-$10B)]  [Large (>$10B)]   Min RVOL: [ 2.0x v ]         |
+--------+---------+--------+-------+--------+-------------+---------------------+-----------------+
| Symbol | Price   | % Chg  | Vol   | RVOL   | Conviction  | Why Is It Moving?   | Quick Action    |
+--------+---------+--------+-------+--------+-------------+---------------------+-----------------+
| $SMCI  | $452.10 | +8.42% | 12.4M | 4.12x  | 88 [High]   | Datacenter contract | [+ Watch] [Why] |
| $IONQ  | $14.25  | +7.15% | 8.9M  | 3.65x  | 82 [High]   | Quantum partnership | [+ Watch] [Why] |
| $MBLY  | $16.80  | +6.10% | 4.2M  | 2.80x  | 74 [Medium] | Upgraded by MorganS | [+ Watch] [Why] |
+--------+---------+--------+-------+--------+-------------+---------------------+-----------------+
```

### 7.2 "Why Is It Moving?" Diagnostic Card Wireframe (Modal / Slide-Over Drawer)

```
+--------------------------------------------------------------------------------------------------+
| DIAGNOSTIC ATTRIBUTION: $CDTG (CDT Environmental)                                        [ X ]   |
| Last Price: $4.15  |  Delta: +28.4%  |  Session Volume: 14.8M  |  RVOL: 6.8x                     |
+--------------------------------------------------------------------------------------------------+
| SYNTHESIS VERDICT:                                                                               |
| [ 🟡 HIGH MOMENTUM / HIGH RISK — DILUTION WARNING ]                                              |
+--------------------------------------------------------------------------------------------------+
| 1. CATALYST LAYER                                                                                |
| Category: CONTRACT_AWARD (Unverified Third-Party Distribution Agreement)                         |
| Summary:  Announced non-binding MOU for Southeast Asia distribution. No revenue guidance.        |
| Source:   GlobeNewswire (08:15 EST)                                                             |
+--------------------------------------------------------------------------------------------------+
| 2. TECHNICAL STRUCTURE                                                                           |
| 20-Day Range Breach: YES ($3.40 breached)  |  Distance to 52W High: -42.0%                       |
| Session VWAP: $3.82 (Trading +8.6% above VWAP) | Relative Volume: 6.82x (Extreme Expansion)      |
+--------------------------------------------------------------------------------------------------+
| 3. LIQUIDITY PROFILE                                                                             |
| Free Float: 6.4M shares (Low Float)        |  Float Turnover: 231.2% (Hyper-Rotated > 2x)       |
| 30-Day ADV: 1.2M shares                    |  Dollar Volume: $61.4M (Liquid for retail)          |
+--------------------------------------------------------------------------------------------------+
| 4. MARKET BEHAVIOR & ORDER FLOW                                                                  |
| Bid/Ask Aggression: 68% Ask Lifting        |  Short Interest: 14.2% of Float                     |
| Uptick Ratio: 1.84                         |  Order Flow Tilt: Aggressive Retail Chasing         |
+--------------------------------------------------------------------------------------------------+
| 5. RISK RATING & DILUTION HAZARDS                                                                |
| [!] Shelf Offering (S-3) Active: YES ($50M ATM facility on file with SEC, filed 45 days ago).    |
| [!] Spread Warning: Average spread 1.4% ($0.06). Market orders risk immediate slippage.          |
| [!] Reverse Split History: 1-for-20 split executed within past 12 months.                        |
+--------------------------------------------------------------------------------------------------+
| ACTION BUTTONS:                                                                                  |
| [ + Pin $CDTG to Watchlist with ±5% Alert ]        [ Open Full SEC Filing ]       [ Chart (TV) ] |
+--------------------------------------------------------------------------------------------------+
```

---

## 8. Data Models & Technical Logic (TypeScript & Pseudo-Algorithms)

### 8.1 TypeScript Interfaces

```typescript
// types/momentumEngine.ts

export type SignalState = 'MOMENTUM' | 'BREAKOUT' | 'WEAKNESS' | 'NEUTRAL';
export type MacroRegime = 'RISK-ON' | 'RISK-OFF' | 'SELECTIVE_ROTATION';
export type CatalystCategory = 
  | 'EARNINGS_BEAT'
  | 'FDA_APPROVAL'
  | 'CONTRACT_AWARD'
  | 'PARTNERSHIP'
  | 'M&A_SPECULATION'
  | 'ANALYST_UPGRADE'
  | 'OFFERING_DILUTION'
  | 'UNCONFIRMED_SOCIAL_MOMENTUM'
  | 'NONE_DETECTED';

export type SynthesisVerdict =
  | 'CLEAN CATALYST / LOW RISK'
  | 'INSTITUTIONAL ACCUMULATION'
  | 'HIGH MOMENTUM / HIGH RISK'
  | 'SHORT SQUEEZE EXPANSION'
  | 'DILUTION RISK / OFFERING PENDING'
  | 'EXHAUSTION GAP / FADE BIAS'
  | 'SYMPATHY ROTATION / SECTOR FLOW'
  | 'BALANCED FLOW / RANGEBOUND';

export interface AlertTriggerConfig {
  pctMoveEnabled: boolean;
  pctMoveThreshold: number; // e.g. 5.0 for 5%
  rvolEnabled: boolean;
  rvolThreshold: number; // e.g. 3.0 for 3x ADV
  breakoutEnabled: boolean;
  breakoutType: '20_DAY_HIGH' | '52_WEEK_HIGH' | 'VWAP_CROSS' | 'RANGE_RESISTANCE';
  catalystIndexedEnabled: boolean;
  cooldownMinutes: number; // default 15m debounce
  lastTriggeredAt?: number;
}

export interface WatchlistItem {
  ticker: string;
  addedAt: string;
  lastPrice: number;
  lastDeltaPct: number;
  rvol: number;
  signalState: SignalState;
  triggers: AlertTriggerConfig;
}

export interface UserWatchlistState {
  version: '1.0';
  userId?: string;
  anonymousId: string;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  items: Record<string, WatchlistItem>;
}

export interface TelemetryDeltaPacket {
  ticker: string;
  timestamp: number;
  price: number;
  changeAbs: number;
  changePct: number;
  volume: number;
  rvol: number;
  vwap: number;
  high: number;
  low: number;
  high20d: number;
  high52w: number;
  bidAskSpreadPct: number;
  recentCatalystIndexed?: boolean;
}

export interface MarketRadarState {
  timestamp: number;
  sessionStage: 'PRE_MARKET' | 'REGULAR_HOURS' | 'AFTER_HOURS' | 'CLOSED';
  macroRegime: {
    status: MacroRegime;
    confidencePct: number;
    spyDelta: number;
    qqqDelta: number;
    vixValue: number;
    breadthAdvPct: number;
  };
  topSetup: {
    ticker: string;
    price: number;
    changePct: number;
    rvol: number;
    convictionScore: number;
    headline: string;
  };
  breakoutCandidates: Array<{
    ticker: string;
    changePct: number;
    rvol: number;
    levelBreached: string;
  }>;
  reversalCandidates: Array<{
    ticker: string;
    changePct: number;
    vwapDeltaPct: number;
    riskReason: string;
  }>;
  largeCapAnchor: {
    ticker: string;
    marketCap: number;
    changePct: number;
    netInflowEstimated: number;
  };
  latestBriefSlug?: string;
}

export interface WhyIsItMovingDiagnostic {
  ticker: string;
  timestamp: number;
  synthesisVerdict: SynthesisVerdict;
  verdictColor: 'GREEN' | 'YELLOW' | 'RED' | 'BLUE' | 'GRAY';
  
  catalyst: {
    category: CatalystCategory;
    summary: string;
    sourceUrl?: string;
    publishedAt?: string;
    verified: boolean;
  };
  technical: {
    is20DayHighBreach: boolean;
    is52WeekHighBreach: boolean;
    pctFromVWAP: number;
    rvolMultiplier: number;
    rsi: number;
    keyResistanceLevel: number;
  };
  liquidity: {
    floatShares: number;
    floatCategory: 'MICRO_FLOAT' | 'LOW_FLOAT' | 'MID_FLOAT' | 'LARGE_FLOAT';
    floatTurnoverPct: number;
    sessionVolume: number;
    averageDailyVolume30d: number;
    dollarVolume: number;
  };
  marketBehavior: {
    estimatedShortInterestPct: number;
    aggressiveAskLiftPct: number;
    uptickDowntickRatio: number;
    orderFlowBias: 'AGGRESSIVE_BUYING' | 'DISTRIBUTION' | 'BALANCED';
  };
  riskRating: {
    hasActiveS3Shelf: boolean;
    isSubDollarPenny: boolean;
    reverseSplitPast12m: boolean;
    bidAskSpreadPct: number;
    spreadWarning: boolean;
    overallRiskScore: number; // 1 to 100
  };
}
```

### 8.2 Pseudo-Algorithms

#### Algorithm 1: Stateful Real-Time Alert Evaluation & Debounce Engine

```typescript
/**
 * Evaluates whether an incoming ticker telemetry packet satisfies
 * user-configured alert criteria while preventing alert storms.
 */
function evaluateWatchlistAlert(
  item: WatchlistItem, 
  telemetry: TelemetryDeltaPacket,
  nowMs: number = Date.now()
): { shouldTrigger: boolean; satisfiedReasons: string[] } {
  const triggers = item.triggers;
  const satisfiedReasons: string[] = [];

  // 1. Debounce Check (Cooldown Period)
  const cooldownMs = (triggers.cooldownMinutes || 15) * 60 * 1000;
  if (triggers.lastTriggeredAt && (nowMs - triggers.lastTriggeredAt < cooldownMs)) {
    return { shouldTrigger: false, satisfiedReasons: [] };
  }

  // 2. Threshold 1: Absolute Percentage Move
  if (triggers.pctMoveEnabled && Math.abs(telemetry.changePct) >= triggers.pctMoveThreshold) {
    satisfiedReasons.push(
      `Intraday move of ${telemetry.changePct > 0 ? '+' : ''}${telemetry.changePct.toFixed(2)}% passed threshold (±${triggers.pctMoveThreshold}%)`
    );
  }

  // 3. Threshold 2: Relative Volume Multiplier
  if (triggers.rvolEnabled && telemetry.rvol >= triggers.rvolThreshold) {
    satisfiedReasons.push(
      `Relative volume (${telemetry.rvol.toFixed(2)}x) exceeded threshold (≥${triggers.rvolThreshold.toFixed(1)}x)`
    );
  }

  // 4. Threshold 3: Technical Breakout
  if (triggers.breakoutEnabled) {
    switch (triggers.breakoutType) {
      case '20_DAY_HIGH':
        if (telemetry.price >= telemetry.high20d && telemetry.high20d > 0) {
          satisfiedReasons.push(`Breached 20-day high resistance level of $${telemetry.high20d.toFixed(2)}`);
        }
        break;
      case '52_WEEK_HIGH':
        if (telemetry.price >= telemetry.high52w && telemetry.high52w > 0) {
          satisfiedReasons.push(`Breached 52-week high mark of $${telemetry.high52w.toFixed(2)}`);
        }
        break;
      case 'VWAP_CROSS':
        if (telemetry.price > telemetry.vwap && (telemetry.price - telemetry.vwap) / telemetry.vwap <= 0.015) {
          satisfiedReasons.push(`Bullish reclamation above intraday VWAP ($${telemetry.vwap.toFixed(2)})`);
        }
        break;
    }
  }

  // 5. Threshold 4: Catalyst Indexed
  if (triggers.catalystIndexedEnabled && telemetry.recentCatalystIndexed) {
    satisfiedReasons.push(`New high-priority catalyst news / SEC filing indexed`);
  }

  const shouldTrigger = satisfiedReasons.length > 0;
  if (shouldTrigger) {
    // Mutate state timestamp
    item.triggers.lastTriggeredAt = nowMs;
  }

  return { shouldTrigger, satisfiedReasons };
}
```

#### Algorithm 2: "Why Is It Moving?" Synthesis Verdict Classifier

```typescript
/**
 * Ingests multi-layer metrics and computes the standardized 2-to-3-word verdict.
 */
function synthesizeAttributionVerdict(
  catalystCat: CatalystCategory,
  tech: { is20DayHighBreach: boolean; pctFromVWAP: number; rvolMultiplier: number },
  liq: { floatShares: number; floatTurnoverPct: number; dollarVolume: number },
  flow: { estimatedShortInterestPct: number; aggressiveAskLiftPct: number },
  risk: { hasActiveS3Shelf: boolean; isSubDollarPenny: boolean; bidAskSpreadPct: number }
): { verdict: SynthesisVerdict; color: 'GREEN' | 'YELLOW' | 'RED' | 'BLUE' | 'GRAY' } {

  // Rule 1: High Dilution Risk Hazard
  if (risk.hasActiveS3Shelf && (liq.floatShares < 20_000_000 || risk.isSubDollarPenny)) {
    return { verdict: 'DILUTION RISK / OFFERING PENDING', color: 'RED' };
  }

  // Rule 2: Exhaustion Gap / Fade Bias
  if (tech.pctFromVWAP < -3.0 && tech.rvolMultiplier > 3.0) {
    return { verdict: 'EXHAUSTION GAP / FADE BIAS', color: 'RED' };
  }

  // Rule 3: Short Squeeze Expansion
  if (flow.estimatedShortInterestPct >= 20.0 && liq.floatTurnoverPct >= 80.0 && tech.rvolMultiplier >= 3.0) {
    return { verdict: 'SHORT SQUEEZE EXPANSION', color: 'YELLOW' };
  }

  // Rule 4: Clean Institutional Catalyst
  if (
    (catalystCat === 'EARNINGS_BEAT' || catalystCat === 'FDA_APPROVAL' || catalystCat === 'CONTRACT_AWARD') &&
    liq.dollarVolume >= 20_000_000 &&
    !risk.hasActiveS3Shelf &&
    risk.bidAskSpreadPct < 0.20
  ) {
    return { verdict: 'CLEAN CATALYST / LOW RISK', color: 'GREEN' };
  }

  // Rule 5: High Momentum / High Risk (Classic retail runner)
  if (
    liq.floatShares < 25_000_000 &&
    tech.rvolMultiplier >= 3.5 &&
    flow.aggressiveAskLiftPct >= 60.0
  ) {
    return { verdict: 'HIGH MOMENTUM / HIGH RISK', color: 'YELLOW' };
  }

  // Rule 6: Institutional Accumulation
  if (liq.dollarVolume >= 50_000_000 && tech.is20DayHighBreach && tech.pctFromVWAP > 0) {
    return { verdict: 'INSTITUTIONAL ACCUMULATION', color: 'GREEN' };
  }

  // Rule 7: Sympathy Rotation
  if (catalystCat === 'NONE_DETECTED' && tech.rvolMultiplier >= 2.5) {
    return { verdict: 'SYMPATHY ROTATION / SECTOR FLOW', color: 'BLUE' };
  }

  // Fallback
  return { verdict: 'BALANCED FLOW / RANGEBOUND', color: 'GRAY' };
}
```

---

## 9. Implementation Roadmap & Technical Milestones

```
+--------------------------------------------------------------------------------------------------+
| PHASE 1: BRAND REPOSITIONING & HERO ACTIVATION (Sprint 1)                                       |
| - Rewrite Hero markup in src/pages/index.astro with 3-persona tabs & CTA bar                     |
| - Replace jargon title tags & meta descriptions with action-oriented copy                         |
| - Embed 1-click Quick Try ticker pills writing to localStorage                                   |
+--------------------------------------------------------------------------------------------------+
                                      |
                                      v
+--------------------------------------------------------------------------------------------------+
| PHASE 2: WATCHLIST MATRIX & LOCALSTORAGE PERSISTENCE (Sprint 2)                                 |
| - Build WatchlistMatrix.astro component embedded inside LiveStockScreener.astro                  |
| - Implement client-side audio chime audio dispatcher & Web Notification API integration          |
| - Add multi-trigger checkbox evaluation logic with 15-minute debounce engine                     |
+--------------------------------------------------------------------------------------------------+
                                      |
                                      v
+--------------------------------------------------------------------------------------------------+
| PHASE 3: MARKET RADAR & 3-BRIEF PUBLISHING SYSTEM (Sprint 3)                                    |
| - Refactor root index.js to decommission continuous micro-article generation                     |
| - Implement MarketRadar.astro HUD card with Macro Regime & Top Setup                             |
| - Schedule 3 daily automated dispatches (Morning 08:45, Midday 12:00, Closing 16:15 EST)         |
+--------------------------------------------------------------------------------------------------+
                                      |
                                      v
+--------------------------------------------------------------------------------------------------+
| PHASE 4: "WHY IS IT MOVING?" 5-LAYER DIAGNOSTIC ENGINE (Sprint 4)                               |
| - Ingest SEC EDGAR Form S-3 & 8-K feeds into Astro SSR /api/diagnostic.ts endpoint              |
| - Compute Float Turnover, RVOL multiplier, Order Flow lift, and Spread Warning                   |
| - Deliver interactive 5-layer diagnostic slide-over drawer in Screener & Watchlist rows          |
+--------------------------------------------------------------------------------------------------+
```

---
*End of Document. Approved by Principal Fintech Product Manager & Full-Stack Architect.*
