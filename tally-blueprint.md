# TALLY — Technical Blueprint for Cash Drawer Manager

**For use with AI coding agents (Claude Code)**

Version 1.1 | March 2026
Prototype Scope: Static Web App MVP — Cash Drawer Counting, Change-Making, and Reconciliation

---

## Preamble: How to Use This Document

> **For the AI Agent:** This blueprint is designed to be fed directly to Claude Code or a similar AI coding agent. It contains every technical decision needed to build the Tally web application. Follow the sections in order. When a section says "build this," build it. When it says "stub this," create the interface but use placeholder logic. Do not deviate from the specified stack or architecture without explicit approval.

**Business context:** This application serves a small healthcare practice (therapy and medical) with eight front-desk workstations across two offices. Front staff collect copays in cash throughout the day and need to balance their cash drawers at close. Current process is inconsistent — staff sometimes can't balance, math errors go undetected, and there's no denomination-level tracking. The app replaces both the adding machine tape and the paper count sheet with a single tool that eliminates arithmetic entirely.

**Prototype scope:** Static web application with client-side storage. No backend server, no cloud database. Core loop: opening count (by denomination) → transaction logging with change-making → closing count → reconciliation report → print. Each workstation stores its own data locally in the browser. The printed end-of-day report is the official record — digital history is a convenience backup.

**Access model:** The app is protected by a shared access code (set at build time via environment variable). Desk labels only — no staff names stored in the app. Staff handwrite their name on the printed report, same as they would on a paper count sheet.

**Design quality target:** Clean, professional, immediately obvious. Zero learning curve. A new front desk employee should be able to use this within 30 seconds of seeing it. Think calculator meets bank teller worksheet. Not flashy — reliable, clear, fast.

---

## 1. Technology Stack

Chosen for simplicity, zero cost, and zero backend. The entire app runs in the browser. Nothing to install on workstations.

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router, static export) | React-based. Generates a fully static site via `output: 'export'`. No server needed. |
| Language | TypeScript 5.x | Type safety for money math. Catches denomination errors at compile time. |
| Styling | Tailwind CSS 4 | Rapid consistent styling. Utility-first. No custom CSS maintenance. |
| UI Components | Radix UI primitives | Accessible, unstyled interactive components (dialogs, dropdowns, tabs). |
| State Management | React Context + useReducer | Simple enough for this app. No external dependency needed. Working state lives in memory, resets on page load. |
| Persistent Storage | IndexedDB (via idb library) | Browser-native persistent database. Structured storage for sessions and transactions. Survives page reloads but lives only on that specific computer/browser. |
| Hosting | Cloudflare Pages (free tier) | Free static site hosting. Commercial use allowed on free tier. HTTPS included. Custom domain optional. Alternatively: Netlify free tier (also allows commercial use). |
| PDF / Print | Browser print API + print-optimized CSS | No library needed. `window.print()` with a `@media print` stylesheet generates the end-of-day report. Simpler and more reliable than PDF generation libraries. |
| Testing | Vitest | Unit tests for money math — critical that arithmetic is correct. |

> **Prerequisites:** Node.js 20+, pnpm, a Cloudflare account (free) or Netlify account (free), and a GitHub repo. Nothing to install on the front desk computers — they just open a URL in Chrome.

### Why Static / Client-Side Only?

- **Zero cost.** No database server, no compute charges. Cloudflare Pages free tier has no commercial use restriction.
- **Zero maintenance.** No server to go down, no database to back up, no credentials to rotate.
- **Each workstation is independent.** Drawer 1's data lives on Drawer 1's computer. No cross-contamination.
- **The printed report is the source of truth.** Digital history is a convenience backup, not the official record. If browser data is lost, the paper trail in the cash bag is authoritative.
- **Privacy.** No staff names, patient names, or financial data ever leave the building. Everything stays in the browser on that physical machine.

### Tradeoffs Accepted

