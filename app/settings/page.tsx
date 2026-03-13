"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings, clearAllData } from "@/lib/db";
import { downloadExport } from "@/lib/export";
import { centsToDisplay, displayToCents } from "@/lib/money";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DRAWER_LABEL_OPTIONS, DEFAULT_SETTINGS } from "@/types";
import type { TallySettings } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<TallySettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newCopayInput, setNewCopayInput] = useState("");
  const [clearConfirm1, setClearConfirm1] = useState(false);
  const [clearConfirm2, setClearConfirm2] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!settings) return;
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateSettings(patch: Partial<TallySettings>) {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function addStaffName() {
    const name = newStaffName.trim();
    if (!name || !settings) return;
    if (settings.staffNames.includes(name)) return;
    updateSettings({ staffNames: [...settings.staffNames, name] });
    setNewStaffName("");
  }

  function removeStaffName(name: string) {
    if (!settings) return;
    updateSettings({ staffNames: settings.staffNames.filter((n) => n !== name) });
  }

  function addCopay() {
    const cents = displayToCents(newCopayInput);
    if (!cents || !settings) return;
    if (settings.commonCopays.includes(cents)) return;
    const sorted = [...settings.commonCopays, cents].sort((a, b) => a - b);
    updateSettings({ commonCopays: sorted });
    setNewCopayInput("");
  }

  function removeCopay(cents: number) {
    if (!settings) return;
    updateSettings({ commonCopays: settings.commonCopays.filter((c) => c !== cents) });
  }

  async function handleExport() {
    await downloadExport();
  }

  async function handleClearData() {
    await clearAllData();
    setClearConfirm2(false);
    alert("All session data cleared. Settings preserved.");
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Settings are saved to this browser only
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            ← Back to Drawer
          </a>
        </div>

        {/* Drawer Label */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Drawer Label</h2>
          <p className="text-sm text-slate-500">
            Identifies this workstation on printed reports.
          </p>
          <div className="space-y-2">
            <select
              value={settings.drawerLabel}
              onChange={(e) => updateSettings({ drawerLabel: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Choose a drawer —</option>
              {DRAWER_LABEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              Or type a custom label:
            </p>
            <input
              type="text"
              value={settings.drawerLabel}
              onChange={(e) => updateSettings({ drawerLabel: e.target.value })}
              placeholder="e.g. Centro Check-in 1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Staff Names */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Staff Members</h2>
          <p className="text-sm text-slate-500">
            Names available in the open/close dropdown. Staff select their name when starting or ending a session.
          </p>

          {/* Current staff */}
          {settings.staffNames.length > 0 ? (
            <div className="space-y-1">
              {settings.staffNames.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg"
                >
                  <span className="text-sm text-slate-800 font-medium">{name}</span>
                  <button
                    type="button"
                    onClick={() => removeStaffName(name)}
                    className="text-slate-400 hover:text-red-500 transition-colors text-xs px-2 py-0.5 rounded hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              No staff added yet. Add names below.
            </p>
          )}

          {/* Add new staff */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStaffName()}
              placeholder="Full name"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addStaffName}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Common Copays */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Common Copay Amounts</h2>
          <p className="text-sm text-slate-500">
            Quick-select buttons shown in the Change Calculator.
          </p>

          <div className="flex flex-wrap gap-2">
            {settings.commonCopays.map((cents) => (
              <div
                key={cents}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                <span className="font-mono text-sm font-semibold text-slate-800">
                  {centsToDisplay(cents)}
                </span>
                <button
                  type="button"
                  onClick={() => removeCopay(cents)}
                  className="text-slate-400 hover:text-red-500 transition-colors text-xs leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={newCopayInput}
              onChange={(e) => setNewCopayInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCopay()}
              placeholder="e.g. 35.00"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addCopay}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Opening Target (reference only) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Default Opening Balance</h2>
          <p className="text-sm text-slate-500">
            Reference amount for the standard starting balance. Not enforced — just shown as context.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={(settings.defaultOpeningTarget / 100).toFixed(2)}
              onChange={(e) =>
                updateSettings({
                  defaultOpeningTarget: displayToCents(e.target.value),
                })
              }
              className="w-32 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          className={`w-full py-3 px-4 font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            saved
              ? "bg-green-600 text-white focus:ring-green-500"
              : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
          }`}
        >
          {saved ? "✓ Settings Saved" : "Save Settings"}
        </button>

        {/* Data management */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Data Management</h2>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="w-full py-2.5 px-4 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors text-left"
            >
              Export History as JSON
              <span className="block text-xs text-slate-400 font-normal mt-0.5">
                Downloads all sessions and transactions as a backup file
              </span>
            </button>

            <button
              type="button"
              onClick={() => setClearConfirm1(true)}
              className="w-full py-2.5 px-4 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors text-left border border-red-100"
            >
              Clear All Session Data
              <span className="block text-xs text-red-400 font-normal mt-0.5">
                Permanently erases all sessions and transactions. Settings are kept.
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* First confirmation */}
      <ConfirmDialog
        open={clearConfirm1}
        onOpenChange={setClearConfirm1}
        title="Clear all data?"
        description="This will permanently delete all session history and transactions on this machine. Printed reports are not affected. This cannot be undone."
        confirmLabel="Yes, I understand — continue"
        destructive
        onConfirm={() => {
          setClearConfirm1(false);
          setClearConfirm2(true);
        }}
      />

      {/* Second confirmation */}
      <ConfirmDialog
        open={clearConfirm2}
        onOpenChange={setClearConfirm2}
        title="Are you absolutely sure?"
        description="All data on this machine will be gone. The printed reports in the cash bag are your only backup."
        confirmLabel="Yes, delete everything"
        destructive
        onConfirm={handleClearData}
      />
    </div>
  );
}
