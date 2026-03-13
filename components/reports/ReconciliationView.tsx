"use client";

import { useState } from "react";
import { DenominationGrid } from "@/components/drawer/DenominationGrid";
import { emptyDenominationCount, totalFromDenominations } from "@/lib/denominations";
import { centsToDisplay } from "@/lib/money";
import { computeExpectedTotal } from "@/lib/reconciliation";
import { closeSession } from "@/lib/sessions";
import type { DrawerSession, Transaction, TallySettings } from "@/types";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DENOMINATIONS } from "@/lib/denominations";

interface ReconciliationViewProps {
  session: DrawerSession;
  transactions: Transaction[];
  settings: TallySettings;
  onClosed: (session: DrawerSession) => void;
}

export function ReconciliationView({
  session,
  transactions,
  settings,
  onClosed,
}: ReconciliationViewProps) {
  const [counts, setCounts] = useState(emptyDenominationCount());
  const [notes, setNotes] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [zeroConfirm, setZeroConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const closingTotal = totalFromDenominations(counts);
  const expectedTotal = computeExpectedTotal(session, transactions);
  const discrepancy = closingTotal - expectedTotal;

  const hasClosingCount = submitted;

  function getDiscrepancyDisplay() {
    if (discrepancy === 0) return { label: "Balanced", color: "text-green-600", bg: "bg-green-50 border-green-200" };
    if (discrepancy < 0) return {
      label: `Short ${centsToDisplay(Math.abs(discrepancy))}`,
      color: "text-red-600",
      bg: "bg-red-50 border-red-200",
    };
    return {
      label: `Over ${centsToDisplay(discrepancy)}`,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
    };
  }

  async function handleClose() {
    if (closingTotal === 0 && !submitted) {
      setZeroConfirm(true);
      return;
    }
    await doClose();
  }

  async function doClose() {
    setLoading(true);
    try {
      const closed = await closeSession(
        session,
        counts,
        closingTotal,
        expectedTotal,
        notes || null,
        selectedStaff || null
      );
      onClosed(closed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Close Drawer</h2>
        <p className="text-sm text-slate-500 mt-1">
          Count your physical cash and enter the quantities below.
        </p>
      </div>

      {/* Closing count */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 py-3">
        <div className="px-4 pb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Closing Count — enter quantities
          </p>
        </div>
        <DenominationGrid
          counts={counts}
          onChange={setCounts}
          highlightNonZero
        />
      </div>

      {/* Live reconciliation */}
      {closingTotal > 0 && (
        <div className="space-y-3">
          {/* Summary row */}
          <div className={`rounded-xl border p-4 space-y-3 ${getDiscrepancyDisplay().bg}`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Expected</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mt-0.5">
                  {centsToDisplay(expectedTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Counted</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mt-0.5">
                  {centsToDisplay(closingTotal)}
                </p>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">Result</p>
              <p className={`font-mono text-3xl font-bold ${getDiscrepancyDisplay().color} mt-0.5`}>
                {getDiscrepancyDisplay().label}
              </p>
            </div>
          </div>

          {/* Denomination-level breakdown */}
          {discrepancy !== 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Denomination Detail
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {DENOMINATIONS.map((d) => {
                  const expected = session.currentDenominations[d.key] ?? 0;
                  const counted = counts[d.key] ?? 0;
                  const diff = counted - expected;
                  if (expected === 0 && counted === 0) return null;
                  return (
                    <div
                      key={d.key}
                      className={`flex items-center justify-between px-4 py-2 text-sm ${
                        diff !== 0 ? "bg-red-50" : ""
                      }`}
                    >
                      <span className="font-mono font-semibold text-slate-700 w-12">
                        {d.label}
                      </span>
                      <span className="text-slate-500">
                        Expected: <span className="font-mono font-semibold text-slate-900">{expected}</span>
                      </span>
                      <span className="text-slate-500">
                        Counted: <span className="font-mono font-semibold text-slate-900">{counted}</span>
                      </span>
                      {diff !== 0 && (
                        <span className={`font-mono font-bold ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Staff selector */}
      {settings.staffNames.length > 0 && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Who is closing?
          </label>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Select staff member —</option>
            {settings.staffNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Notes <span className="text-slate-400 font-normal">(optional — explain any discrepancy)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Short $5 — patient may have received incorrect change at 2pm"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        disabled={loading || closingTotal === 0}
        className="w-full py-3 px-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 active:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
      >
        {loading ? "Closing..." : "Print Report & Close Day"}
      </button>

      <ConfirmDialog
        open={zeroConfirm}
        onOpenChange={setZeroConfirm}
        title="Closing with $0.00"
        description="You entered $0.00 for the closing count. Is this correct?"
        confirmLabel="Yes, Close with $0"
        onConfirm={() => {
          setZeroConfirm(false);
          doClose();
        }}
      />
    </div>
  );
}