- **No cross-drawer admin view.** You can't see all 8 drawers from one screen. Each computer only knows its own history. If you want a combined view later, that's a v2 feature requiring a server.
- **Data tied to browser.** If someone clears browser data, history is gone. Mitigated by: printed reports (primary record) + export feature (monthly backup).
- **No remote access.** You can't check drawer status from your phone. The printed report or a quick call to the front desk serves this purpose.

---

## 2. Project Structure

```
tally/
├── app/                          # Next.js App Router (static export)
│   ├── layout.tsx                # Root layout, fonts, metadata
│   ├── page.tsx                  # Access code gate → main drawer view
│   ├── history/
│   │   └── page.tsx              # Browse past sessions on this machine
│   └── settings/
│       └── page.tsx              # Drawer name, common copay amounts, export data
├── components/
│   ├── auth/
│   │   └── AccessGate.tsx        # Access code entry screen
│   ├── drawer/
│   │   ├── DenominationGrid.tsx  # Core counting UI — grid of denomination inputs
│   │   ├── DrawerSummary.tsx     # Current drawer state: total, denomination breakdown
│   │   ├── TransactionEntry.tsx  # Log a cash-in or cash-out event
│   │   ├── SessionManager.tsx    # New Day / Resume / Close stale session logic
│   │   └── StatusBanner.tsx      # Drawer status: open, balanced, over/short
│   ├── change/
│   │   ├── ChangeCalculator.tsx  # Amount owed + amount tendered → change breakdown
│   │   └── ChangeSuggestion.tsx  # Optimal bills/coins to return from drawer
│   ├── reports/
│   │   ├── ReconciliationView.tsx    # Over/short analysis on screen
│   │   ├── TransactionLog.tsx        # Scrollable log of day's transactions
│   │   └── PrintableReport.tsx       # Print-optimized layout (@media print)
│   └── shared/
│       ├── CurrencyDisplay.tsx   # Formatted dollar display (monospace)
│       ├── DenominationBadge.tsx # Shows count × denomination = subtotal
│       └── ConfirmDialog.tsx     # Reusable confirmation modal
├── lib/
│   ├── money.ts                  # All currency math (integer cents, never floats)
│   ├── denominations.ts          # US denomination definitions and change-making algorithm
│   ├── reconciliation.ts         # Reconciliation logic: expected vs actual
│   ├── db.ts                     # IndexedDB wrapper (idb library)
│   ├── sessions.ts               # Session lifecycle: create, seal, detect stale
│   └── export.ts                 # Export history to JSON/CSV
├── types/
│   └── index.ts                  # Shared TypeScript types
├── public/
│   ├── icons/                    # App icons for bookmark/PWA
│   └── manifest.json             # PWA manifest for "Add to Home Screen"
├── tailwind.config.ts
├── next.config.ts                # includes: output: 'export'
├── tsconfig.json
└── package.json
```

---

## 3. Data Model

All money values stored as **integers in cents**. Never use floating point for currency. $20.00 = 2000. This is non-negotiable.

### 3.1 IndexedDB Schema

The database is called `tally-db`. It contains two object stores (tables):

```typescript
// lib/db.ts — IndexedDB setup using 'idb' library

import { openDB, DBSchema } from 'idb';

interface TallyDB extends DBSchema {
  sessions: {
    key: string;                    // Session ID (UUID)
    value: DrawerSession;
    indexes: {
      'by-date': string;            // Index on date field for quick lookup
      'by-status': string;          // Index on status field
    };
  };
  transactions: {
    key: string;                    // Transaction ID (UUID)
    value: Transaction;
    indexes: {
      'by-session': string;         // Index on sessionId for listing
      'by-date': string;            // Index on createdAt
    };
  };
}

export async function initDB() {
  return openDB<TallyDB>('tally-db', 1, {
    upgrade(db) {
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionStore.createIndex('by-date', 'date');
      sessionStore.createIndex('by-status', 'status');
      
      const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
      txStore.createIndex('by-session', 'sessionId');
      txStore.createIndex('by-date', 'createdAt');
    },
  });
}
```

