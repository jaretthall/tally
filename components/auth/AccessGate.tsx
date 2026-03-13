"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE ?? "1234";
const COOKIE_NAME = "tally-access";

function getMidnightExpiry(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function checkCookie(): boolean {
  if (typeof document === "undefined") return false;
  const cookies = document.cookie.split(";");
  return cookies.some((c) => c.trim().startsWith(`${COOKIE_NAME}=valid`));
}

function setCookie(): void {
  const expires = getMidnightExpiry().toUTCString();
  document.cookie = `${COOKIE_NAME}=valid; expires=${expires}; path=/; SameSite=Strict`;
}

interface AccessGateProps {
  children: React.ReactNode;
}

export function AccessGate({ children }: AccessGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkCookie()) {
      setAuthenticated(true);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code === ACCESS_CODE) {
      setCookie();
      setAuthenticated(true);
    } else {
      setError(true);
      setShake(true);
      setCode("");
      setTimeout(() => {
        setShake(false);
        inputRef.current?.focus();
      }, 600);
    }
  }

  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            Tally
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Cash Drawer Manager</p>
        </div>

        {/* Access code card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="access-code"
                className="block text-sm font-medium text-slate-700"
              >
                Access Code
              </label>
              <input
                ref={inputRef}
                id="access-code"
                type="password"
                inputMode="numeric"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                placeholder="Enter code"
                className={cn(
                  "w-full text-center font-mono text-2xl tracking-widest px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all",
                  error
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200",
                  shake && "animate-bounce"
                )}
                autoComplete="off"
              />
              {error && (
                <p className="text-sm text-red-600 text-center">
                  Incorrect code. Try again.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Enter
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Session expires at midnight
        </p>
      </div>
    </div>
  );
}
