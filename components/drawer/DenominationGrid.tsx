"use client";

import { useRef, useCallback } from "react";
import { BILL_DENOMINATIONS, COIN_DENOMINATIONS } from "@/lib/denominations";
import { centsToDisplay } from "@/lib/money";
import type { DenominationCount } from "@/types";

interface DenominationGridProps {
  counts: DenominationCount;
  onChange: (counts: DenominationCount) => void;
  readOnly?: boolean;
  highlightNonZero?: boolean;
}

interface DenominationRowProps {
  denomKey: string;
  label: string;
  value: number; // cents per unit
  quantity: number;
  onChange: (key: string, qty: number) => void;
  readOnly: boolean;
  highlightNonZero: boolean;
  inputRef?: React.RefCallback<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function DenominationRow({
  denomKey,
  label,
  value,
  quantity,
  onChange,
  readOnly,
  highlightNonZero,
  inputRef,
  onKeyDown,
}: DenominationRowProps) {
  const subtotal = quantity * value;
  const hasValue = quantity > 0;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const qty = raw === "" ? 0 : Math.min(parseInt(raw, 10), 9999);
    onChange(denomKey, qty);
  }

  function handleArrow(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onChange(denomKey, quantity + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onChange(denomKey, Math.max(0, quantity - 1));
    }
    onKeyDown?.(e);
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
        highlightNonZero && hasValue
          ? "bg-blue-50"
          : "hover:bg-slate-50"
      }`}
    >
      {/* Denomination label */}
      <div className="w-16 text-right">
        <span className="font-mono text-lg font-semibold text-slate-800">
          {label}
        </span>
      </div>

      {/* × symbol */}
      <span className="text-slate-400 text-sm select-none">×</span>

      {/* Quantity input */}
      <div className="w-24">
        {readOnly ? (
          <span className="font-mono text-lg font-semibold text-slate-900 block text-center">
            {quantity}
          </span>
        ) : (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantity === 0 ? "" : quantity.toString()}
            onChange={handleChange}
            onKeyDown={handleArrow}
            placeholder="0"
            className="w-full text-center font-mono text-lg font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        )}
      </div>

      {/* = symbol */}
      <span className="text-slate-400 text-sm select-none">=</span>

      {/* Subtotal */}
      <div className="flex-1 text-right">
        <span
          className={`font-mono text-lg tabular-nums ${
            hasValue ? "text-slate-900 font-semibold" : "text-slate-400"
          }`}
        >
          {centsToDisplay(subtotal)}
        </span>
      </div>
    </div>
  );
}

export function DenominationGrid({
  counts,
  onChange,
  readOnly = false,
  highlightNonZero = false,
}: DenominationGridProps) {
  // Track all input refs for tab navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const allDenoms = [...BILL_DENOMINATIONS, ...COIN_DENOMINATIONS];

  const handleChange = useCallback(
    (key: string, qty: number) => {
      onChange({ ...counts, [key]: qty });
    },
    [counts, onChange]
  );

  const handleKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = inputRefs.current[index + 1];
        if (next) next.focus();
      }
    },
    []
  );

  // Totals
  const billTotal = BILL_DENOMINATIONS.reduce(
    (sum, d) => sum + (counts[d.key] || 0) * d.value,
    0
  );
  const coinTotal = COIN_DENOMINATIONS.reduce(
    (sum, d) => sum + (counts[d.key] || 0) * d.value,
    0
  );
  const grandTotal = billTotal + coinTotal;

  return (
    <div className="space-y-1">
      {/* Bills section */}
      <div className="mb-1">
        <div className="px-4 py-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Bills
          </span>
        </div>
        {BILL_DENOMINATIONS.map((d, i) => (
          <DenominationRow
            key={d.key}
            denomKey={d.key}
            label={d.label}
            value={d.value}
            quantity={counts[d.key] || 0}
            onChange={handleChange}
            readOnly={readOnly}
            highlightNonZero={highlightNonZero}
            inputRef={(el) => {
              inputRefs.current[i] = el;
            }}
            onKeyDown={handleKeyDown(i)}
          />
        ))}
        {/* Bill subtotal */}
        {billTotal > 0 && (
          <div className="flex items-center justify-end px-4 py-1">
            <span className="text-sm text-slate-500 mr-2">Bills subtotal:</span>
            <span className="font-mono text-sm font-semibold text-slate-700">
              {centsToDisplay(billTotal)}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 mx-4" />

      {/* Coins section */}
      <div className="mt-1">
        <div className="px-4 py-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Coins
          </span>
        </div>
        {COIN_DENOMINATIONS.map((d, i) => {
          const globalIndex = BILL_DENOMINATIONS.length + i;
          return (
            <DenominationRow
              key={d.key}
              denomKey={d.key}
              label={d.label}
              value={d.value}
              quantity={counts[d.key] || 0}
              onChange={handleChange}
              readOnly={readOnly}
              highlightNonZero={highlightNonZero}
              inputRef={(el) => {
                inputRefs.current[globalIndex] = el;
              }}
              onKeyDown={handleKeyDown(globalIndex)}
            />
          );
        })}
        {/* Coin subtotal */}
        {coinTotal > 0 && (
          <div className="flex items-center justify-end px-4 py-1">
            <span className="text-sm text-slate-500 mr-2">Coins subtotal:</span>
            <span className="font-mono text-sm font-semibold text-slate-700">
              {centsToDisplay(coinTotal)}
            </span>
          </div>
        )}
      </div>

      {/* Grand total */}
      <div className="border-t-2 border-slate-300 mx-4 mt-2 pt-3">
        <div className="flex items-center justify-between px-4">
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            Total
          </span>
          <span className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {centsToDisplay(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
