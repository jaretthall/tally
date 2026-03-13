"use client";

import { useState } from "react";
import { DenominationGrid } from "./DenominationGrid";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { emptyDenominationCount, totalFromDenominations } from "@/lib/denominations";
import { centsToDisplay } from "@/lib/money";
import {
  createSession,
  submitOpeningCount,
  discardStaleSession,
} from "@/lib/sessions";
import { saveSession } from "@/lib/db";
import type { DrawerSession, SessionState, TallySettings } from "@/types";

interface SessionManagerProps {
  sessionState: SessionState;
  settings: TallySettings;
  onSessionReady: (session: DrawerSession) => void;
}

export function SessionManager({
  sessionState,
  settings,
  onSessionReady,
}: SessionManagerProps) {
  const [counts, setCounts] = useState(emptyDenominationCount());
  const [selectedStaff, setSelectedStaff] = useState("");
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [zeroConfirm, setZeroConfirm] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const total = totalFromDenominations(counts);

  async function handleOpenDrawer() {
    if (total === 0 && !pendingOpen) {
      setZeroConfirm(true);
      return;
    }
    await doOpen();
  }

  async function doOpen() {
    setLoading(true);
    try {
      const staffName = selectedStaff || null;
      const session = await createSession(staffName);
      const opened = await submitOpeningCount(session, counts, total);
      onSessionReady(opened);
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscard() {
    if (sessionState.state !== "stale_open") return;
    setLoading(true);
    try {
      await discardStaleSession(sessionState.session);
      setDiscardConfirm(false);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  async function handleClosePrevious() {
    if (sessionState.state !== "stale_open") return;
    // Navigate into the stale session to close it
    const staleSession = sessionState.session;
    const updated = { ...staleSession, status: "counting" as const };
    await saveSession(updated);
    onSessionReady(updated);
  }

  async function handleStartNewAfterClosed() {
    await doOpen();
  }

  // ── Stale session from previous day ──────────────────────────────────────
  if (sessionState.state === "stale_open") {
    const { session } = sessionState;
    const formattedDate = new Date(session.date + "T12:00:00").toLocaleDateString(
      "en-US",
      { weekday: "long", month: "long", day: "numeric" }
    );

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-8 space-y-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h2 className="text-lg font-semibold text-amber-900">
                  Unclosed Session Found
                </h2>
                <p className="text-amber-800 mt-1">
                  There is an open session from <strong>{formattedDate}</strong> that
                  was never closed. Resolve it before starting today.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-amber-200">
              <p className="text-sm text-slate-600">Last running total</p>
              <p className="font-mono text-3xl font-bold text-slate-900 mt-1">
                {centsToDisplay(session.currentTotal)}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleClosePrevious}
                disabled={loading}
                className="w-full py-3 px-4 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                Close Previous Day
              </button>
              <button
                onClick={() => setDiscardConfirm(true)}
                disabled={loading}
                className="w-full py-3 px-4 bg-white text-red-600 border border-red-200 font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Discard Previous Day
              </button>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={discardConfirm}
          onOpenChange={setDiscardConfirm}
          title="Discard Previous Day?"
          description={`This will permanently discard the unclosed session from ${formattedDate}. This cannot be undone.`}
          confirmLabel="Yes, Discard"
          destructive
          onConfirm={handleDiscard}
        />
      </div>
    );
  }

  // ── Closed session today — show latest report + offer new session ─────────
  if (sessionState.state === "closed_today") {
    const { session } = sessionState;
    const disc = session.discrepancy ?? 0;

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                Today&apos;s Session Closed
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {session.closedBy
                  ? `Closed by ${session.closedBy}`
                  : "Session has been closed"}
              </p>
            </div>

            <div
              className={`rounded-xl p-4 text-center ${
                disc === 0
                  ? "bg-green-50 border border-green-200"
                  : disc < 0
                  ? "bg-red-50 border border-red-200"
                  : "bg-amber-50 border border-amber-200"
              }`}
            >
              <p
                className={`font-mono text-2xl font-bold ${
                  disc === 0
                    ? "text-green-700"
                    : disc < 0
                    ? "text-red-700"
                    : "text-amber-700"
                }`}
              >
                {disc === 0
                  ? "Balanced"
                  : disc < 0
                  ? `Short ${centsToDisplay(Math.abs(disc))}`
                  : `Over ${centsToDisplay(disc)}`}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
              >
                Reprint Report
              </button>
            </div>
          </div>

          {/* Shift handoff: start a new session */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              Starting a new shift?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              If someone else is taking over, open a fresh session below.
            </p>
            {renderOpeningForm()}
          </div>
        </div>
      </div>
    );
  }

  // ── No session — start new day ────────────────────────────────────────────
  function renderOpeningForm() {
    return (
      <div className="space-y-4">
        {/* Staff selector */}
        {settings.staffNames.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Who is opening?
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

        {/* Denomination grid */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 py-3">
          <DenominationGrid
            counts={counts}
            onChange={setCounts}
            highlightNonZero
          />
        </div>

        <button
          onClick={handleOpenDrawer}
          disabled={loading}
          className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          {loading ? "Opening..." : "Open Drawer"}
        </button>

        <ConfirmDialog
          open={zeroConfirm}
          onOpenChange={setZeroConfirm}
          title="Opening with $0.00"
          description="You entered $0.00 as the opening balance. Is this correct?"
          confirmLabel="Yes, Open with $0"
          onConfirm={() => {
            setPendingOpen(true);
            setZeroConfirm(false);
            doOpen();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">Start New Day</h2>
            <p className="text-slate-500 text-sm mt-1">
              Count your drawer and enter the amounts below
            </p>
          </div>
          {renderOpeningForm()}
        </div>
      </div>
    </div>
  );
}
