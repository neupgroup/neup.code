"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BRIDGE_STORAGE_EVENT,
  loadBridgeRuns,
  loadBridges,
  type BridgeItem,
} from "../../bridge/bridge-storage";
import {
  loadWorkspacePageBlocks,
  WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT,
  type WorkspacePageBlock,
  type WorkspacePageBlockKind,
} from "../../page-blocks-storage";
import {
  loadWorkspaces,
  WORKSPACE_STORAGE_EVENT,
  type WorkspaceItem,
} from "../../workspace/workspace-storage";

type SyncWorkspace = {
  id: string;
  name: string;
  permit: string;
  description: string;
  sharedWith: string[];
  isHidden?: boolean;
  isDefault?: boolean;
  createdAt: string;
};

type SyncPage = {
  id: string;
  workspaceId: string;
  title: string;
  icon: string | null;
  cover: string | null;
  createdAt: string;
};

type SyncBlock = {
  id: string;
  pageId: string;
  kind: WorkspacePageBlockKind | "api" | "webhook" | "grpc";
  content: string;
  position: number;
  createdAt: string;
};

type SyncBridge = {
  id: string;
  workspaceId: string;
  name: string;
  bridgeType: string;
  endpoint: string;
  environment: string;
  method: string | null;
  apiConfig?: unknown;
  requiredFields?: unknown;
  serviceName?: string | null;
  secret?: string | null;
  isPrivateInternal?: boolean;
  privateNote?: string | null;
  publicNote?: string | null;
  notes?: string | null;
  createdAt: string;
};

type ComparableSnapshot = {
  workspaces: SyncWorkspace[];
  pages: SyncPage[];
  blocks: SyncBlock[];
  bridges: SyncBridge[];
};

type BrowserSnapshot = ComparableSnapshot & {
  generatedAt: string;
  warning: string | null;
  raw: {
    workspaces: WorkspaceItem[];
    bridges: BridgeItem[];
    pageBlocks: WorkspacePageBlock[];
    bridgeRuns: ReturnType<typeof loadBridgeRuns>;
  };
};

