"use client";

import { centsToDisplay } from "@/lib/money";
import type { DrawerSession } from "@/types";

interface StatusBannerProps {
  session: DrawerSession | null;
}

export function StatusBanner({ session }: StatusBannerProps) {
  if (!session) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span className="text-sm text-slate-600 font-medium">No active session</span>
      </div>
    );
  }

  if (session.status === "open") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-green-800 font-medium">
          Open —{" "}
          <span className="font-mono font-bold">
            {centsToDisplay(session.currentTotal)}
          </span>
        </span>
      </div>
    );
  }

  if (session.status === "counting") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-sm text-amber-800 font-medium">Counting in progress...</span>
      </div>
    );
  }

  if (session.status === "closed") {
    const disc = session.discrepancy;
    if (disc === null) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-sm text-slate-600 font-medium">Closed</span>
        </div>
      );
    }
    if (disc === 0) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-green-800 font-medium">Balanced — $0.00 discrepancy</span>
        </div>
      );
    }
    if (disc < 0) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-red-800 font-medium">
            Short —{" "}
            <span className="font-mono font-bold">
              {centsToDisplay(Math.abs(disc))}
            </span>
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-sm text-amber-800 font-medium">
          Over —{" "}
          <span className="font-mono font-bold">{centsToDisplay(disc)}</span>
        </span>
      </div>
    );
  }

  return null;
}
