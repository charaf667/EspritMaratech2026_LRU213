/**
 * Outbox sync manager: processes pending mutations and syncs them to the API.
 */

import { apiFetch } from "./api";
import {
  getPendingOutbox,
  updateOutboxEntry,
  removeOutboxEntry,
  type OutboxEntry,
} from "./offline-db";

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

type SyncEventType = "sync-start" | "sync-item" | "sync-done" | "sync-error";

type SyncListener = (event: { type: SyncEventType; entry?: OutboxEntry; total?: number; synced?: number }) => void;

const listeners: Set<SyncListener> = new Set();

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: { type: SyncEventType; entry?: OutboxEntry; total?: number; synced?: number }) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

let syncing = false;

export async function processOutbox(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;

  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pending = await getPendingOutbox();
    if (pending.length === 0) {
      syncing = false;
      return { synced: 0, failed: 0 };
    }

    emit({ type: "sync-start", total: pending.length });

    for (const entry of pending) {
      await updateOutboxEntry(entry.id, { status: "sending" });

      let success = false;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Inject client_id into body for idempotency (LWW)
          let body = entry.body;
          if (entry.clientId && body) {
            try {
              const parsed = JSON.parse(body);
              parsed.client_id = entry.clientId;
              body = JSON.stringify(parsed);
            } catch {
              // body is not JSON — send as-is
            }
          }

          const { error, status } = await apiFetch(entry.url, {
            method: entry.method,
            body,
          });

          if (!error || (status >= 200 && status < 300)) {
            success = true;
            break;
          }

          // 409 Conflict = server already has a newer version (LWW: server wins)
          // Treat as success — discard local mutation
          if (status === 409) {
            success = true;
            break;
          }

          // Session expired — stop syncing entirely, user must re-login
          if (status === 401 || status === 403) {
            await updateOutboxEntry(entry.id, {
              status: "pending",
              error: "Session expired",
              retries: entry.retries,
            });
            failedCount++;
            window.dispatchEvent(new CustomEvent("omnia-session-expired"));
            return { synced: syncedCount, failed: failedCount };
          }

          // 4xx errors (except 429) should not be retried
          if (status >= 400 && status < 500 && status !== 429) {
            await updateOutboxEntry(entry.id, {
              status: "failed",
              error: error || `HTTP ${status}`,
              retries: entry.retries + attempt + 1,
            });
            failedCount++;
            emit({ type: "sync-error", entry: { ...entry, error: error || `HTTP ${status}` } });
            break;
          }

          // Wait with exponential backoff before retry
          await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt)));
        } catch {
          if (attempt === MAX_RETRIES - 1) {
            await updateOutboxEntry(entry.id, {
              status: "failed",
              error: "Network error after retries",
              retries: entry.retries + MAX_RETRIES,
            });
            failedCount++;
          }
          await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt)));
        }
      }

      if (success) {
        await removeOutboxEntry(entry.id);
        syncedCount++;
        emit({ type: "sync-item", entry, synced: syncedCount, total: pending.length });
      }
    }

    emit({ type: "sync-done", synced: syncedCount, total: pending.length });
  } finally {
    syncing = false;
  }

  return { synced: syncedCount, failed: failedCount };
}
