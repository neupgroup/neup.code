"use client";

import { useEffect, useRef } from "react";
import {
  applySyncSnapshotToBrowser,
  buildBrowserSyncPayload,
  bufferedPayloadToSyncSnapshot,
  clearBufferedSyncPayload,
  clearPersistentBrowserStores,
  hasAnyBrowserUserData,
  loadBufferedSyncPayload,
  saveBufferedSyncPayload,
} from "@/services/browser-sync";
import { SyncApiError, flushSyncSnapshot, loadSyncSnapshot } from "@/services/sync-client";
import { BRIDGE_STORAGE_EVENT } from "./bridge/bridge-storage";
import { PINNED_PAGES_STORAGE_EVENT } from "./pinned-pages-storage";
import { WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT } from "./page-blocks-storage";
import { WORKSPACE_STORAGE_EVENT } from "./workspace/workspace-storage";

const FLUSH_DELAY_MS = 5000;

export function StateSync() {
  const flushTimeoutRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryAtRef = useRef<number>(0);
  const suppressBufferRef = useRef(false);
  const flushInFlightRef = useRef(false);
  const flushAgainRef = useRef(false);

  function bufferLatestState() {
    if (typeof window === "undefined") return;
    if (suppressBufferRef.current) return;

    const payload = buildBrowserSyncPayload();
    if (!payload) return;
    saveBufferedSyncPayload(payload);
  }

  async function flushNow() {
    if (typeof window === "undefined") return;

    const now = Date.now();
    if (retryAtRef.current && now < retryAtRef.current) {
      const delay = retryAtRef.current - now;
      if (!retryTimeoutRef.current) {
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          void flushNow();
        }, delay);
      }
      return;
    }

    if (flushInFlightRef.current) {
      flushAgainRef.current = true;
      return;
    }

    const payload = loadBufferedSyncPayload();
    if (!payload) return;

    flushInFlightRef.current = true;
    try {
      await flushSyncSnapshot(payload);
      clearBufferedSyncPayload();
      clearPersistentBrowserStores();
      retryAtRef.current = 0;
    } catch (error) {
      if (error instanceof SyncApiError && error.status === 401) {
        retryAtRef.current = Date.now() + 5 * 60_000;
      } else {
        retryAtRef.current = Date.now() + 30_000;
      }
    } finally {
      flushInFlightRef.current = false;
      if (flushAgainRef.current) {
        flushAgainRef.current = false;
        void flushNow();
      }
    }
  }

  function scheduleFlush() {
    if (typeof window === "undefined") return;

    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (flushTimeoutRef.current) {
      window.clearTimeout(flushTimeoutRef.current);
    }

    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null;
      void flushNow();
    }, FLUSH_DELAY_MS);
  }

  function handleLocalChange() {
    if (suppressBufferRef.current) return;
    bufferLatestState();
    scheduleFlush();
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (typeof window === "undefined") return;

      const bufferedPayload = loadBufferedSyncPayload();

      try {
        const snapshot = await loadSyncSnapshot();
        if (cancelled) return;

        suppressBufferRef.current = true;
        applySyncSnapshotToBrowser(snapshot);
        if (bufferedPayload) {
          applySyncSnapshotToBrowser(bufferedPayloadToSyncSnapshot(bufferedPayload));
        }
        suppressBufferRef.current = false;

        if (bufferedPayload) {
          scheduleFlush();
        }
        return;
      } catch (error) {
        if (error instanceof SyncApiError && error.status === 401) {
          return;
        }
      }

      if (bufferedPayload) {
        suppressBufferRef.current = true;
        applySyncSnapshotToBrowser(bufferedPayloadToSyncSnapshot(bufferedPayload));
        suppressBufferRef.current = false;
        scheduleFlush();
        return;
      }

      if (hasAnyBrowserUserData()) {
        bufferLatestState();
        scheduleFlush();
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void flushNow();
      }
    }

    function onOnline() {
      retryAtRef.current = 0;
      void flushNow();
    }

    window.addEventListener(WORKSPACE_STORAGE_EVENT, handleLocalChange);
    window.addEventListener(BRIDGE_STORAGE_EVENT, handleLocalChange);
    window.addEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, handleLocalChange);
    window.addEventListener(PINNED_PAGES_STORAGE_EVENT, handleLocalChange);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener(WORKSPACE_STORAGE_EVENT, handleLocalChange);
      window.removeEventListener(BRIDGE_STORAGE_EVENT, handleLocalChange);
      window.removeEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, handleLocalChange);
      window.removeEventListener(PINNED_PAGES_STORAGE_EVENT, handleLocalChange);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);

      if (flushTimeoutRef.current) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }

      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  return null;
}
