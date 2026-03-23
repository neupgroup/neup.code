"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildBrowserSnapshot,
  buildBrowserSyncPayload,
  clearBufferedSyncPayload,
  clearPersistentBrowserStores,
  loadBufferedSyncPayload,
  type BrowserComparableSnapshot,
  type BrowserSnapshot,
  type BrowserSyncPayload,
  BROWSER_SYNC_BUFFER_EVENT,
} from "@/services/browser-sync";
import { SyncApiError, flushSyncSnapshot, loadSyncSnapshot } from "@/services/sync-client";
import { BRIDGE_STORAGE_EVENT } from "../../bridge/bridge-storage";
import { PINNED_PAGES_STORAGE_EVENT } from "../../pinned-pages-storage";
import { WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT } from "../../page-blocks-storage";
import { WORKSPACE_STORAGE_EVENT } from "../../workspace/workspace-storage";

type DatabaseSnapshotState =
  | {
      status: "idle" | "loading";
      fetchedAt: string | null;
      accountId: string | null;
      error: string | null;
      raw: unknown;
      snapshot: BrowserComparableSnapshot | null;
    }
  | {
      status: "ready";
      fetchedAt: string;
      accountId: string;
      error: null;
      raw: Awaited<ReturnType<typeof loadSyncSnapshot>>;
      snapshot: BrowserComparableSnapshot;
    }
  | {
      status: "error";
      fetchedAt: string;
      accountId: string | null;
      error: string;
      raw: unknown;
      snapshot: null;
    };

type DiffCollection = {
  label: string;
  browserCount: number;
  databaseCount: number;
  browserOnly: string[];
  databaseOnly: string[];
  changed: string[];
};

const COLLECTION_LABELS = {
  workspaces: "Workspaces",
  pages: "Pages",
  blocks: "Blocks",
  bridges: "Bridges",
  pinnedPages: "Pinned Pages",
} satisfies Record<keyof BrowserComparableSnapshot, string>;

function normalizeDatabaseResponse(data: Awaited<ReturnType<typeof loadSyncSnapshot>>): BrowserComparableSnapshot {
  return {
    workspaces: data.workspaces.map((item) => ({
      id: item.id,
      permit: item.permit,
    })),
    pages: data.pages.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      title: item.title,
      icon: item.icon,
      cover: item.cover,
      createdAt: item.createdAt,
    })),
    blocks: data.blocks.map((item) => ({
      id: item.id,
      pageId: item.pageId,
      type: item.type as BrowserComparableSnapshot["blocks"][number]["type"],
      content: item.content,
      position: item.position,
      createdAt: item.createdAt,
    })),
    bridges: data.bridges.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      name: item.name,
      bridgeType: item.bridgeType,
      endpoint: item.endpoint,
      environment: item.environment,
      method: item.method,
      apiConfig: item.apiConfig,
      requiredFields: item.requiredFields,
      serviceName: item.serviceName ?? null,
      secret: item.secret ?? null,
      isPrivateInternal: item.isPrivateInternal,
      privateNote: item.privateNote ?? null,
      publicNote: item.publicNote ?? null,
      notes: item.notes ?? null,
      createdAt: item.createdAt,
    })),
    pinnedPages: data.pinnedPages.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      pageIds: item.pageIds,
      orderBy: item.orderBy as BrowserComparableSnapshot["pinnedPages"][number]["orderBy"],
    })),
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function compareCollections<T extends { id: string }>(
  label: string,
  browserItems: T[],
  databaseItems: T[],
): DiffCollection {
  const browserMap = new Map(browserItems.map((item) => [item.id, item]));
  const databaseMap = new Map(databaseItems.map((item) => [item.id, item]));

  const browserOnly = browserItems
    .filter((item) => !databaseMap.has(item.id))
    .map((item) => item.id);
  const databaseOnly = databaseItems
    .filter((item) => !browserMap.has(item.id))
    .map((item) => item.id);
  const changed = browserItems
    .filter((item) => {
      const serverItem = databaseMap.get(item.id);
      return serverItem ? stableSerialize(item) !== stableSerialize(serverItem) : false;
    })
    .map((item) => item.id);

  return {
    label,
    browserCount: browserItems.length,
    databaseCount: databaseItems.length,
    browserOnly,
    databaseOnly,
    changed,
  };
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not loaded yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderIdList(ids: string[]) {
  if (!ids.length) {
    return <p className="text-[0.82rem] text-muted-foreground">None</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <code
          key={id}
          className="rounded-md border border-border bg-muted px-2 py-1 text-[0.75rem] text-foreground"
        >
          {id}
        </code>
      ))}
    </div>
  );
}

