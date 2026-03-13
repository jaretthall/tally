"use client";

import { centsToDisplay } from "@/lib/money";
import { getDenomByKey, DENOMINATIONS } from "@/lib/denominations";
import type { DrawerSession, Transaction } from "@/types";

interface PrintableReportProps {
  session: DrawerSession;
  transactions: Transaction[];
  drawerLabel: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const TYPE_LABELS: Record<string, string> = {
  copay: "Copay",
  payment: "Payment",
  cash_drop: "Cash Drop",
  petty_cash: "Petty Cash",
  cash_loan: "Cash Loan",
  adjustment: "Adjustment",
};

export function PrintableReport({ session, transactions, drawerLabel }: PrintableReportProps) {
  const activeTransactions = transactions.filter((t) => !t.voided);
  const voidedTransactions = transactions.filter((t) => t.voided);
  const netTransactions = activeTransactions.reduce((sum, t) => sum + t.netAmount, 0);

  function renderDenomCount(counts: Record<string, number> | null) {
    if (!counts) return null;
    return (
      <div className="space-y-0.5">
        {DENOMINATIONS.map((d) => {
          const qty = counts[d.key] ?? 0;
          if (qty === 0) return null;
          return (
            <div key={d.key} className="flex justify-between text-sm">
              <span>
                {d.label} × {qty}
              </span>
              <span className="font-mono">{centsToDisplay(qty * d.value)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      id="print-root"
      className="print-only bg-white text-black"
      style={{
        fontFamily: "monospace",
        fontSize: "11pt",
        lineHeight: "1.4",
        padding: "0",
        maxWidth: "100%",
      }}
    >
      {/* Header */}
      <div className="text-center mb-4 border-b-2 border-black pb-3">
        <h1 className="text-xl font-bold">TALLY — Daily Cash Drawer Report</h1>
        <p className="text-base font-semibold mt-1">{drawerLabel}</p>
        <p className="text-sm">{formatDate(session.date)}</p>
        <p className="text-sm">
          Opened: {formatDateTime(session.openedAt)} &nbsp;|&nbsp; Closed: {formatDateTime(session.closedAt)}
        </p>
        {(session.openedBy || session.closedBy) && (
          <p className="text-sm">
            {session.openedBy ? `Opened by: ${session.openedBy}` : ""}
            {session.openedBy && session.closedBy ? "  |  " : ""}
            {session.closedBy ? `Closed by: ${session.closedBy}` : ""}
          </p>
        )}
      </div>

      {/* Opening Count */}
      <div className="mb-4">
        <h2 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">
          Opening Count
        </h2>
        {renderDenomCount(session.openingCount)}
        <div className="flex justify-between font-bold mt-2 border-t border-black pt-1">
          <span>OPENING TOTAL</span>
          <span className="font-mono">{centsToDisplay(session.openingTotal ?? 0)}</span>
        </div>
      </div>

      {/* Transactions */}
      <div className="mb-4">
        <h2 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">
          Transactions
        </h2>
        {activeTransactions.length === 0 ? (
          <p className="text-sm italic">No transactions</p>
        ) : (
          <div className="space-y-0.5">
            {activeTransactions.map((tx) => (
              <div key={tx.id} className="flex justify-between text-sm">
                <span>
                  {new Date(tx.createdAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}{" "}
                  {TYPE_LABELS[tx.type] ?? tx.type} — {tx.description}
                </span>
                <span className="font-mono">
                  {tx.netAmount >= 0 ? "+" : ""}
                  {centsToDisplay(tx.netAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
        {voidedTransactions.length > 0 && (
          <p className="text-xs italic mt-1">
            {voidedTransactions.length} voided transaction(s) not shown
          </p>
        )}
        <div className="flex justify-between font-bold mt-2 border-t border-black pt-1">
          <span>NET TRANSACTIONS</span>
          <span className="font-mono">
            {netTransactions >= 0 ? "+" : ""}
            {centsToDisplay(netTransactions)}
          </span>
        </div>
      </div>

      {/* Closing Count */}
      <div className="mb-4">
        <h2 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">
          Closing Count
        </h2>
        {renderDenomCount(session.closingCount)}
        <div className="flex justify-between font-bold mt-2 border-t border-black pt-1">
          <span>CLOSING TOTAL</span>
          <span className="font-mono">{centsToDisplay(session.closingTotal ?? 0)}</span>
        </div>
      </div>

      {/* Reconciliation */}
      <div className="mb-4 border-2 border-black p-3">
        <h2 className="font-bold text-sm uppercase mb-2">Reconciliation</h2>
        <div className="flex justify-between text-sm">
          <span>Expected:</span>
          <span className="font-mono">{centsToDisplay(session.expectedTotal ?? 0)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Counted:</span>
          <span className="font-mono">{centsToDisplay(session.closingTotal ?? 0)}</span>
        </div>
        <div className="flex justify-between font-bold mt-1 pt-1 border-t border-black">
          <span>Status:</span>
          <span>
            {session.discrepancy === 0
              ? "✓ BALANCED"
              : session.discrepancy! < 0
              ? `SHORT ${centsToDisplay(Math.abs(session.discrepancy!))}`
              : `OVER ${centsToDisplay(session.discrepancy!)}`}
          </span>
        </div>
        {session.notes && (
          <div className="mt-2 pt-2 border-t border-black">
            <p className="text-sm">
              <span className="font-bold">Notes:</span> {session.notes}
            </p>
          </div>
        )}
      </div>

      {/* Signature lines */}
      <div className="mt-6 space-y-4">
        <div className="flex gap-8">
          <div className="flex-1">
            <div className="border-b border-black pb-1 mb-1" style={{ minHeight: "24px" }}></div>
            <p className="text-xs">Counted by</p>
          </div>
          <div className="w-32">
            <div className="border-b border-black pb-1 mb-1" style={{ minHeight: "24px" }}></div>
            <p className="text-xs">Date</p>
          </div>
        </div>
        <div className="flex gap-8">
          <div className="flex-1">
            <div className="border-b border-black pb-1 mb-1" style={{ minHeight: "24px" }}></div>
            <p className="text-xs">Verified by</p>
          </div>
          <div className="w-32">
            <div className="border-b border-black pb-1 mb-1" style={{ minHeight: "24px" }}></div>
            <p className="text-xs">Date</p>
          </div>
        </div>
      </div>

      <div className="text-center text-xs mt-6 border-t border-black pt-2 text-slate-500">
        Generated by Tally — {new Date().toLocaleString()}
      </div>
    </div>
  );
}