### 3.2 TypeScript Types

```typescript
// types/index.ts

export interface DrawerSession {
  id: string;                       // UUID v4
  date: string;                     // ISO date string: "2026-03-13"
  status: "open" | "counting" | "closed";
  
  // Opening count
  openingCount: DenominationCount | null;
  openingTotal: number | null;      // Cents
  openedAt: string | null;          // ISO datetime
  
  // Live state: current denomination breakdown (updated with each transaction)
  currentDenominations: DenominationCount;
  currentTotal: number;             // Cents — running total
  
  // Closing count
  closingCount: DenominationCount | null;
  closingTotal: number | null;      // Cents
  closedAt: string | null;          // ISO datetime
  
  // Reconciliation
  expectedTotal: number | null;     // openingTotal + net transactions
  discrepancy: number | null;       // closingTotal - expectedTotal
  notes: string | null;             // Staff note explaining any discrepancy
}

export interface Transaction {
  id: string;                       // UUID v4
  sessionId: string;                // FK to DrawerSession
  createdAt: string;                // ISO datetime
  type: TransactionType;
  
  description: string;              // "Patient copay", "Change for $50", etc.
  amountOwed: number | null;        // Cents — what was owed (copay/payment)
  amountIn: number;                 // Cents — cash received into drawer
  amountOut: number;                // Cents — cash given out of drawer
  netAmount: number;                // amountIn - amountOut
  
  // Denomination tracking
  denominationsIn: DenominationCount | null;   // Bills/coins received
  denominationsOut: DenominationCount | null;  // Bills/coins given as change
  
  // Voiding
  voided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

export type TransactionType = 
  | "copay"         // Patient pays copay, may need change
  | "payment"       // Other patient payment
  | "cash_drop"     // Remove excess cash to safe
  | "petty_cash"    // Small office expense from drawer
  | "cash_loan"     // Add cash to drawer from safe/bank
  | "adjustment";   // Correct a mistake

// Denomination count: keys are "bill_2000", "coin_25", etc.
// Values are quantities (number of that denomination)
export type DenominationCount = Record<string, number>;
```

### 3.3 Session Lifecycle — The "Sealed Envelope" Model

This is the most important architectural concept. It prevents stale data from bleeding between days.

```typescript
// lib/sessions.ts — Session lifecycle rules

/**
 * SESSION STATES:
 * 
 * 1. No session exists for today:
 *    → Show "Start New Day" screen with empty denomination grid
 *    → Staff enters opening count → session created with status "open"
 * 
 * 2. Open session exists for today:
 *    → Resume it. Show current state, allow transactions.
 * 
 * 3. Stale session exists (open session from a PREVIOUS day):
 *    → Show warning: "You have an unclosed session from [date]."
 *    → Two options:
 *      a) "Close Previous Day" → takes them through closing count for that session
 *      b) "Discard Previous Day" → marks session as closed with note "Discarded"
 *    → After resolving stale session, show "Start New Day" for today
 * 
 * 4. Closed session exists for today:
 *    → Show read-only reconciliation report. Option to reprint.
 *    → No editing. The envelope is sealed.
 *
 * CRITICAL RULES:
 * - Only ONE open session can exist at a time on a given machine.
 * - Opening count inputs are ALWAYS blank. Never pre-filled from storage.
 * - Closing count inputs are ALWAYS blank. Never pre-filled from storage.
 * - Working state (current inputs being typed) lives in React state (memory), 
 *   NOT in IndexedDB. Memory state resets naturally on page reload.
 * - IndexedDB is written to only at intentional save points:
 *     • Opening count submitted
 *     • Transaction logged
 *     • Transaction voided
 *     • Closing count submitted
 *     • Session reconciled/closed
 * - A closed session is immutable. It cannot be reopened or edited.
 */

export function getTodayDateString(): string {
  return new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD" format
}

export async function detectSessionState(db): Promise<
  | { state: "no_session" }
  | { state: "open_today"; session: DrawerSession }
  | { state: "stale_open"; session: DrawerSession }
  | { state: "closed_today"; session: DrawerSession }
> {
  const today = getTodayDateString();
  
  // Check for any open session
  const allSessions = await db.getAllFromIndex('sessions', 'by-status', 'open');
  const openSession = allSessions[0]; // Should only be 0 or 1
  
  if (openSession) {
    if (openSession.date === today) {
      return { state: "open_today", session: openSession };
    } else {
      return { state: "stale_open", session: openSession };
    }
  }
  
  // Check for closed session today
  const todaySessions = await db.getAllFromIndex('sessions', 'by-date', today);
  const closedToday = todaySessions.find(s => s.status === "closed");
  
  if (closedToday) {
    return { state: "closed_today", session: closedToday };
  }
  
  return { state: "no_session" };
}
```

