"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { calculateChange, displayToCents, centsToDisplay } from "@/lib/money";
import {
  addDenominations,
  subtractDenominations,
  emptyDenominationCount,
  totalFromDenominations,
  DENOMINATIONS,
} from "@/lib/denominations";
import { saveTransaction, saveSession } from "@/lib/db";
import type { DrawerSession, Transaction, DenominationCount } from "@/types";
import { DenominationGrid } from "@/components/drawer/DenominationGrid";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface TransactionEntryProps {
  session: DrawerSession;
  onTransactionLogged: (session: DrawerSession, tx: Transaction) => void;
}

type Mode = "collect_payment" | "make_change" | "add_cash";

const QUICK_ACTIONS: { id: Mode; label: string; description: string }[] = [
  {
    id: "collect_payment",
    label: "Collect Payment",
    description: "Patient is paying — handles change",
  },
  {
    id: "make_change",
    label: "Make Change",
    description: "Give cash out from drawer",
  },
  {
    id: "add_cash",
    label: "Add Drawer Cash",
    description: "Replenish from safe or bank",
  },
];

export function TransactionEntry({ session, onTransactionLogged }: TransactionEntryProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [largeAmountConfirm, setLargeAmountConfirm] = useState(false);

  // Collect Payment
  const [amountOwed, setAmountOwed] = useState("");
  const [denomsReceived, setDenomsReceived] = useState<DenominationCount>(emptyDenominationCount());
  const [denomsChange, setDenomsChange] = useState<DenominationCount>(emptyDenominationCount());

  // Make Change
  const [changeAmount, setChangeAmount] = useState("");

  // Add Cash
  const [denomsAdded, setDenomsAdded] = useState<DenominationCount>(emptyDenominationCount());

  // --- Collect Payment derived values ---
  const amountOwedCents = displayToCents(amountOwed);
  const totalReceivedCents = totalFromDenominations(denomsReceived);
  const changeDueCents = Math.max(0, totalReceivedCents - amountOwedCents);
  const totalChangeGivenCents = totalFromDenominations(denomsChange);

  // Drawer inventory after receiving patient's payment (before giving change back)
  const drawerAfterReceiving = addDenominations(session.currentDenominations, denomsReceived);

  // Check if any denomination given back exceeds what's available
  const denominationErrors = DENOMINATIONS.filter(
    (d) => (denomsChange[d.key] ?? 0) > (drawerAfterReceiving[d.key] ?? 0)
  );

  const collectStatus = (() => {
    if (amountOwedCents <= 0 || totalReceivedCents <= 0) return null;
    if (totalReceivedCents < amountOwedCents) return "short" as const;
    if (totalReceivedCents === amountOwedCents) return "exact" as const;
    return "change_due" as const;
  })();

  const changeBalanced =
    changeDueCents > 0 &&
    totalChangeGivenCents === changeDueCents &&
    denominationErrors.length === 0;

  // --- Make Change derived values ---
  const changeAmountCents = displayToCents(changeAmount);
  const makeChangeResult =
    changeAmountCents > 0
      ? calculateChange(0, changeAmountCents, session.currentDenominations)
      : null;

  // --- Add Cash derived values ---
  const addCashTotal = totalFromDenominations(denomsAdded);

  function switchMode(newMode: Mode) {
    setMode(mode === newMode ? null : newMode);
    setDescription("");
    setAmountOwed("");
    setDenomsReceived(emptyDenominationCount());
    setDenomsChange(emptyDenominationCount());
    setChangeAmount("");
    setDenomsAdded(emptyDenominationCount());
  }

  function reset() {
    setMode(null);
    setDescription("");
    setAmountOwed("");
    setDenomsReceived(emptyDenominationCount());
    setDenomsChange(emptyDenominationCount());
    setChangeAmount("");
    setDenomsAdded(emptyDenominationCount());
  }

  async function doSubmit() {
    setLoading(true);
    try {
      let tx: Transaction;
      let newDenoms = session.currentDenominations;

      if (mode === "collect_payment") {
        const hasChange = changeDueCents > 0;
        tx = {
          id: uuidv4(),
          sessionId: session.id,
          createdAt: new Date().toISOString(),
          type: "cash_in",
          description: description.trim() || "Payment collected",
          amountOwed: amountOwedCents,
          amountIn: totalReceivedCents,
          amountOut: hasChange ? totalChangeGivenCents : 0,
          netAmount: amountOwedCents,
          denominationsIn: denomsReceived,
          denominationsOut: hasChange ? denomsChange : null,
          voided: false,
          voidedAt: null,
          voidReason: null,
        };
        newDenoms = addDenominations(session.currentDenominations, denomsReceived);
        if (hasChange) {
          newDenoms = subtractDenominations(newDenoms, denomsChange);
        }
      } else if (mode === "make_change") {
        tx = {
          id: uuidv4(),
          sessionId: session.id,
          createdAt: new Date().toISOString(),
          type: "cash_out",
          description: description.trim() || "Make change",
          amountOwed: null,
          amountIn: 0,
          amountOut: changeAmountCents,
          netAmount: -changeAmountCents,
          denominationsIn: null,
          denominationsOut: makeChangeResult?.breakdown ?? null,
          voided: false,
          voidedAt: null,
          voidReason: null,
        };
        if (makeChangeResult?.breakdown) {
          newDenoms = subtractDenominations(session.currentDenominations, makeChangeResult.breakdown);
        }
      } else {
        // add_cash
        tx = {
          id: uuidv4(),
          sessionId: session.id,
          createdAt: new Date().toISOString(),
          type: "cash_in",
          description: description.trim() || "Cash added to drawer",
          amountOwed: null,
          amountIn: addCashTotal,
          amountOut: 0,
          netAmount: addCashTotal,
          denominationsIn: denomsAdded,
          denominationsOut: null,
          voided: false,
          voidedAt: null,
          voidReason: null,
        };
        newDenoms = addDenominations(session.currentDenominations, denomsAdded);
      }

      await saveTransaction(tx);
      const updatedSession: DrawerSession = {
        ...session,
        currentTotal: session.currentTotal + tx.netAmount,
        currentDenominations: newDenoms,
      };
      await saveSession(updatedSession);

      reset();
      onTransactionLogged(updatedSession, tx);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount =
      mode === "collect_payment"
        ? amountOwedCents
        : mode === "make_change"
        ? changeAmountCents
        : addCashTotal;
    if (!amount) return;
    if (amount > 50000) {
      setLargeAmountConfirm(true);
      return;
    }
    doSubmit();
  }

  const canSubmit = (() => {
    if (mode === "collect_payment") {
      if (amountOwedCents <= 0 || totalReceivedCents <= 0) return false;
      if (collectStatus === "short") return false;
      if (collectStatus === "exact") return true;
      return changeBalanced;
    }
    if (mode === "make_change") return makeChangeResult?.possible === true;
    if (mode === "add_cash") return addCashTotal > 0;
    return false;
  })();

  const submitLabel = (() => {
    if (loading) return "Logging...";
    if (mode === "collect_payment") {
      if (collectStatus === "exact") return "Log Payment — No Change Needed";
      if (changeBalanced) return "Log Payment";
      return "Log Payment";
    }
    if (mode === "make_change") return "Log Change Given";
    if (mode === "add_cash") return "Log Cash Added";
    return "Log";
  })();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Quick action buttons */}
      <div className="grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchMode(id)}
            className={`py-3 px-2 rounded-xl font-semibold text-xs text-center transition-all leading-tight ${
              mode === id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Collect Payment */}
      {mode === "collect_payment" && (
        <div className="space-y-4">
          {/* Step 1: Amount owed */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Amount Owed
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountOwed}
              onChange={(e) => setAmountOwed(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 font-mono text-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Step 2: Bills received */}
          {amountOwedCents > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                  Bills &amp; coins received from patient
                </p>
              </div>
              <DenominationGrid
                counts={denomsReceived}
                onChange={setDenomsReceived}
                highlightNonZero
              />
            </div>
          )}

          {/* Status: short */}
          {collectStatus === "short" && (
            <div className="rounded-lg px-4 py-3 bg-amber-50 border border-amber-200">
              <p className="text-sm font-medium text-amber-700">
                Short {centsToDisplay(amountOwedCents - totalReceivedCents)} — patient hasn&apos;t paid enough
              </p>
            </div>
          )}

          {/* Status: exact */}
          {collectStatus === "exact" && (
            <div className="rounded-lg px-4 py-3 bg-green-50 border border-green-200">
              <p className="text-sm font-semibold text-green-700">
                Exact payment — no change needed
              </p>
            </div>
          )}

          {/* Status: change due */}
          {collectStatus === "change_due" && (
            <div className="space-y-3">
              <div className="rounded-lg px-4 py-3 bg-blue-50 border border-blue-200">
                <p className="text-sm font-semibold text-blue-800">
                  Change due to patient: {centsToDisplay(changeDueCents)}
                </p>
              </div>

              {/* Step 3: Denominations given back */}
              <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
                <div className="px-4 pt-3 pb-1">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                    Bills &amp; coins given back to patient
                  </p>
                </div>
                <DenominationGrid
                  counts={denomsChange}
                  onChange={setDenomsChange}
                  highlightNonZero
                />
              </div>

              {/* Denomination inventory errors */}
              {denominationErrors.length > 0 && (
                <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200">
                  <p className="text-sm font-semibold text-red-700 mb-1">
                    Not enough in drawer:
                  </p>
                  {denominationErrors.map((d) => (
                    <p key={d.key} className="text-sm text-red-600">
                      {d.label} — have {drawerAfterReceiving[d.key] ?? 0}, need {denomsChange[d.key]}
                    </p>
                  ))}
                </div>
              )}

              {/* Balance status */}
              {totalChangeGivenCents > 0 && denominationErrors.length === 0 && (
                <div
                  className={`rounded-lg px-4 py-3 border ${
                    changeBalanced
                      ? "bg-green-50 border-green-200"
                      : totalChangeGivenCents > changeDueCents
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  {changeBalanced ? (
                    <p className="text-sm font-semibold text-green-700">
                      Balanced — ready to log
                    </p>
                  ) : totalChangeGivenCents > changeDueCents ? (
                    <p className="text-sm text-red-700">
                      Over by {centsToDisplay(totalChangeGivenCents - changeDueCents)}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700">
                      Still owe {centsToDisplay(changeDueCents - totalChangeGivenCents)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Make Change */}
      {mode === "make_change" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Amount to give out ($)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={changeAmount}
              onChange={(e) => setChangeAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 font-mono text-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {makeChangeResult && changeAmountCents > 0 && (
            <div
              className={`rounded-xl p-4 ${
                makeChangeResult.possible
                  ? "bg-slate-50 border border-slate-200"
                  : "bg-amber-50 border border-amber-200"
              }`}
            >
              {makeChangeResult.possible ? (
                <>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Give from drawer
                  </p>
                  <div className="space-y-1">
                    {DENOMINATIONS.filter(
                      (d) => (makeChangeResult.breakdown[d.key] ?? 0) > 0
                    ).map((d) => {
                      const qty = makeChangeResult.breakdown[d.key]!;
                      return (
                        <div key={d.key} className="flex justify-between items-center">
                          <span className="font-mono text-slate-800 font-medium">
                            {qty}× {d.label}
                          </span>
                          <span className="font-mono text-slate-500 text-sm">
                            {centsToDisplay(d.value * qty)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-700">
                  Can&apos;t make exact change — short{" "}
                  {centsToDisplay(makeChangeResult.shortBy ?? 0)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Cash */}
      {mode === "add_cash" && (
        <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
              Enter bills &amp; coins being added
            </p>
          </div>
          <DenominationGrid
            counts={denomsAdded}
            onChange={setDenomsAdded}
            highlightNonZero
          />
        </div>
      )}

      {/* Optional note */}
      {mode && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Note <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              mode === "collect_payment"
                ? "e.g. Patient copay"
                : mode === "make_change"
                ? "e.g. Parking change"
                : "e.g. Replenishment from safe"
            }
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Submit */}
      {mode && (
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitLabel}
        </button>
      )}

      <ConfirmDialog
        open={largeAmountConfirm}
        onOpenChange={setLargeAmountConfirm}
        title="Unusually Large Amount"
        description="This transaction is over $500. Please confirm this is correct."
        confirmLabel="Yes, Log It"
        onConfirm={() => {
          setLargeAmountConfirm(false);
          doSubmit();
        }}
      />
    </form>
  );
}
