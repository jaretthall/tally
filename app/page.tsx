"use client";

import { useEffect, useState, useCallback } from "react";
import { AccessGate } from "@/components/auth/AccessGate";
import { SessionManager } from "@/components/drawer/SessionManager";
import { StatusBanner } from "@/components/drawer/StatusBanner";
import { DenominationGrid } from "@/components/drawer/DenominationGrid";
import { TransactionEntry } from "@/components/drawer/TransactionEntry";
import { ChangeCalculator } from "@/components/change/ChangeCalculator";
import { TransactionLog } from "@/components/reports/TransactionLog";
import { ReconciliationView } from "@/components/reports/ReconciliationView";
import { PrintableReport } from "@/components/reports/PrintableReport";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { detectSessionState } from "@/lib/sessions";
import { getSettings, getTransactionsBySession } from "@/lib/db";
import { centsToDisplay } from "@/lib/money";
import type { DrawerSession, Transaction, SessionState, TallySettings } from "@/types";

type Tab = "drawer" | "change" | "close";

function getTodayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function HomePage() {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [activeSession, setActiveSession] = useState<DrawerSession | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<TallySettings | null>(null);
  const [tab, setTab] = useState<Tab>("drawer");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [state, sett] = await Promise.all([detectSessionState(), getSettings()]);
    setSessionState(state);
    setSettings(sett);

    if (state.state === "open_today") {
      setActiveSession(state.session);
      const txs = await getTransactionsBySession(state.session.id);
      setTransactions(txs);
    } else if (state.state === "stale_open") {
      setActiveSession(state.session);
      const txs = await getTransactionsBySession(state.session.id);
      setTransactions(txs);
    } else if (state.state === "closed_today") {
      setActiveSession(state.session);
      const txs = await getTransactionsBySession(state.session.id);
      setTransactions(txs);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function handleSessionReady(session: DrawerSession) {
    setActiveSession(session);
    setTransactions([]);
    setSessionState({ state: "open_today", session });
    setTab("drawer");
  }

  function handleTransactionLogged(updatedSession: DrawerSession, tx: Transaction) {
    setActiveSession(updatedSession);
    setTransactions((prev) => [...prev, tx]);
  }

  function handleTransactionVoided(updatedSession: DrawerSession, tx: Transaction) {
    setActiveSession(updatedSession);
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? tx : t)));
  }

  function handleClosed(session: DrawerSession) {
    setActiveSession(session);
    setSessionState({ state: "closed_today", session, canStartNew: true });
    setTimeout(() => window.print(), 300);
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  const isActive = activeSession?.status === "open";
  const isClosed = activeSession?.status === "closed";
  const showSessionManager =
    !isActive &&
    !isClosed &&
    (sessionState?.state === "no_session" ||
      sessionState?.state === "stale_open" ||
      sessionState?.state === "closed_today");

  return (
    <AccessGate>
      {/* Printable report — hidden on screen, shown on print */}
      {activeSession && (
        <PrintableReport
          session={activeSession}
          transactions={transactions}
          drawerLabel={settings.drawerLabel || "Cash Drawer"}
        />
      )}

      {/* App shell */}
      <div className="no-print min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="h-14 bg-slate-900 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-white font-bold text-lg tracking-tight">Tally</span>
            {settings.drawerLabel && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 text-sm font-medium">
                  {settings.drawerLabel}
                </span>
              </>
            )}
            <span className="text-slate-500 text-sm hidden sm:block">
              {getTodayLabel()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeSession && <StatusBanner session={activeSession} />}
            <div className="flex gap-1">
              <a
                href="/history/"
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded transition-colors"
              >
                History
              </a>
              <a
                href="/settings/"
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded transition-colors"
              >
                Settings
              </a>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {showSessionManager ? (
            <SessionManager
              sessionState={sessionState ?? { state: "no_session" }}
              settings={settings}
              onSessionReady={handleSessionReady}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {/* Tab navigation */}
              {isActive && (
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
                  {(["drawer", "change", "close"] as Tab[]).map((t) => {
                    const labels: Record<Tab, string> = {
                      drawer: "Drawer",
                      change: "Make Change",
                      close: "Close Drawer",
                    };
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                          tab === t
                            ? "bg-slate-900 text-white"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Drawer tab */}
              {tab === "drawer" && activeSession && (
                <div className="space-y-4">
                  {activeSession.openingCount && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                          Opening Count
                        </h3>
                        {activeSession.openedBy && (
                          <span className="text-xs text-slate-400">
                            by {activeSession.openedBy}
                          </span>
                        )}
                      </div>
                      <div className="px-5 py-4">
                        <DenominationGrid
                          counts={activeSession.openingCount}
                          onChange={() => {}}
                          readOnly
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="px-5 py-3 border-b border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                        Log Transaction
                      </h3>
                    </div>
                    <div className="px-5 py-4">
                      <TransactionEntry
                        session={activeSession}
                        onTransactionLogged={handleTransactionLogged}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="px-5 py-3 border-b border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                        Today&apos;s Transactions
                      </h3>
                    </div>
                    <div className="px-5 py-3">
                      <TransactionLog
                        session={activeSession}
                        transactions={transactions}
                        onTransactionVoided={handleTransactionVoided}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Make Change tab */}
              {tab === "change" && activeSession && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                      Change Calculator
                    </h3>
                  </div>
                  <div className="px-5 py-4">
                    <ChangeCalculator
                      session={activeSession}
                      settings={settings}
                      onTransactionLogged={handleTransactionLogged}
                    />
                  </div>
                </div>
              )}

              {/* Close Drawer tab */}
              {tab === "close" && activeSession && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                      Close Drawer
                    </h3>
                  </div>
                  <div className="px-5 py-4">
                    <ReconciliationView
                      session={activeSession}
                      transactions={transactions}
                      settings={settings}
                      onClosed={handleClosed}
                    />
                  </div>
                </div>
              )}

              {/* Closed session view */}
              {isClosed && activeSession && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
                  <p className="text-sm text-slate-500 mb-2">Final Result</p>
                  <p
                    className={`font-mono text-4xl font-bold ${
                      activeSession.discrepancy === 0
                        ? "text-green-600"
                        : activeSession.discrepancy! < 0
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                  >
                    {activeSession.discrepancy === 0
                      ? "Balanced"
                      : activeSession.discrepancy! < 0
                      ? `Short ${centsToDisplay(Math.abs(activeSession.discrepancy!))}`
                      : `Over ${centsToDisplay(activeSession.discrepancy!)}`}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Session closed. Report saved in History.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="mt-4 px-6 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Reprint Report
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Sticky footer — running total */}
        {isActive && activeSession && (
          <footer className="no-print h-14 bg-slate-900 flex items-center justify-between px-6 border-t border-slate-800 flex-shrink-0">
            <span className="text-slate-400 text-sm font-medium">Current Total</span>
            <CurrencyDisplay
              cents={activeSession.currentTotal}
              size="3xl"
              className="text-white font-bold"
            />
          </footer>
        )}
      </div>
    </AccessGate>
  );
}
