import type { DenominationCount } from "@/types";

export const DENOMINATIONS = [
  // Bills — large to small
  { key: "bill_10000", value: 10000, label: "$100", shortLabel: "$100", type: "bill" as const },
  { key: "bill_5000",  value: 5000,  label: "$50",  shortLabel: "$50",  type: "bill" as const },
  { key: "bill_2000",  value: 2000,  label: "$20",  shortLabel: "$20",  type: "bill" as const },
  { key: "bill_1000",  value: 1000,  label: "$10",  shortLabel: "$10",  type: "bill" as const },
  { key: "bill_500",   value: 500,   label: "$5",   shortLabel: "$5",   type: "bill" as const },
  { key: "bill_100",   value: 100,   label: "$1",   shortLabel: "$1",   type: "bill" as const },

  // Coins — large to small
  { key: "coin_25",    value: 25,    label: "25¢",  shortLabel: "25¢",  type: "coin" as const },
  { key: "coin_10",    value: 10,    label: "10¢",  shortLabel: "10¢",  type: "coin" as const },
  { key: "coin_5",     value: 5,     label: "5¢",   shortLabel: "5¢",   type: "coin" as const },
  { key: "coin_1",     value: 1,     label: "1¢",   shortLabel: "1¢",   type: "coin" as const },
] as const;

export type Denomination = typeof DENOMINATIONS[number];

export const BILL_DENOMINATIONS = DENOMINATIONS.filter((d) => d.type === "bill");
export const COIN_DENOMINATIONS = DENOMINATIONS.filter((d) => d.type === "coin");

export function emptyDenominationCount(): DenominationCount {
  const counts: DenominationCount = {};
  for (const d of DENOMINATIONS) {
    counts[d.key] = 0;
  }
  return counts;
}

export function totalFromDenominations(counts: DenominationCount): number {
  return Object.entries(counts).reduce((sum, [key, qty]) => {
    const denom = DENOMINATIONS.find((d) => d.key === key);
    if (!denom || !qty || qty <= 0) return sum;
    return sum + denom.value * qty;
  }, 0);
}

export function getDenomByKey(key: string): Denomination | undefined {
  return DENOMINATIONS.find((d) => d.key === key);
}

// Add two denomination counts together
export function addDenominations(
  a: DenominationCount,
  b: DenominationCount
): DenominationCount {
  const result = { ...a };
  for (const [key, qty] of Object.entries(b)) {
    result[key] = (result[key] || 0) + qty;
  }
  return result;
}

// Subtract b from a (a - b). Clamps to 0.
export function subtractDenominations(
  a: DenominationCount,
  b: DenominationCount
): DenominationCount {
  const result = { ...a };
  for (const [key, qty] of Object.entries(b)) {
    result[key] = Math.max(0, (result[key] || 0) - qty);
  }
  return result;
}
