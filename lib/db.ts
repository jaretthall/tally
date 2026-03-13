import { openDB, type IDBPDatabase } from "idb";
import type { DrawerSession, TallySettings, Transaction } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const DB_NAME = "tally-db";
const DB_VERSION = 1;

export interface TallyDBSchema {
  sessions: {
    key: string;
    value: DrawerSession;
    indexes: {
      "by-date": string;
      "by-status": string;
    };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      "by-session": string;
      "by-date": string;
    };
  };
  settings: {
    key: string;
    value: { key: string; data: TallySettings };
  };
}

let dbPromise: Promise<IDBPDatabase<TallyDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<TallyDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TallyDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Sessions store
        if (!db.objectStoreNames.contains("sessions")) {
          const sessionStore = db.createObjectStore("sessions", {
            keyPath: "id",
          });
          sessionStore.createIndex("by-date", "date");
          sessionStore.createIndex("by-status", "status");
        }

        // Transactions store
        if (!db.objectStoreNames.contains("transactions")) {
          const txStore = db.createObjectStore("transactions", {
            keyPath: "id",
          });
          txStore.createIndex("by-session", "sessionId");
          txStore.createIndex("by-date", "createdAt");
        }

        // Settings store
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export async function saveSession(session: DrawerSession): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

export async function getSession(id: string): Promise<DrawerSession | undefined> {
  const db = await getDB();
  return db.get("sessions", id);
}

export async function getAllSessions(): Promise<DrawerSession[]> {
  const db = await getDB();
  const all = await db.getAll("sessions");
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getSessionsByDate(date: string): Promise<DrawerSession[]> {
  const db = await getDB();
  return db.getAllFromIndex("sessions", "by-date", date);
}

export async function getOpenSessions(): Promise<DrawerSession[]> {
  const db = await getDB();
  return db.getAllFromIndex("sessions", "by-status", "open");
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function saveTransaction(tx: Transaction): Promise<void> {
  const db = await getDB();
  await db.put("transactions", tx);
}

export async function getTransactionsBySession(
  sessionId: string
): Promise<Transaction[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("transactions", "by-session", sessionId);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const db = await getDB();
  return db.get("transactions", id);
}

// ─── Settings ────────────────────────────────────────────────────────────────

const SETTINGS_KEY = "app-settings";

export async function getSettings(): Promise<TallySettings> {
  const db = await getDB();
  const record = await db.get("settings", SETTINGS_KEY);
  return record ? record.data : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: TallySettings): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: SETTINGS_KEY, data: settings });
}

// ─── Export / Clear ──────────────────────────────────────────────────────────

export async function exportAllData(): Promise<{
  sessions: DrawerSession[];
  transactions: Transaction[];
  exportedAt: string;
}> {
  const db = await getDB();
  const sessions = await db.getAll("sessions");
  const transactions = await db.getAll("transactions");
  return {
    sessions,
    transactions,
    exportedAt: new Date().toISOString(),
  };
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear("sessions");
  await db.clear("transactions");
  // Keep settings — don't wipe drawer label and staff names
}