### 3.4 Denomination Definitions

```typescript
// lib/denominations.ts

export const DENOMINATIONS = [
  // Bills
  { key: "bill_10000", value: 10000, label: "$100", type: "bill" as const },
  { key: "bill_5000",  value: 5000,  label: "$50",  type: "bill" as const },
  { key: "bill_2000",  value: 2000,  label: "$20",  type: "bill" as const },
  { key: "bill_1000",  value: 1000,  label: "$10",  type: "bill" as const },
  { key: "bill_500",   value: 500,   label: "$5",   type: "bill" as const },
  { key: "bill_100",   value: 100,   label: "$1",   type: "bill" as const },
  
  // Coins
  { key: "coin_25",    value: 25,    label: "25¢",  type: "coin" as const },
  { key: "coin_10",    value: 10,    label: "10¢",  type: "coin" as const },
  { key: "coin_5",     value: 5,     label: "5¢",   type: "coin" as const },
  { key: "coin_1",     value: 1,     label: "1¢",   type: "coin" as const },
] as const;

// Omitted from default list (uncommon in medical office setting):
// - $2 bills, $1 coins, 50¢ coins
// These can be added in Settings if a location needs them.

export const BILL_DENOMINATIONS = DENOMINATIONS.filter(d => d.type === "bill");
export const COIN_DENOMINATIONS = DENOMINATIONS.filter(d => d.type === "coin");

export function totalFromDenominations(counts: DenominationCount): number {
  return Object.entries(counts).reduce((sum, [key, qty]) => {
    const denom = DENOMINATIONS.find(d => d.key === key);
    if (!denom || qty <= 0) return sum;
    return sum + (denom.value * qty);
  }, 0);
}

export function emptyDenominationCount(): DenominationCount {
  const counts: DenominationCount = {};
  for (const d of DENOMINATIONS) {
    counts[d.key] = 0;
  }
  return counts;
}
```

### 3.5 Money Math

```typescript
// lib/money.ts

// RULE: All money is in integer cents. No floats. Ever.
// $20.00 = 2000.  $0.25 = 25.
// Display formatting happens only at the UI layer.

export function centsToDisplay(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainingCents = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${dollars}.${remainingCents.toString().padStart(2, "0")}`;
}

export function displayToCents(display: string): number {
  const cleaned = display.replace(/[$,]/g, "");
  return Math.round(parseFloat(cleaned) * 100);
}

