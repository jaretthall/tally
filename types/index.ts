// All money values are integers in cents. $20.00 = 2000. Never floats.

// Denomination count: keys are "bill_10000", "coin_25", etc. Values are quantities.
export type DenominationCount = Record<string, number>;

export type SessionStatus = "open" | "counting" | "closed";

export type TransactionType =
  | "cash_in"
  | "cash_out"
  // Legacy types (kept for existing data compatibility)
  | "copay"
  | "payment"
  | "cash_drop"
  | "petty_cash"
  | "cash_loan"
  | "adjustment";

export interface DrawerSession {
  id: string;                           // UUID v4
  date: string;                         // ISO date: "2026-03-13"
  status: SessionStatus;

  // Opening count
  openingCount: DenominationCount | null;
  openingTotal: number | null;          // Cents
  openedAt: string | null;              // ISO datetime
  openedBy: string | null;              // Staff name from settings list

  // Live state (updated with each transaction)
  currentDenominations: DenominationCount;
  currentTotal: number;                 // Cents — running total

  // Closing count
  closingCount: DenominationCount | null;
  closingTotal: number | null;          // Cents
  closedAt: string | null;             // ISO datetime
  closedBy: string | null;             // Staff name

  // Reconciliation
  expectedTotal: number | null;        // openingTotal + net transactions
  discrepancy: number | null;          // closingTotal - expectedTotal
  notes: string | null;                // Staff note explaining discrepancy
}

export interface Transaction {
  id: string;                          // UUID v4
  sessionId: string;                   // FK to DrawerSession
  createdAt: string;                   // ISO datetime
  type: TransactionType;

  description: string;
  amountOwed: number | null;           // Cents — what was owed (for copay/payment)
  amountIn: number;                    // Cents — cash received into drawer
  amountOut: number;                   // Cents — cash given out of drawer
  netAmount: number;                   // amountIn - amountOut

  // Denomination tracking
  denominationsIn: DenominationCount | null;
  denominationsOut: DenominationCount | null;

  // Voiding
  voided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface TallySettings {
  drawerLabel: string;                 // "Centro Check-in 1"
  commonCopays: number[];              // Cents: [1500, 2000, 2500, 3000, 4000, 5000]
  defaultOpeningTarget: number;        // 20000 ($200) — reference only
  staffNames: string[];                // List of staff for open/close dropdowns
}

export const DEFAULT_SETTINGS: TallySettings = {
  drawerLabel: "",
  commonCopays: [1500, 2000, 2500, 3000, 4000, 5000],
  defaultOpeningTarget: 20000,
  staffNames: [],
};

export const DRAWER_LABEL_OPTIONS = [
  "Centro Check-in 1",
  "Centro Check-in 2",
  "Centro Check-out 1",
  "Centro Check-out 2",
  "Urgente 1",
  "Urgente 2",
  "Urgente 3",
];

export type SessionState =
  | { state: "no_session" }
  | { state: "open_today"; session: DrawerSession }
  | { state: "stale_open"; session: DrawerSession }
  | { state: "closed_today"; session: DrawerSession; canStartNew: true };
