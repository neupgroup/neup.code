import type { SyncSnapshot } from "@/services/sync-types";
import {
  BRIDGE_STORAGE_KEY,
  loadBridgeRuns,
  loadBridges,
  saveBridges,
  type BridgeItem,
} from "@/app/bridge/bridge-storage";
import {
  loadPinnedPages,
  savePinnedPages,
  type PinnedPagesOrderBy,
  type WorkspacePinnedPages,
} from "@/app/pinned-pages-storage";
import {
  loadWorkspacePageBlocks,
  loadWorkspacePageBlocksFor,
  saveWorkspacePageBlocks,
  WORKSPACE_PAGE_BLOCKS_STORAGE_KEY,
  type WorkspacePageBlock,
  type WorkspacePageBlockKind,
} from "@/app/page-blocks-storage";
import {
  loadWorkspaces,
  saveWorkspaces,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceItem,
} from "@/app/workspace/workspace-storage";

export const BROWSER_SYNC_BUFFER_KEY = "neup.code.sync.buffer.v1";
export const BROWSER_SYNC_BUFFER_EVENT = "neup.code.sync.buffer.updated";

type SyncWorkspace = {
  id: string;
  permit: string;
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
  type: WorkspacePageBlockKind | "api" | "webhook" | "grpc";
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

type SyncPinnedPages = {
  id: string;
  workspaceId: string;
  pageIds: string[];
  orderBy: PinnedPagesOrderBy;
};

export type BrowserSyncPayload = {
  version: 3;
  fullSync: boolean;
  bufferedAt: string;
  workspaces: SyncWorkspace[];
  pages: SyncPage[];
  blocks: SyncBlock[];
  bridges: SyncBridge[];
  pinnedPages: SyncPinnedPages[];
};

export type BrowserComparableSnapshot = {
  workspaces: SyncWorkspace[];
  pages: SyncPage[];
  blocks: SyncBlock[];
  bridges: SyncBridge[];
  pinnedPages: SyncPinnedPages[];
};

export type BrowserSnapshot = BrowserComparableSnapshot & {
  generatedAt: string;
  warning: string | null;
  raw: {
    workspaces: WorkspaceItem[];
    bridges: BridgeItem[];
    pageBlocks: WorkspacePageBlock[];
    pinnedPages: WorkspacePinnedPages[];
    bridgeRuns: ReturnType<typeof loadBridgeRuns>;
  };
};

const BRIDGE_ENVIRONMENTS = ["development", "staging", "production"] as const;
const BRIDGE_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const PINNED_PAGES_ORDER_BY_VALUES = [
  "ascending.title",
  "descending.title",
  "ascending.date",
  "descending.date",
  "custom",
] as const;

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isBrowserSyncPayload(value: unknown): value is BrowserSyncPayload {
  if (!isRecord(value)) return false;
  if (value.version !== 3) return false;
  if (typeof value.fullSync !== "boolean") return false;
  if (!Array.isArray(value.workspaces)) return false;
  if (!Array.isArray(value.pages)) return false;
  if (!Array.isArray(value.blocks)) return false;
  if (!Array.isArray(value.bridges)) return false;
  if (!Array.isArray(value.pinnedPages)) return false;
  if (typeof value.bufferedAt !== "string") return false;
  return true;
}

function normalizeBridgeEnvironment(value: string | null | undefined): BridgeItem["environment"] {
  if (value && BRIDGE_ENVIRONMENTS.includes(value as BridgeItem["environment"])) {
    return value as BridgeItem["environment"];
  }

  return "development";
}

function normalizeBridgeMethod(
  value: string | null | undefined,
  fallback?: BridgeItem["method"],
): BridgeItem["method"] {
  if (value && BRIDGE_HTTP_METHODS.includes(value as NonNullable<BridgeItem["method"]>)) {
    return value as BridgeItem["method"];
  }

  return fallback;
}

function normalizePinnedPagesOrderBy(value: string | null | undefined): PinnedPagesOrderBy {
  if (value && PINNED_PAGES_ORDER_BY_VALUES.includes(value as PinnedPagesOrderBy)) {
    return value as PinnedPagesOrderBy;
  }

  return "custom";
}

function getDefaultWorkspaceId(workspaces: WorkspaceItem[]) {
  return workspaces.find((ws) => ws.isDefault)?.id ?? workspaces[0]?.id ?? null;
}

function getBlockTypeForBridge(item: BridgeItem): "api" | "webhook" | "grpc" {
  if (item.bridgeType === "webhook") return "webhook";
  if (item.bridgeType === "grpc") return "grpc";
  return "api";
}

function isSystemBridgePageId(id: string) {
  return id === "sys-bridge" || id.startsWith("sys-bridge-");
}

function toTextEntryName(kind: "note" | "heading1" | "heading2" | "heading3") {
  if (kind === "note") return "Untitled note";
  if (kind === "heading1") return "Heading 1";
  if (kind === "heading2") return "Heading 2";
  return "Heading 3";
}

function buildFallbackWorkspaceName(id: string, index: number) {
  const suffix = id.slice(0, 8) || String(index + 1);
  return `Workspace ${suffix}`;
}

export function buildBrowserSyncPayload(): BrowserSyncPayload | null {
  const workspaces = loadWorkspaces();
  const defaultWorkspaceId = getDefaultWorkspaceId(workspaces);
  if (!defaultWorkspaceId) return null;

  const bridges = loadBridges();
  const bufferedAt = new Date().toISOString();

  const workspacePayload: SyncWorkspace[] = workspaces.map((ws) => ({
    id: ws.id,
    permit: "owner",
  }));

  const pages: SyncPage[] = bridges
    .filter((item) => (item.entryKind ?? "bridge") === "chapter")
    .map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId ?? defaultWorkspaceId,
      title: item.name || "Untitled page",
      icon: null,
      cover: null,
      createdAt: item.createdAt ?? bufferedAt,
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
    const items = childrenByPage.get(page.id) ?? [];
    items.forEach((item, index) => {
      const entryKind = item.entryKind ?? "bridge";
      const type: SyncBlock["type"] =
        entryKind === "note" ||
        entryKind === "heading1" ||
        entryKind === "heading2" ||
        entryKind === "heading3"
          ? entryKind
          : entryKind === "chapter"
            ? "chapter"
            : getBlockTypeForBridge(item);

      const content =
        type === "note" || type === "heading1" || type === "heading2" || type === "heading3"
          ? item.publicNote ?? item.notes ?? ""
          : item.id;

      blocks.push({
        id: item.id,
        pageId: page.id,
        type,
        content,
        position: index,
        createdAt: item.createdAt ?? bufferedAt,
      });
    });
  }

  const rootBlocks = loadWorkspacePageBlocksFor("bridge");
  rootBlocks.forEach((block, index) => {
    blocks.push({
      id: block.id,
      pageId: rootPageId,
      type: block.kind,
      content: block.content,
      position: index,
      createdAt: block.createdAt ?? bufferedAt,
    });
  });

  const bridgeResources: SyncBridge[] = bridges
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
      createdAt: item.createdAt ?? bufferedAt,
    }));

  const pinnedPages: SyncPinnedPages[] = loadPinnedPages()
    .filter((item) => workspaces.some((workspace) => workspace.id === item.workspaceId))
    .map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      pageIds: item.pageIds,
      orderBy: item.orderBy,
    }));

  return {
    version: 3,
    fullSync: true,
    bufferedAt,
    workspaces: workspacePayload,
    pages,
    blocks,
    bridges: bridgeResources,
    pinnedPages,
  };
}