function SnapshotPanel({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: unknown;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-[0.96rem] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[0.82rem] text-muted-foreground">{subtitle}</p>
      </div>
      <pre className="max-h-[480px] overflow-auto p-5 text-[0.77rem] leading-[1.6] text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

async function loadDatabaseSnapshot(): Promise<DatabaseSnapshotState> {
  const fetchedAt = new Date().toISOString();

  try {
    const data = await loadSyncSnapshot();
    return {
      status: "ready",
      fetchedAt,
      accountId: data.accountId,
      error: null,
      raw: data,
      snapshot: normalizeDatabaseResponse(data),
    };
  } catch (error) {
    const message =
      error instanceof SyncApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load the database snapshot.";
    return {
      status: "error",
      fetchedAt,
      accountId: null,
      error: message,
      raw: error instanceof SyncApiError ? error.data : null,
      snapshot: null,
    };
  }
}

export function SyncStatView() {
  const [browserSnapshot, setBrowserSnapshot] = useState<BrowserSnapshot>(() => buildBrowserSnapshot());
  const [bufferedPayload, setBufferedPayload] = useState<BrowserSyncPayload | null>(() => loadBufferedSyncPayload());
  const [databaseSnapshot, setDatabaseSnapshot] = useState<DatabaseSnapshotState>({
    status: "idle",
    fetchedAt: null,
    accountId: null,
    error: null,
    raw: null,
    snapshot: null,
  });
  const [pushState, setPushState] = useState<{
    status: "idle" | "pushing" | "success" | "error";
    message: string | null;
  }>({
    status: "idle",
    message: null,
  });

  useEffect(() => {
    function refreshBrowserState() {
      setBrowserSnapshot(buildBrowserSnapshot());
      setBufferedPayload(loadBufferedSyncPayload());
    }

    window.addEventListener(WORKSPACE_STORAGE_EVENT, refreshBrowserState);
    window.addEventListener(BRIDGE_STORAGE_EVENT, refreshBrowserState);
    window.addEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, refreshBrowserState);
    window.addEventListener(PINNED_PAGES_STORAGE_EVENT, refreshBrowserState);
    window.addEventListener(BROWSER_SYNC_BUFFER_EVENT, refreshBrowserState);
    window.addEventListener("storage", refreshBrowserState);

    return () => {
      window.removeEventListener(WORKSPACE_STORAGE_EVENT, refreshBrowserState);
      window.removeEventListener(BRIDGE_STORAGE_EVENT, refreshBrowserState);
      window.removeEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, refreshBrowserState);
      window.removeEventListener(PINNED_PAGES_STORAGE_EVENT, refreshBrowserState);
      window.removeEventListener(BROWSER_SYNC_BUFFER_EVENT, refreshBrowserState);
      window.removeEventListener("storage", refreshBrowserState);
    };
  }, []);

  async function refreshDatabaseSnapshot() {
    setDatabaseSnapshot((current) => ({
      status: "loading",
      fetchedAt: current.fetchedAt,
      accountId: current.accountId,
      error: null,
      raw: current.raw,
      snapshot: current.snapshot,
    }));
    setDatabaseSnapshot(await loadDatabaseSnapshot());
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      const nextSnapshot = await loadDatabaseSnapshot();
      if (!cancelled) {
        setDatabaseSnapshot(nextSnapshot);
      }
    }

    void initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh() {
    setBrowserSnapshot(buildBrowserSnapshot());
    setBufferedPayload(loadBufferedSyncPayload());
    await refreshDatabaseSnapshot();
  }

  async function handleEmergencyPush() {
    const payload = bufferedPayload ?? buildBrowserSyncPayload();
    if (!payload) {
      setPushState({
        status: "error",
        message: "No browser changes are available to push right now.",
      });
      return;
    }

    setPushState({
      status: "pushing",
      message: "Pushing browser changes to the database...",
    });

    try {
      await flushSyncSnapshot(payload);
      clearBufferedSyncPayload();
      clearPersistentBrowserStores();
      setPushState({
        status: "success",
        message: "Browser changes were pushed to the database.",
      });
      await handleRefresh();
    } catch (error) {
      const message =
        error instanceof SyncApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to push browser changes to the database.";
      setPushState({
        status: "error",
        message,
      });
    }
  }

  const diffCollections: DiffCollection[] = databaseSnapshot.snapshot
    ? [
        compareCollections(COLLECTION_LABELS.workspaces, browserSnapshot.workspaces, databaseSnapshot.snapshot.workspaces),
        compareCollections(COLLECTION_LABELS.pages, browserSnapshot.pages, databaseSnapshot.snapshot.pages),
        compareCollections(COLLECTION_LABELS.blocks, browserSnapshot.blocks, databaseSnapshot.snapshot.blocks),
        compareCollections(COLLECTION_LABELS.bridges, browserSnapshot.bridges, databaseSnapshot.snapshot.bridges),
        compareCollections(COLLECTION_LABELS.pinnedPages, browserSnapshot.pinnedPages, databaseSnapshot.snapshot.pinnedPages),
      ]
    : [];

  const totalDifferences = diffCollections.reduce(
    (sum, item) => sum + item.browserOnly.length + item.databaseOnly.length + item.changed.length,
    0,
  );

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
          >
            <span aria-hidden="true">&lt;</span>
            <span>Settings</span>
          </Link>
          <div className="space-y-2">
            <p className="text-[0.76rem] font-semibold text-muted-foreground">Settings</p>
            <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
              Sync Status
            </h1>
            <p className="max-w-3xl text-[0.9rem] leading-[1.5] text-muted-foreground">
              Inspect the live browser cache, the pending offline sync buffer, and the current
              database snapshot. The push action is only here as an emergency manual sync.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleEmergencyPush()}
            disabled={pushState.status === "pushing"}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-[0.86rem] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pushState.status === "pushing" ? "Pushing..." : "Push changes to database"}
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-[0.86rem] font-semibold text-foreground transition hover:border-foreground/20"
          >
            {databaseSnapshot.status === "loading" ? "Refreshing..." : "Refresh snapshots"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <section className="rounded-2xl border border-border bg-background p-5">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Browser Cache
          </p>
          <div className="mt-3 grid gap-2 text-[0.88rem]">
            <p>Workspaces: <span className="font-semibold text-foreground">{browserSnapshot.workspaces.length}</span></p>
            <p>Pages: <span className="font-semibold text-foreground">{browserSnapshot.pages.length}</span></p>
            <p>Blocks: <span className="font-semibold text-foreground">{browserSnapshot.blocks.length}</span></p>
            <p>Bridges: <span className="font-semibold text-foreground">{browserSnapshot.bridges.length}</span></p>
            <p>Pinned configs: <span className="font-semibold text-foreground">{browserSnapshot.pinnedPages.length}</span></p>
            <p className="text-muted-foreground">Generated: {formatTimestamp(browserSnapshot.generatedAt)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Offline Buffer
          </p>
          <div className="mt-3 grid gap-2 text-[0.88rem]">
            <p>
              Status:{" "}
              <span className="font-semibold text-foreground">
                {bufferedPayload ? "Pending browser changes" : "Empty"}
              </span>
            </p>
            <p className="text-muted-foreground">
              Buffered at: {formatTimestamp(bufferedPayload?.bufferedAt ?? null)}
            </p>
            <p className="text-muted-foreground">
              This persistent browser copy only exists for unsynced edits and offline recovery.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Database
          </p>
          <div className="mt-3 grid gap-2 text-[0.88rem]">
            <p>Workspaces: <span className="font-semibold text-foreground">{databaseSnapshot.snapshot?.workspaces.length ?? 0}</span></p>
            <p>Pages: <span className="font-semibold text-foreground">{databaseSnapshot.snapshot?.pages.length ?? 0}</span></p>
            <p>Blocks: <span className="font-semibold text-foreground">{databaseSnapshot.snapshot?.blocks.length ?? 0}</span></p>
            <p>Bridges: <span className="font-semibold text-foreground">{databaseSnapshot.snapshot?.bridges.length ?? 0}</span></p>
            <p>Pinned configs: <span className="font-semibold text-foreground">{databaseSnapshot.snapshot?.pinnedPages.length ?? 0}</span></p>
            <p className="text-muted-foreground">Last fetch: {formatTimestamp(databaseSnapshot.fetchedAt)}</p>
            {databaseSnapshot.accountId ? (
              <p className="text-muted-foreground">Account: {databaseSnapshot.accountId}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Difference Summary
          </p>
          <div className="mt-3 grid gap-2 text-[0.88rem]">
            <p>
              Status:{" "}
              <span className="font-semibold text-foreground">
                {databaseSnapshot.status === "ready"
                  ? totalDifferences === 0
                    ? "Browser and database match"
                    : `${totalDifferences} difference${totalDifferences === 1 ? "" : "s"} found`
                  : databaseSnapshot.status === "loading"
                    ? "Loading database snapshot"
                    : databaseSnapshot.status === "error"
                      ? "Database snapshot unavailable"
                      : "Waiting to load"}
              </span>
            </p>
            <p className="text-muted-foreground">
              Browser-only bridge run history: {Object.keys(browserSnapshot.raw.bridgeRuns).length} record{Object.keys(browserSnapshot.raw.bridgeRuns).length === 1 ? "" : "s"}.
            </p>
            {browserSnapshot.warning ? (
              <p className="text-amber-700">{browserSnapshot.warning}</p>
            ) : null}
            {databaseSnapshot.error ? (
              <p className="text-rose-600">{databaseSnapshot.error}</p>
            ) : null}
            {pushState.message ? (
              <p
                className={
                  pushState.status === "error"
                    ? "text-rose-600"
                    : pushState.status === "success"
                      ? "text-emerald-700"
                      : "text-muted-foreground"
                }
              >
                {pushState.message}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {diffCollections.map((collection) => (
          <section
            key={collection.label}
            className="rounded-2xl border border-border bg-background p-5"
          >
            <div>
              <h2 className="text-[0.98rem] font-semibold text-foreground">{collection.label}</h2>
              <p className="mt-1 text-[0.82rem] text-muted-foreground">
                Browser {collection.browserCount} · Database {collection.databaseCount}
              </p>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <p className="mb-2 text-[0.8rem] font-semibold text-muted-foreground">Only in browser</p>
                {renderIdList(collection.browserOnly)}
              </div>
              <div>
                <p className="mb-2 text-[0.8rem] font-semibold text-muted-foreground">Only in database</p>
                {renderIdList(collection.databaseOnly)}
              </div>
              <div>
                <p className="mb-2 text-[0.8rem] font-semibold text-muted-foreground">Changed</p>
                {renderIdList(collection.changed)}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SnapshotPanel
          title="Browser source stores"
          subtitle="Current in-session browser cache used by the app."
          data={browserSnapshot.raw}
        />
        <SnapshotPanel
          title="Pending offline buffer"
          subtitle="Persistent browser payload kept only until it reaches the database."
          data={bufferedPayload}
        />
        <SnapshotPanel
          title="Browser sync payload"
          subtitle="Derived payload the browser would push upstream right now."
          data={buildBrowserSyncPayload()}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SnapshotPanel
          title="Database sync snapshot"
          subtitle="Normalized comparison view aggregated from the split sync endpoints."
          data={{
            fetchedAt: databaseSnapshot.fetchedAt,
            accountId: databaseSnapshot.accountId,
            snapshot: databaseSnapshot.snapshot,
          }}
        />
        <SnapshotPanel
          title="Raw database response"
          subtitle="Combined response shape assembled from the split sync endpoints."
          data={databaseSnapshot.raw}
        />
      </div>
    </section>
  );
}
