"use client";

import { useState } from "react";
import { centsToDisplay } from "@/lib/money";
import { saveTransaction, saveSession } from "@/lib/db";
import type { DrawerSession, Transaction } from "@/types";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  cash_in:    { label: "Cash In",  color: "bg-green-100 text-green-800" },
  cash_out:   { label: "Cash Out", color: "bg-red-100 text-red-800" },
  // Legacy labels for historical data
  copay:      { label: "Copay",    color: "bg-blue-100 text-blue-800" },
  payment:    { label: "Payment",  color: "bg-blue-100 text-blue-800" },
  cash_drop:  { label: "Cash Drop",color: "bg-orange-100 text-orange-800" },
  petty_cash: { label: "Petty",    color: "bg-purple-100 text-purple-800" },
  cash_loan:  { label: "Loan",     color: "bg-green-100 text-green-800" },
  adjustment: { label: "Adjust",   color: "bg-slate-100 text-slate-800" },
};

interface TransactionLogProps {
  session: DrawerSession;
  transactions: Transaction[];
  onTransactionVoided: (session: DrawerSession, tx: Transaction) => void;
}

export function TransactionLog({
  session,
  transactions,
  onTransactionVoided,
}: TransactionLogProps) {
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [loading, setLoading] = useState(false);

  const active = transactions.filter((t) => !t.voided);
  const netTotal = active.reduce((sum, t) => sum + t.netAmount, 0);

  async function handleVoid() {
    if (!voidTarget) return;
    setLoading(true);
    try {
      const voided: Transaction = {
        ...voidTarget,
        voided: true,
        voidedAt: new Date().toISOString(),
        voidReason: voidReason.trim() || "No reason given",
      };
      await saveTransaction(voided);

      // Reverse the net effect on session
      const updatedSession: DrawerSession = {
        ...session,
        currentTotal: session.currentTotal - voidTarget.netAmount,
      };
      await saveSession(updatedSession);

      setVoidTarget(null);
      setVoidReason("");
      onTransactionVoided(updatedSession, voided);
    } finally {
      setLoading(false);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">No transactions yet</p>
      </div>
    );
  }

  function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid grid-cols-[80px_1fr_80px_80px_80px_32px] gap-2 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
        <span>Time</span>
        <span>Description</span>
        <span className="text-right">In</span>
        <span className="text-right">Out</span>
        <span className="text-right">Net</span>
        <span />
      </div>

      {/* Transaction rows */}
      {transactions.map((tx) => {
        const typeInfo = TYPE_LABELS[tx.type] ?? { label: tx.type, color: "bg-slate-100 text-slate-800" };
        return (
          <div
            key={tx.id}
            className={`grid grid-cols-[80px_1fr_80px_80px_80px_32px] gap-2 px-3 py-2 rounded-lg items-center transition-colors ${
              tx.voided
                ? "opacity-40 line-through bg-slate-50"
                : "hover:bg-slate-50"
            }`}
          >
            <span className="text-xs text-slate-500 font-mono">
              {formatTime(tx.createdAt)}
            </span>

            <div className="min-w-0">
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1.5 ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <span className="text-sm text-slate-700 truncate">
                {tx.description}
              </span>
              {tx.voided && tx.voidReason && (
                <span className="block text-xs text-red-500 mt-0.5">
                  Voided: {tx.voidReason}
                </span>
              )}
            </div>

            <span className="text-right font-mono text-sm text-green-700">
              {tx.amountIn > 0 ? centsToDisplay(tx.amountIn) : "—"}
            </span>
            <span className="text-right font-mono text-sm text-red-600">
              {tx.amountOut > 0 ? centsToDisplay(tx.amountOut) : "—"}
            </span>
            <span
              className={`text-right font-mono text-sm font-semibold ${
                tx.netAmount >= 0 ? "text-green-700" : "text-red-600"
              }`}
            >
              {tx.netAmount >= 0 ? "+" : ""}
              {centsToDisplay(tx.netAmount)}
            </span>

            <div className="flex justify-center">
              {!tx.voided && session.status === "open" && (
                <button
                  onClick={() => setVoidTarget(tx)}
                  className="text-slate-300 hover:text-red-500 transition-colors text-xs leading-none p-1"
                  title="Void transaction"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Net total */}
      <div className="border-t border-slate-200 pt-2 mt-2">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-sm font-semibold text-slate-600">
            Net Transactions ({active.length})
          </span>
          <span
            className={`font-mono font-bold text-lg ${
              netTotal >= 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {netTotal >= 0 ? "+" : ""}
            {centsToDisplay(netTotal)}
          </span>
        </div>
      </div>

      {/* Void dialog */}
      <ConfirmDialog
        open={!!voidTarget}
        onOpenChange={(open) => {
          if (!open) {
            setVoidTarget(null);
            setVoidReason("");
          }
        }}
        title="Void Transaction"
        description={`Void "${voidTarget?.description}" for ${voidTarget ? centsToDisplay(Math.abs(voidTarget.netAmount)) : ""}? This reverses the effect on the drawer total.`}
        confirmLabel={loading ? "Voiding..." : "Void Transaction"}
        destructive
        onConfirm={handleVoid}
      />
    </div>
  );
}