export function hasAnyBrowserUserData() {
  const workspaces = loadWorkspaces();
  const bridges = loadBridges();
  const rootBlocks = loadWorkspacePageBlocksFor("bridge");
  const pinnedPages = loadPinnedPages();
  return workspaces.length > 0 || bridges.length > 0 || rootBlocks.length > 0 || pinnedPages.length > 0;
}

export function loadBufferedSyncPayload(): BrowserSyncPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BROWSER_SYNC_BUFFER_KEY);
  if (!raw) return null;

  const parsed = safeParseJson(raw);
  return isBrowserSyncPayload(parsed) ? parsed : null;
}

export function saveBufferedSyncPayload(payload: BrowserSyncPayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BROWSER_SYNC_BUFFER_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(BROWSER_SYNC_BUFFER_EVENT));
}

export function clearBufferedSyncPayload() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BROWSER_SYNC_BUFFER_KEY);
  window.dispatchEvent(new Event(BROWSER_SYNC_BUFFER_EVENT));
}

export function clearPersistentBrowserStores() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  window.localStorage.removeItem(BRIDGE_STORAGE_KEY);
  window.localStorage.removeItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY);
}

export function applySyncSnapshotToBrowser(snapshot: SyncSnapshot) {
  const existingWorkspaces = new Map(loadWorkspaces().map((workspace) => [workspace.id, workspace]));
  const workspaceItems: WorkspaceItem[] = snapshot.workspaces.map((ws, index) => {
    const existing = existingWorkspaces.get(ws.id);
    return {
      id: ws.id,
      name: existing?.name ?? buildFallbackWorkspaceName(ws.id, index),
      description: existing?.description ?? "",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      sharedWith: existing?.sharedWith ?? [],
      isHidden: existing?.isHidden ?? false,
      isDefault: existing?.isDefault ?? index === 0,
    };
  });

  if (workspaceItems.length && !workspaceItems.some((workspace) => workspace.isDefault)) {
    workspaceItems[0] = { ...workspaceItems[0], isDefault: true };
  }
  saveWorkspaces(workspaceItems);

  const rootPage = snapshot.pages.find((page) => isSystemBridgePageId(page.id));
  if (rootPage) {
    const rootBlocks = snapshot.blocks
      .filter((block) => block.pageId === rootPage.id)
      .sort((a, b) => a.position - b.position)
      .map((block) => ({
        id: block.id,
        pageKey: "bridge",
        kind: block.type as WorkspacePageBlockKind,
        content: block.content ?? "",
        createdAt: block.createdAt ?? "0",
      })) satisfies WorkspacePageBlock[];
    saveWorkspacePageBlocks(rootBlocks);
  }

  const pages = snapshot.pages.filter((page) => !isSystemBridgePageId(page.id));
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const blocksByPage = new Map<string, SyncSnapshot["blocks"]>();
  for (const block of snapshot.blocks) {
    if (!pagesById.has(block.pageId)) continue;
    const list = blocksByPage.get(block.pageId) ?? [];
    list.push(block);
    blocksByPage.set(block.pageId, list);
  }
  for (const [pageId, list] of blocksByPage) {
    list.sort((a, b) => a.position - b.position);
    blocksByPage.set(pageId, list);
  }

  const childPageIds = new Set<string>();
  for (const block of snapshot.blocks) {
    if (block.type === "chapter" && block.content) {
      childPageIds.add(block.content);
    }
  }

  const bridgeById = new Map(snapshot.bridges.map((bridge) => [bridge.id, bridge]));
  const chapterItemsById = new Map<string, BridgeItem>();
  for (const page of pages) {
    chapterItemsById.set(page.id, {
      id: page.id,
      name: page.title || "Untitled page",
      entryKind: "chapter",
      bridgeType: "api",
      endpoint: "",
      environment: "development",
      createdAt: page.createdAt ?? new Date().toISOString(),
      workspaceId: page.workspaceId,
      parentChapterId: null,
      chapterBlockIds: [],
    });
  }

  const parentByChildPage = new Map<string, string>();
  for (const [pageId, list] of blocksByPage) {
    for (const block of list) {
      if (block.type === "chapter" && block.content) {
        parentByChildPage.set(block.content, pageId);
      }
    }
  }
  for (const [pageId, item] of chapterItemsById) {
    item.parentChapterId = parentByChildPage.get(pageId) ?? null;
    chapterItemsById.set(pageId, item);
  }

  const visitedPages = new Set<string>();
  const nextBridges: BridgeItem[] = [];

  function appendPage(pageId: string) {
    if (visitedPages.has(pageId)) return;
    visitedPages.add(pageId);

    const pageItem = chapterItemsById.get(pageId);
    if (!pageItem) return;
    nextBridges.push(pageItem);

    const blocks = blocksByPage.get(pageId) ?? [];
    for (const block of blocks) {
      if (block.type === "chapter" && block.content) {
        appendPage(block.content);
        continue;
      }

      if (
        block.type === "note" ||
        block.type === "heading1" ||
        block.type === "heading2" ||
        block.type === "heading3"
      ) {
        nextBridges.push({
          id: block.id,
          name: toTextEntryName(block.type),
          entryKind: block.type,
          parentChapterId: pageId,
          bridgeType: "api",
          endpoint: "",
          environment: "development",
          createdAt: block.createdAt ?? new Date().toISOString(),
          publicNote: block.content,
        });
        continue;
      }

      if (block.type === "api" || block.type === "webhook" || block.type === "grpc") {
        const bridge = bridgeById.get(block.id);
        nextBridges.push({
          id: block.id,
          name: bridge?.name ?? "",
          entryKind: "bridge",
          parentChapterId: pageId,
          bridgeType: block.type,
          endpoint: bridge?.endpoint ?? "",
          environment: normalizeBridgeEnvironment(bridge?.environment),
          method: normalizeBridgeMethod(bridge?.method, block.type === "api" ? "GET" : undefined),
          apiConfig: bridge?.apiConfig as BridgeItem["apiConfig"] | undefined,
          requiredFields: bridge?.requiredFields as BridgeItem["requiredFields"] | undefined,
          serviceName: bridge?.serviceName ?? undefined,
          secret: bridge?.secret ?? undefined,
          isPrivateInternal: Boolean(bridge?.isPrivateInternal),
          privateNote: bridge?.privateNote ?? undefined,
          publicNote: bridge?.publicNote ?? undefined,
          notes: bridge?.notes ?? undefined,
          createdAt: bridge?.createdAt ?? block.createdAt ?? new Date().toISOString(),
          workspaceId: bridge?.workspaceId ?? pageItem.workspaceId,
        });
      }
    }
  }

  const rootPages = pages
    .filter((page) => !childPageIds.has(page.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const page of rootPages) {
    appendPage(page.id);
  }

  for (const page of pages) {
    appendPage(page.id);
  }

  saveBridges(nextBridges);

  const validPagesByWorkspace = Object.fromEntries(
    snapshot.pages.map((page) => [page.workspaceId, [] as string[]]),
  ) as Record<string, string[]>;
  for (const page of pages) {
    const list = validPagesByWorkspace[page.workspaceId] ?? [];
    list.push(page.id);
    validPagesByWorkspace[page.workspaceId] = list;
  }

  const nextPinnedPages: WorkspacePinnedPages[] = snapshot.pinnedPages
    .filter((item) => snapshot.workspaces.some((workspace) => workspace.id === item.workspaceId))
    .map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      pageIds: item.pageIds.filter((pageId) =>
        (validPagesByWorkspace[item.workspaceId] ?? []).includes(pageId),
      ),
      orderBy: normalizePinnedPagesOrderBy(item.orderBy),
    }));
  savePinnedPages(nextPinnedPages);
}

