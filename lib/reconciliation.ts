import type { DrawerSession, Transaction, DenominationCount } from "@/types";
import { DENOMINATIONS } from "./denominations";
import { centsToDisplay } from "./money";

export interface ReconciliationResult {
  expectedTotal: number;
  closingTotal: number;
  discrepancy: number;
  status: "balanced" | "short" | "over";
  denominationDiff: DenominationDiff[];
}

export interface DenominationDiff {
  key: string;
  label: string;
  expectedQty: number;   // Based on opening + transactions
  countedQty: number;    // From closing count
  diff: number;          // counted - expected
  expectedValue: number; // cents
  countedValue: number;  // cents
}

export function computeExpectedTotal(
  session: DrawerSession,
  transactions: Transaction[]
): number {
  const openingTotal = session.openingTotal ?? 0;
  const netTransactions = transactions
    .filter((t) => !t.voided)
    .reduce((sum, t) => sum + t.netAmount, 0);
  return openingTotal + netTransactions;
}

export function computeReconciliation(
  session: DrawerSession,
  closingCount: DenominationCount
): ReconciliationResult {
  const expectedTotal = session.expectedTotal ?? 0;
  const closingTotal = session.closingTotal ?? 0;
  const discrepancy = closingTotal - expectedTotal;

  let status: "balanced" | "short" | "over";
  if (discrepancy === 0) status = "balanced";
  else if (discrepancy < 0) status = "short";
  else status = "over";

  // Denomination-level comparison
  // We use currentDenominations as the expected breakdown
  const expectedDenoms = session.currentDenominations;
  const denominationDiff: DenominationDiff[] = DENOMINATIONS.map((d) => {
    const expectedQty = expectedDenoms[d.key] ?? 0;
    const countedQty = closingCount[d.key] ?? 0;
    return {
      key: d.key,
      label: d.label,
      expectedQty,
      countedQty,
      diff: countedQty - expectedQty,
      expectedValue: expectedQty * d.value,
      countedValue: countedQty * d.value,
    };
  });

  return { expectedTotal, closingTotal, discrepancy, status, denominationDiff };
}

export function getDiscrepancyLabel(discrepancy: number): string {
  if (discrepancy === 0) return "Balanced";
  if (discrepancy < 0) return `Short ${centsToDisplay(Math.abs(discrepancy))}`;
  return `Over ${centsToDisplay(discrepancy)}`;
}