// Change-making algorithm: greedy (works for US currency)
// Constrained by what's actually in the drawer
export function calculateChange(
  amountOwedCents: number,
  amountTenderedCents: number,
  drawerDenominations: DenominationCount
): { 
  changeDue: number; 
  breakdown: DenominationCount; 
  possible: boolean;
  shortBy?: number;
} {
  const changeDue = amountTenderedCents - amountOwedCents;
  
  if (changeDue <= 0) {
    return { changeDue: 0, breakdown: {}, possible: true };
  }
  
  const breakdown: DenominationCount = {};
  let remaining = changeDue;
  
  const sortedDenoms = DENOMINATIONS
    .map(d => ({ ...d, available: drawerDenominations[d.key] || 0 }))
    .sort((a, b) => b.value - a.value);
  
  for (const { key, value, available } of sortedDenoms) {
    if (remaining <= 0) break;
    if (value > remaining || available <= 0) continue;
    
    const needed = Math.floor(remaining / value);
    const used = Math.min(needed, available);
    
    if (used > 0) {
      breakdown[key] = used;
      remaining -= value * used;
    }
  }
  
  return {
    changeDue,
    breakdown,
    possible: remaining === 0,
    shortBy: remaining > 0 ? remaining : undefined,
  };
}
```

---

## 4. Design System

The visual identity should feel like a clean, modern cash register interface — high contrast for readability, large targets, and unmistakable status indicators.

### 4.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| slate-900 | `#0F172A` | Primary text, headers |
| slate-600 | `#475569` | Secondary text, labels |
| slate-100 | `#F1F5F9` | Page background |
| white | `#FFFFFF` | Card backgrounds, input fields |
| green-600 | `#16A34A` | Balanced/positive states, cash in |
| green-50 | `#F0FDF4` | Balanced background tint |
| red-600 | `#DC2626` | Short/negative states, cash out, errors |
| red-50 | `#FEF2F2` | Short background tint |
| blue-600 | `#2563EB` | Primary actions, active states, links |
| blue-50 | `#EFF6FF` | Active state background tint |
| amber-500 | `#F59E0B` | Warnings, pending states |
| amber-50 | `#FFFBEB` | Warning background tint |

### 4.2 Typography

- **Primary font:** Inter. Clean, excellent number readability.
- **Monospace:** JetBrains Mono. For all dollar amounts, counts, and totals.
- **Scale:** text-sm (13px) labels/metadata, text-base (15px) body, text-lg (18px) denomination labels, text-xl (22px) subtotals, text-3xl (30px) grand totals/change due, text-5xl (48px) primary drawer total.

### 4.3 Layout

Single-column, card-based layout for desktop monitors. No sidebar.

- **Top bar (56px):** Drawer label (from Settings), today's date, session status badge.
- **Tab navigation:** Three tabs: "Drawer" (main), "Make Change" (calculator), "History" (past sessions).
- **Main content area:** Stacked cards. Each card is one concern.
- **Sticky footer:** Running drawer total always visible. This is the most important number on screen.

### 4.4 Key UI Components

**Access Gate:** Full-screen centered card. "Enter access code" label, single input field, "Enter" button. Clean and minimal. Access code stored in a cookie that expires at midnight — staff enter it once per day.

**Session Manager:** First thing after the access gate. Detects state and shows the right action:
- No session → big green "Start New Day" button with empty denomination grid
- Open session → resumes to drawer view directly
- Stale session → amber warning with "Close Previous Day" / "Discard" options
- Closed session → read-only report with "Reprint" button

**Denomination Grid:** The heart of the app. Each row: denomination label ($20), quantity input (large, centered, monospace, up/down arrow support), subtotal ($60.00, auto-calculated, gray). Bills on top, coins below, divider between. Grand total at bottom in large bold monospace. Tab navigates between fields. All inputs always start blank.

**Change Calculator:** Two inputs: "Amount Owed" (with quick-select buttons for common copays: $15, $20, $25, $30, $40, $50) and "Amount Tendered" (with quick-select: $20, $50, $100). "Change Due" in large green monospace. Denomination breakdown showing which bills/coins to hand back. "Log & Give Change" button records transaction and updates drawer. "Exact Change" shortcut for no-change-needed situations. Yellow warning if drawer can't make exact change.

**Transaction Log:** Scrollable list in drawer view. Each row: timestamp, type badge (color-coded), description, amount (green in / red out), running total. Void button per row with confirmation + reason.

**Reconciliation View:** Two-column: "Expected" vs "Counted" per denomination. Difference column — green zeros or red discrepancies. Grand total comparison with status: "Balanced," "Short $X.XX," "Over $X.XX." Notes field. "Print Report & Close Day" button.

