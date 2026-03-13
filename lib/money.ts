// All money is in integer cents. No floats. Ever.
// $20.00 = 2000.  $0.25 = 25.
// Display formatting happens only at the UI layer.

import { DENOMINATIONS } from "./denominations";
import type { DenominationCount } from "@/types";

export function centsToDisplay(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainingCents = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${dollars.toLocaleString()}.${remainingCents.toString().padStart(2, "0")}`;
}

export function displayToCents(display: string): number {
  const cleaned = display.replace(/[$,\s]/g, "");
  if (!cleaned || isNaN(parseFloat(cleaned))) return 0;
  return Math.round(parseFloat(cleaned) * 100);
}

// Parse a raw number input string to cents (handles both "20" → 2000 and "20.00" → 2000)
export function inputToCents(input: string): number {
  return displayToCents(input);
}

// Change-making: greedy algorithm (correct for US currency)
// Constrained by what's actually in the drawer at the time
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

  // Largest denomination first, constrained by available stock
  const sortedDenoms = [...DENOMINATIONS]
    .map((d) => ({ ...d, available: drawerDenominations[d.key] ?? 0 }))
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

// Format cents as a signed string: "+$25.00" or "-$5.00"
export function centsToSignedDisplay(cents: number): string {
  const sign = cents >= 0 ? "+" : "";
  return `${sign}${centsToDisplay(cents)}`;
}
