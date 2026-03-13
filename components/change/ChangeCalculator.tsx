"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { calculateChange, centsToDisplay, displayToCents } from "@/lib/money";
import {
  addDenominations,
  subtractDenominations,
  getDenomByKey,
  emptyDenominationCount,
} from "@/lib/denominations";
import { saveTransaction, saveSession } from "@/lib/db";
import type { DrawerSession, Transaction, DenominationCount, TallySettings } from "@/types";

const QUICK_TENDERED = [2000, 5000, 10000]; // $20, $50, $100

interface ChangeCalculatorProps {
  session: DrawerSession;
  settings: TallySettings;
  onTransactionLogged: (session: DrawerSession, tx: Transaction) => void;
}

export function ChangeCalculator({
  session,
  settings,
  onTransactionLogged,
}: ChangeCalculatorProps) {
  const [owedInput, setOwedInput] = useState("");
  const [tenderedInput, setTenderedInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const owedCents = displayToCents(owedInput);
  const tenderedCents = displayToCents(tenderedInput);
  const hasInputs = owedCents > 0 && tenderedCents > 0;

  const changeResult = hasInputs
    ? calculateChange(owedCents, tenderedCents, session.currentDenominations)
    : null;

  const isExactChange = tenderedCents === owedCents && owedCents > 0;
  const isOverpaid = tenderedCents > owedCents;
  const isUnderpaid = tenderedCents > 0 && owedCents > 0 && tenderedCents < owedCents;

  // Find which $X bill was tendered for denomination tracking
  function getTenderedDenomination(cents: number): DenominationCount {
    const counts = emptyDenominationCount();
    // Try to match to a single bill denomination
    const billKeys = [
      "bill_10000",
      "bill_5000",
      "bill_2000",
      "bill_1000",
      "bill_500",
      "bill_100",
    ];
    for (const key of billKeys) {
      const d = getDenomByKey(key);
      if (d && d.value === cents) {
        counts[key] = 1;
        return counts;
      }
    }
    return counts; // Unknown denomination mix — leave blank
  }

  async function handleLogAndGiveChange() {
    if (!changeResult || isUnderpaid) return;
    setLoading(true);
    try {
      const denominationsIn = getTenderedDenomination(tenderedCents);
      const denominationsOut = changeResult.breakdown;

      const tx: Transaction = {
        id: uuidv4(),
        sessionId: session.id,
        createdAt: new Date().toISOString(),
        type: "copay",
        description: `Copay — tendered ${centsToDisplay(tenderedCents)}`,
        amountOwed: owedCents,
        amountIn: tenderedCents,
        amountOut: changeResult.changeDue,
        netAmount: owedCents,
        denominationsIn,
        denominationsOut,
        voided: false,
        voidedAt: null,
        voidReason: null,
      };

      await saveTransaction(tx);

      // Update drawer: add tendered, subtract change given
      const afterIn = addDenominations(session.currentDenominations, denominationsIn);
      const afterChange = subtractDenominations(afterIn, denominationsOut);

      const updatedSession: DrawerSession = {
        ...session,
        currentTotal: session.currentTotal + owedCents,
        currentDenominations: afterChange,
      };
      await saveSession(updatedSession);

      setOwedInput("");
      setTenderedInput("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);

      onTransactionLogged(updatedSession, tx);
    } finally {
      setLoading(false);
    }
  }

  async function handleExactChange() {
    if (owedCents <= 0) return;
    setLoading(true);
    try {
      const tx: Transaction = {
        id: uuidv4(),
        sessionId: session.id,
        createdAt: new Date().toISOString(),
        type: "copay",
        description: `Copay — exact change`,
        amountOwed: owedCents,
        amountIn: owedCents,
        amountOut: 0,
        netAmount: owedCents,
        denominationsIn: null,
        denominationsOut: null,
        voided: false,
        voidedAt: null,
        voidReason: null,
      };

      await saveTransaction(tx);

      const updatedSession: DrawerSession = {
        ...session,
        currentTotal: session.currentTotal + owedCents,
      };
      await saveSession(updatedSession);

      setOwedInput("");
      setTenderedInput("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onTransactionLogged(updatedSession, tx);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Amount Owed */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Amount Owed
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={owedInput}
          onChange={(e) => setOwedInput(e.target.value)}
          placeholder="0.00"
          className="w-full text-center font-mono text-3xl font-bold px-4 py-4 border-2 border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
        />
        {/* Quick copay buttons */}
        <div className="flex flex-wrap gap-2">
          {settings.commonCopays.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => setOwedInput((cents / 100).toFixed(2))}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                owedCents === cents
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {centsToDisplay(cents)}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Tendered */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Amount Tendered
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={tenderedInput}
          onChange={(e) => setTenderedInput(e.target.value)}
          placeholder="0.00"
          className="w-full text-center font-mono text-3xl font-bold px-4 py-4 border-2 border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
        />
        {/* Quick tender buttons */}
        <div className="flex gap-2">
          {QUICK_TENDERED.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => setTenderedInput((cents / 100).toFixed(2))}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                tenderedCents === cents
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {centsToDisplay(cents)} bill
            </button>
          ))}
        </div>
      </div>

      {/* Change Due display */}
      {hasInputs && (
        <div className="space-y-3">
          {isUnderpaid ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-sm text-red-700 font-medium">Amount tendered is less than amount owed</p>
              <p className="font-mono text-2xl font-bold text-red-600 mt-1">
                Still owes {centsToDisplay(owedCents - tenderedCents)}
              </p>
            </div>
          ) : (
            <>
              <div
                className={`p-4 rounded-xl border text-center ${
                  changeResult?.changeDue === 0
                    ? "bg-green-50 border-green-200"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                <p className="text-sm text-slate-600 mb-1">Change Due</p>
                <p
                  className={`font-mono text-5xl font-bold ${
                    changeResult?.changeDue === 0 ? "text-green-600" : "text-blue-700"
                  }`}
                >
                  {centsToDisplay(changeResult?.changeDue ?? 0)}
                </p>
              </div>

              {/* Change breakdown */}
              {changeResult && changeResult.changeDue > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Give back:</p>
                  {!changeResult.possible && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800 font-medium">
                        ⚠️ Can&apos;t make exact change. Short{" "}
                        {centsToDisplay(changeResult.shortBy ?? 0)}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {Object.entries(changeResult.breakdown)
                      .filter(([, qty]) => qty > 0)
                      .map(([key, qty]) => {
                        const d = getDenomByKey(key);
                        if (!d) return null;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between py-1"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg font-mono text-sm font-bold text-slate-700">
                                {qty}
                              </span>
                              <span className="font-semibold text-slate-800">
                                × {d.label}
                              </span>
                            </div>
                            <span className="font-mono text-slate-600">
                              {centsToDisplay(qty * d.value)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {success ? (
          <div className="w-full py-3 px-4 bg-green-100 text-green-800 font-semibold rounded-xl text-center">
            ✓ Transaction logged
          </div>
        ) : (
          <>
            {hasInputs && !isUnderpaid && (
              <button
                onClick={handleLogAndGiveChange}
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? "Logging..." : "Log & Give Change"}
              </button>
            )}
            {owedCents > 0 && (
              <button
                onClick={handleExactChange}
                disabled={loading}
                className="w-full py-3 px-4 bg-white text-slate-700 border border-slate-200 font-semibold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Exact Change (no change needed)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