**Printable Report:** `@media print` layout. Header (drawer label, date, times), opening count, transaction log, closing count, reconciliation, notes, signature lines ("Counted by: ___" / "Verified by: ___"). One page, black and white, letter paper.

### 4.5 Key UX Principles

- **No math required.** Staff enter quantities. App does all arithmetic.
- **Big, clear numbers.** Monospace, large, high contrast.
- **Tab-through workflow.** Tab between denomination fields for fast counting.
- **Immediate feedback.** Every keystroke updates running total.
- **Inputs always start blank.** Never pre-filled from storage. Prevents stale data.
- **Error prevention.** Unusual amounts trigger confirmation dialogs.
- **Print-friendly.** One page, black and white, standard letter paper.

---

## 5. Access Control

Simple shared access code. Not a security fortress — just enough to keep random visitors out.

```
// Access code set at build time via environment variable:
// .env.local (not committed to git):
// NEXT_PUBLIC_ACCESS_CODE=123456

// Behavior:
// 1. On app load, check for 'tally-access' cookie
// 2. Cookie exists + not expired → skip gate, show app
// 3. No cookie → show access code input
// 4. Correct code → set cookie expiring at midnight local time → show app
// 5. Wrong code → shake input, "Incorrect code"
//
// Cookie expires at midnight so staff re-enter daily.
// Creates a natural "start of day" moment.
//
// NOTE: Not cryptographic security. Code is in client JS.
// Prevents casual access. Sufficient for a cash counting tool with no PII.
// For stronger auth: add Cloudflare Access ($0 for up to 50 users).
```

---

## 6. Core Workflows

### 6.1 Opening the Drawer (Start of Day)

1. Staff opens bookmarked Tally URL in Chrome.
2. If access code cookie expired (new day), enter code. Otherwise skip to step 3.
3. Session Manager detects no open session. Shows "Start New Day" + empty DenominationGrid.
4. Staff counts physical cash, enters quantities per denomination. Tab through fields. Total updates live.
5. Clicks "Open Drawer."
6. Session created in IndexedDB: opening count, total, status "open."
7. Opening count locked (read-only at top of drawer view).
8. Drawer view shows: opening total, transaction area, running total in sticky footer.

### 6.2 Processing a Copay (Making Change)

Most frequent workflow — 10–30 times per day.

1. Navigate to "Make Change" tab.
2. Select "Amount Owed" — quick buttons ($15, $20, $25, $30, $40, $50) or manual entry.
3. Select "Amount Tendered" — quick buttons ($20, $50, $100) or manual entry.
4. App calculates: change due, denomination breakdown from drawer's current bills/coins. Yellow warning if exact change isn't possible.
5. Click "Log & Give Change."
6. Transaction recorded in IndexedDB. Drawer denomination counts updated (received bill added, change bills/coins subtracted). Running total updated.
7. Transaction appears in log. Footer total updates.

**"Exact Change" shortcut:** Patient pays exact amount. One click logs cash in, no change calculation.

### 6.3 Other Transaction Types

| Type | When Used | Direction | Denomination Tracking |
|------|-----------|-----------|----------------------|
| Copay/Payment | Patient pays, may need change | In + Out | Yes |
| Cash Drop | Remove excess to safe | Out | Optional |
| Petty Cash | Small office expense | Out | Optional |
| Cash Loan | Add cash from safe/bank | In | Optional |
| Adjustment | Correct a mistake | Either | No — total only |

Non-copay transactions: enter total amount + description. Denomination breakdown optional.

### 6.4 Closing the Drawer (End of Day)

1. Click "Close Drawer."
2. Closing DenominationGrid appears — **all fields blank**.
3. Staff counts physical cash, enters quantities. Total updates live.
4. Click "Submit Count."
5. App calculates: Expected (opening + net transactions) vs Counted (closing count).
6. Reconciliation displayed:
   - Balanced ($0 discrepancy): green banner
   - Short (negative): red banner with amount
   - Over (positive): amber banner with amount
   - Denomination-level comparison
