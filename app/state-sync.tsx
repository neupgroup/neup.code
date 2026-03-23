"use client";

import { useEffect, useRef } from "react";
import {
  loadWorkspaces,
  saveWorkspaces,
  WORKSPACE_STORAGE_EVENT,
} from "./workspace/workspace-storage";
import { BRIDGE_STORAGE_EVENT, loadBridges, saveBridges } from "./bridge/bridge-storage";
import {
  loadWorkspacePageBlocksFor,
  saveWorkspacePageBlocks,
  WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT,
  type WorkspacePageBlock,
  type WorkspacePageBlockKind,
} from "./page-blocks-storage";
import type { WorkspaceItem } from "./workspace/workspace-storage";
import type { BridgeItem } from "./bridge/bridge-storage";

const VARIABLES_STORAGE_KEY = "neup.code.variables";
const FLUSH_DELAY_MS = 5000;

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

type SyncPayloadV2 = {
  version: 2;
  fullSync: boolean;
  bufferedAt: string;
  workspaces: SyncWorkspace[];
  pages: SyncPage[];
  blocks: SyncBlock[];
  bridges: SyncBridge[];
};

type ServerSnapshot = {
  ok: true;
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

const BRIDGE_ENVIRONMENTS = ["development", "staging", "production"] as const;
const BRIDGE_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

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

function buildPayloadFromLocal(): SyncPayloadV2 | null {
  const workspaces = loadWorkspaces();
  const defaultWorkspaceId = getDefaultWorkspaceId(workspaces);
  if (!defaultWorkspaceId) return null;

  const bridges = loadBridges();
  const bufferedAt = new Date().toISOString();

  const workspacePayload: SyncWorkspace[] = workspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    permit: "owner",
    description: ws.description ?? "",
    sharedWith: ws.sharedWith ?? [],
    isHidden: Boolean(ws.isHidden),
    isDefault: Boolean(ws.isDefault),
    createdAt: ws.createdAt ?? bufferedAt,
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
      const kind: SyncBlock["kind"] =
        entryKind === "note" || entryKind === "heading1" || entryKind === "heading2" || entryKind === "heading3"
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
        createdAt: item.createdAt ?? bufferedAt,
      });
    });
  }

  const rootBlocks = loadWorkspacePageBlocksFor("bridge");
  rootBlocks.forEach((block, index) => {
    blocks.push({
      id: block.id,
      pageId: rootPageId,
      kind: block.kind,
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

  return {
    version: 2,
    fullSync: true,
    bufferedAt,
    workspaces: workspacePayload,
    pages,
    blocks,
    bridges: bridgeResources,
  };
}

function hasAnyUserData() {
  const workspaces = loadWorkspaces();
  const bridges = loadBridges();
  const rootBlocks = loadWorkspacePageBlocksFor("bridge");
  return workspaces.length > 0 || bridges.length > 0 || rootBlocks.length > 0;
}

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

function isPayloadV2(value: unknown): value is SyncPayloadV2 {
  if (!isRecord(value)) return false;
  if (value.version !== 2) return false;
  if (typeof value.fullSync !== "boolean") return false;
  if (!Array.isArray(value.workspaces)) return false;
  if (!Array.isArray(value.pages)) return false;
  if (!Array.isArray(value.blocks)) return false;
  if (!Array.isArray(value.bridges)) return false;
  if (typeof value.bufferedAt !== "string") return false;
  return true;
}

function toTextEntryName(kind: "note" | "heading1" | "heading2" | "heading3") {
  if (kind === "note") return "Untitled note";
  if (kind === "heading1") return "Heading 1";
  if (kind === "heading2") return "Heading 2";
  return "Heading 3";
}

function applyServerSnapshot(snapshot: ServerSnapshot) {
  const workspaceItems: WorkspaceItem[] = snapshot.workspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    description: ws.description ?? "",
    createdAt: ws.createdAt,
    sharedWith: ws.sharedWith ?? [],
    isHidden: ws.isHidden,
    isDefault: ws.isDefault,
  }));
  saveWorkspaces(workspaceItems);

  const rootPage = snapshot.pages.find((page) => isSystemBridgePageId(page.id));
  if (rootPage) {
    const rootBlocks = snapshot.blocks
      .filter((block) => block.pageId === rootPage.id)
      .sort((a, b) => a.position - b.position)
      .map((block) => ({
        id: block.id,
        pageKey: "bridge",
        kind: block.kind as WorkspacePageBlockKind,
        content: block.content ?? "",
        createdAt: block.createdAt ?? "0",
      })) satisfies WorkspacePageBlock[];
    saveWorkspacePageBlocks(rootBlocks);
  }

  const pages = snapshot.pages.filter((page) => !isSystemBridgePageId(page.id));
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const blocksByPage = new Map<string, ServerSnapshot["blocks"]>();
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
    if (block.kind === "chapter" && block.content) {
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
      if (block.kind === "chapter" && block.content) {
        parentByChildPage.set(block.content, pageId);
      }
    }
  }
  for (const [pageId, item] of chapterItemsById) {
    const parent = parentByChildPage.get(pageId) ?? null;
    item.parentChapterId = parent;
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
      if (block.kind === "chapter" && block.content) {
        appendPage(block.content);
        continue;
      }

      if (
        block.kind === "note" ||
        block.kind === "heading1" ||
        block.kind === "heading2" ||
        block.kind === "heading3"
      ) {
        nextBridges.push({
          id: block.id,
          name: toTextEntryName(block.kind),
          entryKind: block.kind,
          parentChapterId: pageId,
          bridgeType: "api",
          endpoint: "",
          environment: "development",
          createdAt: block.createdAt ?? new Date().toISOString(),
          publicNote: block.content,
        });
        continue;
      }

      if (block.kind === "api" || block.kind === "webhook" || block.kind === "grpc") {
        const bridge = bridgeById.get(block.id);
        nextBridges.push({
          id: block.id,
          name: bridge?.name ?? "",
          entryKind: "bridge",
          parentChapterId: pageId,
          bridgeType: block.kind,
          endpoint: bridge?.endpoint ?? "",
          environment: normalizeBridgeEnvironment(bridge?.environment),
          method: normalizeBridgeMethod(bridge?.method, block.kind === "api" ? "GET" : undefined),
          apiConfig: (bridge as any)?.apiConfig,
          requiredFields: (bridge as any)?.requiredFields,
          serviceName: (bridge as any)?.serviceName ?? undefined,
          secret: (bridge as any)?.secret ?? undefined,
          isPrivateInternal: Boolean((bridge as any)?.isPrivateInternal),
          privateNote: (bridge as any)?.privateNote ?? undefined,
          publicNote: (bridge as any)?.publicNote ?? undefined,
          notes: (bridge as any)?.notes ?? undefined,
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

  // Ensure we don't drop any pages that are present but only referenced in unusual ways.
  for (const page of pages) {
    appendPage(page.id);
  }

  saveBridges(nextBridges);
}

function payloadToSnapshotLike(payload: SyncPayloadV2): ServerSnapshot {
  return {
    ok: true,
    workspaces: payload.workspaces.map((ws) => ({
      id: ws.id,
      accountId: "local",
      name: ws.name,
      permit: ws.permit,
      description: ws.description,
      sharedWith: ws.sharedWith,
      isHidden: Boolean(ws.isHidden),
      isDefault: Boolean(ws.isDefault),
      createdAt: ws.createdAt,
      updatedAt: ws.createdAt,
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
      kind: block.kind,
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
  };
}

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

    const payload = buildPayloadFromLocal();
    if (!payload) return;
    window.localStorage.setItem(VARIABLES_STORAGE_KEY, JSON.stringify(payload));
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

    const raw = window.localStorage.getItem(VARIABLES_STORAGE_KEY);
    if (!raw) return;

    const parsed = safeParseJson(raw);
    if (!isPayloadV2(parsed)) return;

    flushInFlightRef.current = true;
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const json = (await response.json().catch(() => null)) as unknown;
      if (response.ok && isRecord(json) && json.ok === true) {
        window.localStorage.removeItem(VARIABLES_STORAGE_KEY);
        retryAtRef.current = 0;
      }
      if (response.status === 401) {
        retryAtRef.current = Date.now() + 5 * 60_000;
      } else if (!response.ok) {
        retryAtRef.current = Date.now() + 30_000;
      }
    } catch {
      retryAtRef.current = Date.now() + 30_000;
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

      const bufferedRaw = window.localStorage.getItem(VARIABLES_STORAGE_KEY);
      const bufferedParsed = bufferedRaw ? safeParseJson(bufferedRaw) : null;
      const bufferedPayload = isPayloadV2(bufferedParsed) ? bufferedParsed : null;

      try {
        const response = await fetch("/api/state", { method: "GET", cache: "no-store" });
        const json = (await response.json().catch(() => null)) as unknown;
        if (cancelled) return;

        if (response.status === 401) {
          return;
        }

        if (response.ok && isRecord(json) && json.ok === true) {
          suppressBufferRef.current = true;
          applyServerSnapshot(json as ServerSnapshot);
          if (bufferedPayload) {
            applyServerSnapshot(payloadToSnapshotLike(bufferedPayload));
          }
          suppressBufferRef.current = false;

          if (bufferedPayload) {
            scheduleFlush();
          }
          return;
        }
      } catch {
        // Ignore bootstrap errors; we'll still seed server if needed.
      }

      // No server state found (or API unreachable). If we have any local data, buffer it and attempt a flush.
      if (hasAnyUserData()) {
        bufferLatestState();
        scheduleFlush();
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void flushNow();
      }
    }

    window.addEventListener(WORKSPACE_STORAGE_EVENT, handleLocalChange);
    window.addEventListener(BRIDGE_STORAGE_EVENT, handleLocalChange);
    window.addEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, handleLocalChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener(WORKSPACE_STORAGE_EVENT, handleLocalChange);
      window.removeEventListener(BRIDGE_STORAGE_EVENT, handleLocalChange);
      window.removeEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, handleLocalChange);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
