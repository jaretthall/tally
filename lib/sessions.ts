import { v4 as uuidv4 } from "uuid";
import {
  getOpenSessions,
  getSessionsByDate,
  saveSession,
} from "./db";
import { emptyDenominationCount } from "./denominations";
import type { DrawerSession, SessionState } from "@/types";

export function getTodayDateString(): string {
  // Returns "YYYY-MM-DD" in local time
  return new Date().toLocaleDateString("en-CA");
}

export async function detectSessionState(): Promise<SessionState> {
  const today = getTodayDateString();

  // Check for any open session
  const openSessions = await getOpenSessions();
  const openSession = openSessions[0]; // Only 0 or 1 should exist

  if (openSession) {
    if (openSession.date === today) {
      return { state: "open_today", session: openSession };
    } else {
      return { state: "stale_open", session: openSession };
    }
  }

  // Check for closed sessions today — but allow starting a new one (shift handoff)
  const todaySessions = await getSessionsByDate(today);
  const closedToday = todaySessions
    .filter((s) => s.status === "closed")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))[0];

  if (closedToday) {
    return { state: "closed_today", session: closedToday, canStartNew: true };
  }

  return { state: "no_session" };
}

export async function createSession(openedBy: string | null): Promise<DrawerSession> {
  const today = getTodayDateString();
  const session: DrawerSession = {
    id: uuidv4(),
    date: today,
    status: "open",

    openingCount: null,
    openingTotal: null,
    openedAt: null,
    openedBy,

    currentDenominations: emptyDenominationCount(),
    currentTotal: 0,

    closingCount: null,
    closingTotal: null,
    closedAt: null,
    closedBy: null,

    expectedTotal: null,
    discrepancy: null,
    notes: null,
  };
  await saveSession(session);
  return session;
}

// Lock the opening count into the session. Returns updated session.
export async function submitOpeningCount(
  session: DrawerSession,
  count: Record<string, number>,
  total: number
): Promise<DrawerSession> {
  const updated: DrawerSession = {
    ...session,
    openingCount: count,
    openingTotal: total,
    openedAt: new Date().toISOString(),
    currentDenominations: { ...count },
    currentTotal: total,
  };
  await saveSession(updated);
  return updated;
}

// Seal the session as closed with reconciliation data.
export async function closeSession(
  session: DrawerSession,
  closingCount: Record<string, number>,
  closingTotal: number,
  expectedTotal: number,
  notes: string | null,
  closedBy: string | null
): Promise<DrawerSession> {
  const updated: DrawerSession = {
    ...session,
    status: "closed",
    closingCount,
    closingTotal,
    closedAt: new Date().toISOString(),
    closedBy,
    expectedTotal,
    discrepancy: closingTotal - expectedTotal,
    notes,
  };
  await saveSession(updated);
  return updated;
}

// Discard a stale session (mark as closed with a note)
export async function discardStaleSession(
  session: DrawerSession
): Promise<DrawerSession> {
  const updated: DrawerSession = {
    ...session,
    status: "closed",
    closedAt: new Date().toISOString(),
    closedBy: null,
    notes: "Discarded — not closed properly at end of day.",
    expectedTotal: session.currentTotal,
    discrepancy: null,
  };
  await saveSession(updated);
  return updated;
}
