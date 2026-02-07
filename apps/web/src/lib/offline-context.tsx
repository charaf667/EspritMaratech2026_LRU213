"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { USE_API, apiGetFamilies, apiGetAidTypes } from "./api";
import {
  addToOutbox,
  cacheFamilies,
  cacheAidTypes,
  getOutboxCount,
  setMeta,
  getMeta,
} from "./offline-db";
import { processOutbox, onSyncEvent } from "./sync-manager";

interface OfflineContextValue {
  isOnline: boolean;
  outboxCount: number;
  lastSyncAt: string | null;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  outboxCount: 0,
  lastSyncAt: null,
  syncNow: async () => {},
  isSyncing: false,
});

export function useOffline() {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [outboxCount, setOutboxCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load initial outbox count and last sync
  useEffect(() => {
    getOutboxCount().then(setOutboxCount).catch(() => {});
    getMeta<string>("last_sync_at").then(setLastSyncAt).catch(() => {});
  }, []);

  // Listen to sync events to update outbox count
  useEffect(() => {
    return onSyncEvent(() => {
      getOutboxCount().then(setOutboxCount).catch(() => {});
    });
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && outboxCount > 0) {
      processOutbox().then(({ synced }) => {
        if (synced > 0) {
          const now = new Date().toISOString();
          setLastSyncAt(now);
          setMeta("last_sync_at", now);
        }
        getOutboxCount().then(setOutboxCount).catch(() => {});
      });
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for Service Worker messages (OFFLINE_MUTATION + TRIGGER_SYNC)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_MUTATION") {
        // SW intercepted a failed POST — save to outbox
        await addToOutbox({
          url: new URL(event.data.url).pathname,
          method: event.data.method,
          body: event.data.body,
        });
        const count = await getOutboxCount();
        setOutboxCount(count);
      }
      if (event.data?.type === "TRIGGER_SYNC") {
        // Background sync fired — process outbox
        const { synced } = await processOutbox();
        if (synced > 0) {
          const now = new Date().toISOString();
          setLastSyncAt(now);
          await setMeta("last_sync_at", now);
        }
        const count = await getOutboxCount();
        setOutboxCount(count);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache families + aid types on initial load (when online)
  useEffect(() => {
    if (!USE_API || !isOnline) return;

    apiGetFamilies().then(({ data }) => {
      if (data?.results) {
        cacheFamilies(data.results).catch(() => {});
      }
    });

    apiGetAidTypes().then(({ data }) => {
      if (data) {
        cacheAidTypes(data).catch(() => {});
      }
    });
  }, [isOnline]);

  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const { synced } = await processOutbox();
      if (synced > 0) {
        const now = new Date().toISOString();
        setLastSyncAt(now);
        await setMeta("last_sync_at", now);
      }
      const count = await getOutboxCount();
      setOutboxCount(count);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline]);

  return (
    <OfflineContext.Provider value={{ isOnline, outboxCount, lastSyncAt, syncNow, isSyncing }}>
      {children}
    </OfflineContext.Provider>
  );
}