7. Staff adds notes if needed.
8. Click "Print Report & Close Day."
9. Browser print dialog opens.
10. Session sealed as "closed." Immutable.

### 6.5 End-of-Day Report (The "Tape")

Browser `window.print()` with `@media print` CSS. One page, B&W, letter paper.

```
TALLY — Daily Cash Drawer Report
Drawer: Therapy Front Desk 1
Date: March 13, 2026
Opened: 8:02 AM    Closed: 5:47 PM

OPENING COUNT
$20 × 4 ............ $80.00
$10 × 4 ............ $40.00
$5  × 8 ............ $40.00
$1  × 20 ........... $20.00
25¢ × 40 ........... $10.00
10¢ × 20 ............ $2.00
OPENING TOTAL:       $192.00

TRANSACTIONS
8:15 AM  Copay    +$25.00  in $50, out $25
9:30 AM  Copay    +$20.00  exact
10:02 AM Copay    +$30.00  in $50, out $20
11:15 AM Petty    -$8.50   office supplies
1:30 PM  Copay    +$25.00  in $100, out $75
...
NET TRANSACTIONS:    +$91.50

CLOSING COUNT
$20 × 5 ........... $100.00
$10 × 3 ............ $30.00
...
CLOSING TOTAL:       $283.50

RECONCILIATION
Expected: $283.50
Counted:  $283.50
Status:   ✓ BALANCED

Notes: _________________________________________

Counted by: ___________________  Date: _________
Verified by: __________________  Date: _________
```

### 6.6 Viewing History

"History" tab lists all closed sessions on this machine (newest first). Each row: date, opening total, closing total, discrepancy (color-coded). Click to view full report + reprint.

### 6.7 Exporting Data (Safety Net)

In Settings: "Export History" downloads all sessions + transactions as a JSON file. Monthly backup recommended. "Clear History" with double-confirmation erases all IndexedDB data for a clean slate.

---

## 7. Build Order (Follow This Sequence)

> **Critical Instruction:** Complete each step fully before moving to the next. Test each step in isolation. Do not skip ahead.

| # | Step | What to Build | Done When |
|---|------|--------------|-----------|
| 1 | **Scaffold** | Next.js + TypeScript + Tailwind + Radix UI. `output: 'export'` in next.config. Fonts (Inter + JetBrains Mono). IndexedDB init with `idb`. Layout shell with top bar + tabs. | App loads locally with "Tally" heading and tabs. IndexedDB initializes. |
| 2 | **Access Gate** | AccessGate component. Code input. Midnight-expiring cookie. Env var for code. Blocks all content until authenticated. | Correct code → app. Wrong code → error. Same-day refresh → skips gate. |
| 3 | **Denomination Grid** | DenominationGrid component. Bill + coin rows. Quantity inputs with tab/arrow support. Auto subtotals. Grand total. Blank inputs. Integer cents math. | Enter quantities → correct running total. Unit tests pass. |
| 4 | **Session Manager + Opening** | SessionManager with sealed envelope logic. State detection on load. "Start New Day" flow. IndexedDB session creation. Lock opening count. Stale session handling. | Start new day, enter count, locked. Stale sessions detected. |
| 5 | **Change Calculator** | ChangeCalculator on "Make Change" tab. Owed + tendered inputs. Quick buttons. Change breakdown from actual drawer state. "Exact Change." "Log & Give Change" writes to IndexedDB + updates denominations. | Calculate change, see breakdown, log transaction. Denominations update. |
| 6 | **Transaction Logging** | TransactionEntry for non-copay types. Transaction log display with running total. Void with reason. All types update IndexedDB. | Log all types. Running total accurate. Void reverses correctly. |
| 7 | **Closing + Reconciliation** | Closing count (blank grid). Expected vs counted. Discrepancy + denomination detail. Banners. Notes. Session sealed on close. | Close drawer. See balanced/short/over. Session becomes read-only. |
| 8 | **Printable Report** | PrintableReport with `@media print`. All sections per 6.5. `window.print()` button. One page, B&W, letter paper. | Print report. Readable. One page. Replaces the adding machine tape. |
| 9 | **History + Export + Settings** | History tab (past sessions, view/reprint). Settings (drawer label, copay amounts, export JSON, clear data with double-confirm). | Browse past reports. Export works. Clear works with confirmation. |
| 10 | **Polish + Deploy** | Edge cases from Section 8. Confirmations. Loading/empty states. Unusual amount warnings. PWA manifest. Tab-lock (prevent dual tabs). Deploy to Cloudflare Pages. Test on front desk Chromes. | Smooth happy paths. Edge cases handled. Live URL. Bookmarked on all 8 desks. |

