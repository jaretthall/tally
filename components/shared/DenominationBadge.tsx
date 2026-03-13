"use client";

import { getDenomByKey } from "@/lib/denominations";
import { centsToDisplay } from "@/lib/money";
import type { DenominationCount } from "@/types";

interface DenominationBadgeProps {
  denomKey: string;
  quantity: number;
}

export function DenominationBadge({ denomKey, quantity }: DenominationBadgeProps) {
  const denom = getDenomByKey(denomKey);
  if (!denom || quantity <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-md text-sm font-mono">
      <span className="text-slate-500">{quantity}×</span>
      <span className="font-semibold text-slate-900">{denom.label}</span>
    </span>
  );
}

interface DenominationBreakdownProps {
  counts: DenominationCount;
  colorClass?: string;
}

export function DenominationBreakdown({
  counts,
  colorClass = "text-slate-700",
}: DenominationBreakdownProps) {
  const entries = Object.entries(counts).filter(([, qty]) => qty > 0);
  if (entries.length === 0) return null;

  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([key, qty]) => (
        <DenominationBadge key={key} denomKey={key} quantity={qty} />
      ))}
    </span>
  );
}
