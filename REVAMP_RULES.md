# REVAMP_RULES.md — Immutable Contracts for tradeopportunities.trade

## 1. UNTOUCHABLE FILES & PIPELINES
- NEVER edit `.github/workflows/**`, Python/Node data scripts, `.env*`, or `src/content/config.ts` required keys.
- NEVER change URL route structures (`/`, `/screener/`, `/ticker/[symbol]/`, `/blog/[...slug]/`, `/tools/`).
- NEVER remove or rename `id="..."`, `data-*` attributes, or classes targeted by `document.getElementById` or `querySelector` inside Astro `<script>` blocks.

## 2. PRECISION DARK-MODE TERMINAL TOKENS
- Root Canvas: `bg-[#090D16] text-[#F8FAFC] antialiased selection:bg-sky-500/20 selection:text-sky-300`
- Card / Table Surface: `bg-[#111726] border border-[#1E293B]`
- Elevated / Interactive Row Hover: `hover:bg-[#1A2234] transition-colors duration-150`
- Muted Text / Column Headers: `text-[#94A3B8]`
- Bullish Delta Pill: `text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20`
- Bearish / Dilution Risk Pill: `text-[#F43F5E] bg-[#F43F5E]/10 border border-[#F43F5E]/20`
- AI Catalyst / High RVOL Pill: `text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/20`
- Sponsor / Pro Badge: `text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20`

## 3. TYPOGRAPHY & NUMERIC ALIGNMENT LAW
- Sans Font (`Inter` / `Plus Jakarta Sans`): Navigation, section headers, and AI narrative prose (`max-w-[65ch] leading-[1.65]`).
- Mono Font (`JetBrains Mono` / `Geist Mono`): MANDATORY on every `$TICKER`, price, `%` change, share volume, RVOL multiplier, and timestamp.
- Every numeric element MUST include: `font-mono tabular-nums tracking-tight`.