---

## 8. Edge Cases & Error Handling

| Scenario | Behavior | UI Treatment |
|----------|----------|-------------|
| First launch on this computer | No sessions. Show welcome + settings prompt. | "Welcome to Tally. Set your drawer label in Settings, then start your first day." |
| Open session exists for today | Resume seamlessly. | Direct to drawer view. |
| Stale session from previous day | Block new day until resolved. | Amber: "Unclosed session from [date]. Close it or discard?" |
| Can't make exact change | Show closest breakdown + shortfall. | Yellow: "Can't make exact change. Short 25¢." |
| $0 opening count | Allow with confirmation. | "Opening with $0.00 — is this correct?" |
| Large transaction (>$500) | Allow with confirmation. | "Unusually large amount. Please confirm." |
| Voiding a transaction | Soft delete + reason. Reverses denomination changes. | Strikethrough in log. Reason shown. Totals recalculated. |
| Browser data cleared | All history gone. Printed reports are backup. | Behaves as first launch. |
| Multiple tabs open | Detect + block second tab. | "Tally is already open in another tab." |
| Closed session, wants to reopen | Not allowed. Envelope sealed. | "Session closed. Make an adjustment tomorrow if needed." |
| Printer unavailable | Report stays on screen. | "Report saved in History. Reprint anytime." |
| Power outage / crash | Open session preserved in IndexedDB. Unsaved inputs lost. | "Resuming today's session." on reopen. |
| Wrong access code (repeated) | No lockout. Just error each time. | "Incorrect code." |

---

## 9. Per-Machine Settings

Stored in IndexedDB, separate from sessions. Persists on this machine.

```typescript
interface TallySettings {
  drawerLabel: string;              // "Therapy Front Desk 1"
  commonCopays: number[];           // [1500, 2000, 2500, 3000, 4000, 5000] cents
  defaultOpeningTarget: number;     // 20000 ($200) — reference only, not enforced
}
```

---

## 10. What NOT to Build (Scope Boundaries)

- **Server / cloud database:** Everything client-side.
- **Cross-drawer admin view:** Each machine is independent.
- **User accounts / individual auth:** Shared access code only.
- **Staff name storage:** Desk labels only. Handwrite on printed report.
- **Multi-currency:** USD only.
- **Card / check tracking:** Cash only. Athena handles the rest.
- **Athena integration:** Standalone tool.
- **Coin roll counting:** Individual coins only for now.
- **Mobile optimization:** Desktop-first.
- **Dark mode:** Not needed.
- **Offline service worker:** Requires internet to load; works offline once loaded. Full offline is v2.

---

## 11. Future Enhancements (Post-Prototype)

- **Coin roll support:** "3 rolls of quarters" = $30.00.
- **Service worker:** Full offline capability.
- **Shared database (Supabase):** Cross-drawer admin view + remote access.
- **Staff PIN codes:** Per-person light auth.
- **Daily email summary:** Auto-send reconciliation to manager.
- **Trend analysis:** "Short 4 of last 10 days."
- **Starting balance enforcement:** Warn if opening ≠ standard $200.
- **Per-location copay amounts:** Different for therapy vs medical.
- **Deposit slip generator:** Format excess cash for bank deposit.
- **Cloudflare Access:** Zero-trust auth (free for ≤50 users).

---

*End of Technical Blueprint v1.1 | Begin building at Section 7, Step 1.*