type DatabaseResponse = {
  ok: true;
  accountId: string;
  workspaces: Array<{
    id: string;
    accountId: string;
    name: string;
    permit: string;
    description: string;
    sharedWith: string[];
    isHidden: boolean;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  pages: Array<{
    id: string;
    workspaceId: string;
    title: string;
    icon: string | null;
    cover: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  blocks: Array<{
    id: string;
    pageId: string;
    kind: string;
    content: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  }>;
  bridges: Array<{
    id: string;
    workspaceId: string;
    name: string;
    bridgeType: string;
    endpoint: string;
    environment: string;
    method: string | null;
    apiConfig?: unknown;
    requiredFields?: unknown;
    serviceName?: string | null;
    secret?: string | null;
    isPrivateInternal: boolean;
    privateNote?: string | null;
    publicNote?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type DatabaseSnapshotState =
  | {
      status: "idle" | "loading";
      fetchedAt: string | null;
      accountId: string | null;
      error: string | null;
      raw: unknown;
      snapshot: ComparableSnapshot | null;
    }
  | {
      status: "ready";
      fetchedAt: string;
      accountId: string;
      error: null;
      raw: DatabaseResponse;
      snapshot: ComparableSnapshot;
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
} satisfies Record<keyof ComparableSnapshot, string>;

function getDefaultWorkspaceId(workspaces: WorkspaceItem[]) {
  return workspaces.find((ws) => ws.isDefault)?.id ?? workspaces[0]?.id ?? null;
}

function getBlockKindForBridge(item: BridgeItem): "api" | "webhook" | "grpc" {
  if (item.bridgeType === "webhook") return "webhook";
  if (item.bridgeType === "grpc") return "grpc";
  return "api";
}

function isSystemBridgePageId(id: string) {
  return id === "sys-bridge" || id.startsWith("sys-bridge-");
}

function buildBrowserSnapshot(): BrowserSnapshot {
  const workspaces = loadWorkspaces();
  const bridges = loadBridges();
  const pageBlocks = loadWorkspacePageBlocks();
  const bridgeRuns = loadBridgeRuns();
  const generatedAt = new Date().toISOString();
  const defaultWorkspaceId = getDefaultWorkspaceId(workspaces);

  const comparable: ComparableSnapshot = {
    workspaces: workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      permit: "owner",
      description: ws.description ?? "",
      sharedWith: ws.sharedWith ?? [],
      isHidden: Boolean(ws.isHidden),
      isDefault: Boolean(ws.isDefault),
      createdAt: ws.createdAt ?? generatedAt,
    })),
    pages: [],
    blocks: [],
    bridges: [],
  };

  let warning: string | null = null;

  if (!defaultWorkspaceId) {
    warning = "No workspace profile is saved in this browser, so the sync payload cannot be derived yet.";
  } else {
    const pages: SyncPage[] = bridges
      .filter((item) => (item.entryKind ?? "bridge") === "chapter")
      .map((item) => ({
        id: item.id,
        workspaceId: item.workspaceId ?? defaultWorkspaceId,
        title: item.name || "Untitled page",
        icon: null,
        cover: null,
        createdAt: item.createdAt ?? generatedAt,
      }));

    const rootPageId = `sys-bridge-${defaultWorkspaceId}`;
    pages.push({
      id: rootPageId,
      workspaceId: defaultWorkspaceId,
      title: "Bridge",
      icon: null,
      cover: null,
      createdAt: "0",
    });

    const blocks: SyncBlock[] = [];
    const childrenByPage = new Map<string, BridgeItem[]>();
    for (const item of bridges) {
      if (!item.parentChapterId) continue;
      const list = childrenByPage.get(item.parentChapterId) ?? [];
      list.push(item);
      childrenByPage.set(item.parentChapterId, list);
    }

    for (const page of pages) {
      if (isSystemBridgePageId(page.id)) continue;
      const pageChildren = childrenByPage.get(page.id) ?? [];
      pageChildren.forEach((item, index) => {
        const entryKind = item.entryKind ?? "bridge";
        const kind: SyncBlock["kind"] =
          entryKind === "note" ||
          entryKind === "heading1" ||
          entryKind === "heading2" ||
          entryKind === "heading3"
            ? entryKind
            : entryKind === "chapter"
              ? "chapter"
              : getBlockKindForBridge(item);

        const content =
          kind === "note" || kind === "heading1" || kind === "heading2" || kind === "heading3"
            ? item.publicNote ?? item.notes ?? ""
            : item.id;

        blocks.push({
          id: item.id,
          pageId: page.id,
          kind,
          content,
          position: index,
          createdAt: item.createdAt ?? generatedAt,
        });
      });
    }

    pageBlocks
      .filter((block) => block.pageKey === "bridge")
      .forEach((block, index) => {
        blocks.push({
          id: block.id,
          pageId: rootPageId,
          kind: block.kind,
          content: block.content,
          position: index,
          createdAt: block.createdAt ?? generatedAt,
        });
      });

    comparable.pages = pages;
    comparable.blocks = blocks;
    comparable.bridges = bridges
      .filter((item) => (item.entryKind ?? "bridge") === "bridge")
      .map((item) => ({
        id: item.id,
        workspaceId: item.workspaceId ?? defaultWorkspaceId,
        name: item.name || "",
        bridgeType: item.bridgeType,
        endpoint: item.endpoint ?? "",
        environment: item.environment ?? "development",
        method: item.method ?? null,
        apiConfig: item.apiConfig,
        requiredFields: item.requiredFields,
        serviceName: item.serviceName ?? null,
        secret: item.secret ?? null,
        isPrivateInternal: Boolean(item.isPrivateInternal),
        privateNote: item.privateNote ?? null,
        publicNote: item.publicNote ?? null,
        notes: item.notes ?? null,
        createdAt: item.createdAt ?? generatedAt,
      }));
  }

  return {
    generatedAt,
    warning,
    raw: {
      workspaces,
      bridges,
      pageBlocks,
      bridgeRuns,
    },
    ...comparable,
  };
}

function normalizeDatabaseResponse(data: DatabaseResponse): ComparableSnapshot {
  return {
    workspaces: data.workspaces.map((item) => ({
      id: item.id,
      name: item.name,
      permit: item.permit,
      description: item.description,
      sharedWith: item.sharedWith,
      isHidden: item.isHidden,
      isDefault: item.isDefault,
      createdAt: item.createdAt,
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
      kind: item.kind as SyncBlock["kind"],
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
  };
}

function isDatabaseResponse(value: unknown): value is DatabaseResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<DatabaseResponse>;
  return (
    candidate.ok === true &&
    typeof candidate.accountId === "string" &&
    Array.isArray(candidate.workspaces) &&
    Array.isArray(candidate.pages) &&
    Array.isArray(candidate.blocks) &&
    Array.isArray(candidate.bridges)
  );
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
    const response = await fetch("/api/state", {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const data = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Request failed with status ${response.status}.`;

      return {
        status: "error",
        fetchedAt,
        accountId: null,
        error: message,
        raw: data,
        snapshot: null,
      };
    }

    if (!isDatabaseResponse(data)) {
      return {
        status: "error",
        fetchedAt,
        accountId: null,
        error: "The database snapshot response was not in the expected format.",
        raw: data,
        snapshot: null,
      };
    }

    return {
      status: "ready",
      fetchedAt,
      accountId: data.accountId,
      error: null,
      raw: data,
      snapshot: normalizeDatabaseResponse(data),
    };
  } catch (error) {
    return {
      status: "error",
      fetchedAt,
      accountId: null,
      error: error instanceof Error ? error.message : "Failed to load the database snapshot.",
      raw: null,
      snapshot: null,
    };
  }
}

export function SyncStatView() {
  const [browserSnapshot, setBrowserSnapshot] = useState<BrowserSnapshot>(() => buildBrowserSnapshot());
  const [databaseSnapshot, setDatabaseSnapshot] = useState<DatabaseSnapshotState>({
    status: "idle",
    fetchedAt: null,
    accountId: null,
    error: null,
    raw: null,
    snapshot: null,
  });

  useEffect(() => {
    function refreshBrowserSnapshot() {
      setBrowserSnapshot(buildBrowserSnapshot());
    }

    window.addEventListener(WORKSPACE_STORAGE_EVENT, refreshBrowserSnapshot);
    window.addEventListener(BRIDGE_STORAGE_EVENT, refreshBrowserSnapshot);
    window.addEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, refreshBrowserSnapshot);
    window.addEventListener("storage", refreshBrowserSnapshot);

    return () => {
      window.removeEventListener(WORKSPACE_STORAGE_EVENT, refreshBrowserSnapshot);
      window.removeEventListener(BRIDGE_STORAGE_EVENT, refreshBrowserSnapshot);
      window.removeEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, refreshBrowserSnapshot);
      window.removeEventListener("storage", refreshBrowserSnapshot);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshDatabaseSnapshot() {
      setDatabaseSnapshot((current) => ({
        status: "loading",
        fetchedAt: current.fetchedAt,
        accountId: current.accountId,
        error: null,
        raw: current.raw,
        snapshot: current.snapshot,
      }));

      const nextSnapshot = await loadDatabaseSnapshot();
      if (!cancelled) {
        setDatabaseSnapshot(nextSnapshot);
      }
    }

    void refreshDatabaseSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh() {
    setBrowserSnapshot(buildBrowserSnapshot());
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

  const diffCollections: DiffCollection[] = databaseSnapshot.snapshot
    ? [
        compareCollections(COLLECTION_LABELS.workspaces, browserSnapshot.workspaces, databaseSnapshot.snapshot.workspaces),
        compareCollections(COLLECTION_LABELS.pages, browserSnapshot.pages, databaseSnapshot.snapshot.pages),
        compareCollections(COLLECTION_LABELS.blocks, browserSnapshot.blocks, databaseSnapshot.snapshot.blocks),
        compareCollections(COLLECTION_LABELS.bridges, browserSnapshot.bridges, databaseSnapshot.snapshot.bridges),
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
              Inspect the workspace data still stored in this browser and compare it with the
              current snapshot returned from the database through <code>/api/state</code>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleRefresh()}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-[0.86rem] font-semibold text-foreground transition hover:border-foreground/20"
        >
          {databaseSnapshot.status === "loading" ? "Refreshing..." : "Refresh snapshots"}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-border bg-background p-5">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Browser
          </p>
          <div className="mt-3 grid gap-2 text-[0.88rem]">
            <p>Workspaces: <span className="font-semibold text-foreground">{browserSnapshot.workspaces.length}</span></p>
            <p>Pages: <span className="font-semibold text-foreground">{browserSnapshot.pages.length}</span></p>
            <p>Blocks: <span className="font-semibold text-foreground">{browserSnapshot.blocks.length}</span></p>
            <p>Bridges: <span className="font-semibold text-foreground">{browserSnapshot.bridges.length}</span></p>
            <p className="text-muted-foreground">
              Generated from browser storage: {formatTimestamp(browserSnapshot.generatedAt)}
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
            <p className="text-muted-foreground">
              Last fetch: {formatTimestamp(databaseSnapshot.fetchedAt)}
            </p>
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
              Browser-only storage not synced to the DB: {Object.keys(browserSnapshot.raw.bridgeRuns).length} bridge run record{Object.keys(browserSnapshot.raw.bridgeRuns).length === 1 ? "" : "s"}.
            </p>
            {browserSnapshot.warning ? (
              <p className="text-amber-700">{browserSnapshot.warning}</p>
            ) : null}
            {databaseSnapshot.error ? (
              <p className="text-rose-600">{databaseSnapshot.error}</p>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[0.98rem] font-semibold text-foreground">{collection.label}</h2>
                <p className="mt-1 text-[0.82rem] text-muted-foreground">
                  Browser {collection.browserCount} · Database {collection.databaseCount}
                </p>
              </div>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <SnapshotPanel
          title="Browser source stores"
          subtitle="Directly loaded from localStorage in this browser."
          data={browserSnapshot.raw}
        />
        <SnapshotPanel
          title="Browser sync payload"
          subtitle="Derived snapshot that this browser would sync upstream."
          data={{
            generatedAt: browserSnapshot.generatedAt,
            warning: browserSnapshot.warning,
            workspaces: browserSnapshot.workspaces,
            pages: browserSnapshot.pages,
            blocks: browserSnapshot.blocks,
            bridges: browserSnapshot.bridges,
          }}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SnapshotPanel
          title="Database sync snapshot"
          subtitle="Normalized comparison view from /api/state."
          data={{
            fetchedAt: databaseSnapshot.fetchedAt,
            accountId: databaseSnapshot.accountId,
            snapshot: databaseSnapshot.snapshot,
          }}
        />
        <SnapshotPanel
          title="Raw database response"
          subtitle="Unmodified response body returned by /api/state."
          data={databaseSnapshot.raw}
        />
      </div>
    </section>
  );
}