export function bufferedPayloadToSyncSnapshot(payload: BrowserSyncPayload): SyncSnapshot {
  return {
    ok: true,
    accountId: "local",
    workspaces: payload.workspaces.map((workspace) => ({
      id: workspace.id,
      accountId: "local",
      permit: workspace.permit,
    })),
    pages: payload.pages.map((page) => ({
      id: page.id,
      workspaceId: page.workspaceId,
      title: page.title,
      icon: page.icon,
      cover: page.cover,
      createdAt: page.createdAt,
      updatedAt: page.createdAt,
    })),
    blocks: payload.blocks.map((block) => ({
      id: block.id,
      pageId: block.pageId,
      type: block.type,
      content: block.content,
      position: block.position,
      createdAt: block.createdAt,
      updatedAt: block.createdAt,
    })),
    bridges: payload.bridges.map((bridge) => ({
      id: bridge.id,
      workspaceId: bridge.workspaceId,
      name: bridge.name,
      bridgeType: bridge.bridgeType,
      endpoint: bridge.endpoint,
      environment: bridge.environment,
      method: bridge.method,
      apiConfig: bridge.apiConfig,
      requiredFields: bridge.requiredFields,
      serviceName: bridge.serviceName,
      secret: bridge.secret,
      isPrivateInternal: Boolean(bridge.isPrivateInternal),
      privateNote: bridge.privateNote,
      publicNote: bridge.publicNote,
      notes: bridge.notes,
      createdAt: bridge.createdAt,
      updatedAt: bridge.createdAt,
    })),
    pinnedPages: payload.pinnedPages.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      pageIds: item.pageIds,
      orderBy: item.orderBy,
      createdAt: payload.bufferedAt,
      updatedAt: payload.bufferedAt,
    })),
  };
}

export function buildBrowserSnapshot(): BrowserSnapshot {
  const workspaces = loadWorkspaces();
  const bridges = loadBridges();
  const pageBlocks = loadWorkspacePageBlocks();
  const pinnedPages = loadPinnedPages();
  const bridgeRuns = loadBridgeRuns();
  const generatedAt = new Date().toISOString();
  const payload = buildBrowserSyncPayload();

  return {
    generatedAt,
    warning: payload
      ? null
      : "No workspace profile is saved in this browser, so the sync payload cannot be derived yet.",
    raw: {
      workspaces,
      bridges,
      pageBlocks,
      pinnedPages,
      bridgeRuns,
    },
    workspaces: payload?.workspaces ?? workspaces.map((workspace) => ({ id: workspace.id, permit: "owner" })),
    pages: payload?.pages ?? [],
    blocks: payload?.blocks ?? [],
    bridges: payload?.bridges ?? [],
    pinnedPages: payload?.pinnedPages ?? pinnedPages,
  };
}
