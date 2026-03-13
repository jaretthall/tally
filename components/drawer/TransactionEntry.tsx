"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { displayToCents, centsToDisplay } from "@/lib/money";
import { saveTransaction, saveSession } from "@/lib/db";
import { addDenominations, emptyDenominationCount } from "@/lib/denominations";
import type { DrawerSession, Transaction, TransactionType } from "@/types";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface TransactionEntryProps {
  session: DrawerSession;
  onTransactionLogged: (session: DrawerSession, tx: Transaction) => void;
}

const TRANSACTION_TYPES: { value: TransactionType; label: string; description: string }[] = [
  { value: "copay", label: "Copay", description: "Patient copay — may need change" },
  { value: "payment", label: "Payment", description: "Other patient payment" },
  { value: "cash_drop", label: "Cash Drop", description: "Remove cash to safe" },
  { value: "petty_cash", label: "Petty Cash", description: "Small office expense" },
  { value: "cash_loan", label: "Cash Loan", description: "Add cash from safe/bank" },
  { value: "adjustment", label: "Adjustment", description: "Correct a mistake" },
];

export function TransactionEntry({
  session,
  onTransactionLogged,
}: TransactionEntryProps) {
  const [type, setType] = useState<TransactionType>("copay");
  const [description, setDescription] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [largeAmountConfirm, setLargeAmountConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const amountInCents = displayToCents(amountIn);
  const amountOutCents = displayToCents(amountOut);
  const netAmount = amountInCents - amountOutCents;

  // Direction helpers
  const isInOnly = type === "cash_loan";
  const isOutOnly = type === "cash_drop" || type === "petty_cash";

  function getDefaultDescription(): string {
    switch (type) {
      case "copay": return "Patient copay";
      case "payment": return "Patient payment";
      case "cash_drop": return "Cash drop to safe";
      case "petty_cash": return "Petty cash";
      case "cash_loan": return "Cash from safe";
      case "adjustment": return "Adjustment";
    }
  }

  async function doSubmit() {
    setLoading(true);
    try {
      const tx: Transaction = {
        id: uuidv4(),
        sessionId: session.id,
        createdAt: new Date().toISOString(),
        type,
        description: description.trim() || getDefaultDescription(),
        amountOwed: null,
        amountIn: amountInCents,
        amountOut: amountOutCents,
        netAmount,
        denominationsIn: null,
        denominationsOut: null,
        voided: false,
        voidedAt: null,
        voidReason: null,
      };

      await saveTransaction(tx);

      // Update session running total and denominations
      const updatedSession: DrawerSession = {
        ...session,
        currentTotal: session.currentTotal + netAmount,
        // For non-copay transactions, we don't track denomination breakdown
        // (copay/change transactions are handled by ChangeCalculator)
        currentDenominations: session.currentDenominations,
      };
      await saveSession(updatedSession);

      // Reset form
      setDescription("");
      setAmountIn("");
      setAmountOut("");
      setType("copay");

      onTransactionLogged(updatedSession, tx);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountInCents && !amountOutCents) return;

    const totalAmount = Math.max(amountInCents, amountOutCents);
    if (totalAmount > 50000 && !pendingSubmit) {
      setPendingSubmit(true);
      setLargeAmountConfirm(true);
      return;
    }
    doSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Transaction type */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Type</label>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as TransactionType);
            setAmountIn("");
            setAmountOut("");
          }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Description <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={getDefaultDescription()}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Amount fields */}
      <div className="grid grid-cols-2 gap-3">
        {!isOutOnly && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-green-700">
              Cash In ($)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.00"
              className="w-full border border-green-200 rounded-lg px-3 py-2 font-mono text-slate-900 bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        )}
        {!isInOnly && (
          <div className={`space-y-1.5 ${isOutOnly ? "col-span-2" : ""}`}>
            <label className="block text-sm font-medium text-red-700">
              Cash Out ($)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountOut}
              onChange={(e) => setAmountOut(e.target.value)}
              placeholder="0.00"
              className="w-full border border-red-200 rounded-lg px-3 py-2 font-mono text-slate-900 bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}
      </div>

      {/* Net preview */}
      {(amountInCents > 0 || amountOutCents > 0) && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-sm text-slate-600">Net effect on drawer</span>
          <span
            className={`font-mono font-semibold ${
              netAmount >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {netAmount >= 0 ? "+" : ""}
            {centsToDisplay(netAmount)}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (!amountInCents && !amountOutCents)}
        className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {loading ? "Logging..." : "Log Transaction"}
      </button>

      <ConfirmDialog
        open={largeAmountConfirm}
        onOpenChange={setLargeAmountConfirm}
        title="Unusually Large Amount"
        description={`This transaction is for ${centsToDisplay(Math.max(amountInCents, amountOutCents))}. Please confirm this is correct.`}
        confirmLabel="Yes, Log It"
        onConfirm={() => {
          setLargeAmountConfirm(false);
          doSubmit();
        }}
      />
    </form>
  );
}
