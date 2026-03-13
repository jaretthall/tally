"use client";

import { useEffect, useState } from "react";
import { getAllSessions, getTransactionsBySession } from "@/lib/db";
import { centsToDisplay } from "@/lib/money";
import { PrintableReport } from "@/components/reports/PrintableReport";
import { getSettings } from "@/lib/db";
import type { DrawerSession, Transaction, TallySettings } from "@/types";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<DrawerSession[]>([]);
  const [settings, setSettings] = useState<TallySettings | null>(null);
  const [selectedSession, setSelectedSession] = useState<DrawerSession | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [all, sett] = await Promise.all([getAllSessions(), getSettings()]);
      setSessions(all.filter((s) => s.status === "closed"));
      setSettings(sett);
      setLoading(false);
    }
    load();
  }, []);

  async function handleViewSession(session: DrawerSession) {
    const txs = await getTransactionsBySession(session.id);
    setSelectedSession(session);
    setSelectedTransactions(txs);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Print area */}
      {selectedSession && settings && (
        <PrintableReport
          session={selectedSession}
          transactions={selectedTransactions}
          drawerLabel={settings.drawerLabel || "Cash Drawer"}
        />
      )}

      <div className="no-print max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">History</h1>
            <p className="text-sm text-slate-500 mt-0.5">Past sessions on this machine</p>
          </div>
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            ← Back to Drawer
          </a>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">No closed sessions yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => {
                const disc = s.discrepancy ?? 0;
                const isSelected = selectedSession?.id === s.id;
                return (
                  <div key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleViewSession(s)}
                      className={`w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDate(s.date)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.openedBy ? `Opened by ${s.openedBy}` : ""}
                          {s.openedBy && s.closedBy ? " · " : ""}
                          {s.closedBy ? `Closed by ${s.closedBy}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-slate-500">Closing</p>
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            {centsToDisplay(s.closingTotal ?? 0)}
                          </p>
                        </div>
                        <div
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            disc === 0
                              ? "bg-green-100 text-green-800"
                              : disc < 0
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {disc === 0
                            ? "Balanced"
                            : disc < 0
                            ? `Short ${centsToDisplay(Math.abs(disc))}`
                            : `Over ${centsToDisplay(disc)}`}
                        </div>
                      </div>
                    </button>

                    {/* Expanded report view */}
                    {isSelected && (
                      <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-3">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-slate-500">Opening</p>
                            <p className="font-mono font-semibold text-slate-900">
                              {centsToDisplay(s.openingTotal ?? 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Expected</p>
                            <p className="font-mono font-semibold text-slate-900">
                              {centsToDisplay(s.expectedTotal ?? 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Counted</p>
                            <p className="font-mono font-semibold text-slate-900">
                              {centsToDisplay(s.closingTotal ?? 0)}
                            </p>
                          </div>
                        </div>
                        {s.notes && (
                          <p className="text-sm text-slate-600 italic">
                            Note: {s.notes}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="w-full py-2 px-4 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          Print Report
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
