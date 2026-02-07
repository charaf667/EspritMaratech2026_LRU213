/**
 * IndexedDB wrapper for offline data cache + mutation outbox.
 * Uses the `idb` library for typed IndexedDB access.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// ─── Schema ────────────────────────────────────────────────

export interface OutboxEntry {
  id: string;
  url: string;
  method: string;
  body: string;
  createdAt: number;
  retries: number;
  status: "pending" | "sending" | "failed";
  error?: string;
  /** Optional client-side UUID for idempotency */
  clientId?: string;
}

interface CachedFamily {
  id: string;
  data: unknown;
  cachedAt: number;
}

interface CachedAidType {
  id: string;
  data: unknown;
  cachedAt: number;
}

interface CachedVisit {
  id: string;
  familyId: string;
  data: unknown;
  cachedAt: number;
}

interface MetaEntry {
  key: string;
  value: unknown;
}

interface OmniaDB extends DBSchema {
  families: {
    key: string;
    value: CachedFamily;
  };
  aid_types: {
    key: string;
    value: CachedAidType;
  };
  visits: {
    key: string;
    value: CachedVisit;
    indexes: { "by-family": string };
  };
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: { "by-status": string };
  };
  meta: {
    key: string;
    value: MetaEntry;
  };
}

const DB_NAME = "omnia-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<OmniaDB>> | null = null;

function getDB(): Promise<IDBPDatabase<OmniaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OmniaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("families")) {
          db.createObjectStore("families", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("aid_types")) {
          db.createObjectStore("aid_types", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("visits")) {
          const visitStore = db.createObjectStore("visits", { keyPath: "id" });
          visitStore.createIndex("by-family", "familyId");
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const outboxStore = db.createObjectStore("outbox", { keyPath: "id" });
          outboxStore.createIndex("by-status", "status");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Families cache ────────────────────────────────────────

export async function cacheFamilies(families: unknown[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("families", "readwrite");
  // Clear old cache and replace
  await tx.store.clear();
  for (const f of families) {
    const item = f as { id: string };
    await tx.store.put({ id: item.id, data: f, cachedAt: Date.now() });
  }
  await tx.done;
}

export async function getCachedFamilies(): Promise<unknown[]> {
  const db = await getDB();
  const all = await db.getAll("families");
  return all.map((entry) => entry.data);
}

// ─── Aid types cache ───────────────────────────────────────

export async function cacheAidTypes(aidTypes: unknown[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("aid_types", "readwrite");
  await tx.store.clear();
  for (const a of aidTypes) {
    const item = a as { id: string };
    await tx.store.put({ id: item.id, data: a, cachedAt: Date.now() });
  }
  await tx.done;
}

export async function getCachedAidTypes(): Promise<unknown[]> {
  const db = await getDB();
  const all = await db.getAll("aid_types");
  return all.map((entry) => entry.data);
}

// ─── Visits cache ─────────────────────────────────────────

export async function cacheVisits(familyId: string, visits: unknown[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("visits", "readwrite");
  // Remove old cached visits for this family, then insert new ones
  const index = tx.store.index("by-family");
  let cursor = await index.openCursor(familyId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  for (const v of visits) {
    const item = v as { id: string };
    await tx.store.put({ id: item.id, familyId, data: v, cachedAt: Date.now() });
  }
  await tx.done;
}

export async function getCachedVisits(familyId: string): Promise<unknown[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("visits", "by-family", familyId);
  return all.map((entry) => entry.data);
}

// ─── Outbox ────────────────────────────────────────────────

export async function addToOutbox(entry: Omit<OutboxEntry, "id" | "createdAt" | "retries" | "status">): Promise<OutboxEntry> {
  const db = await getDB();
  const full: OutboxEntry = {
    ...entry,
    id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    retries: 0,
    status: "pending",
  };
  await db.put("outbox", full);
  return full;
}

export async function getPendingOutbox(): Promise<OutboxEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("outbox", "by-status", "pending");
}

export async function getAllOutbox(): Promise<OutboxEntry[]> {
  const db = await getDB();
  return db.getAll("outbox");
}

export async function updateOutboxEntry(id: string, updates: Partial<OutboxEntry>): Promise<void> {
  const db = await getDB();
  const entry = await db.get("outbox", id);
  if (entry) {
    Object.assign(entry, updates);
    await db.put("outbox", entry);
  }
}

export async function removeOutboxEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("outbox", id);
}

export async function getOutboxCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex("outbox", "by-status", "pending");
}

// ─── Meta ──────────────────────────────────────────────────

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("meta", { key, value });
}

export async function getMeta<T = unknown>(key: string): Promise<T | null> {
  const db = await getDB();
  const entry = await db.get("meta", key);
  return entry ? (entry.value as T) : null;
}

// ─── Clear all stores (used on logout) ────────────────────

export async function clearAllStores(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["families", "aid_types", "visits", "outbox", "meta"], "readwrite");
  await Promise.all([
    tx.objectStore("families").clear(),
    tx.objectStore("aid_types").clear(),
    tx.objectStore("visits").clear(),
    tx.objectStore("outbox").clear(),
    tx.objectStore("meta").clear(),
    tx.done,
  ]);
}
