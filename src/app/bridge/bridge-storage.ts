import { cleanupOrphanedWorkspaceBridgeBlocks } from "../page-blocks-storage";

export type BridgeType = "api" | "webhook" | "grpc" | "handshake";
export type BridgeEntryKind =
  | "bridge"
  | "chapter"
  | "note"
  | "heading1"
  | "heading2"
  | "heading3";

export type BridgeKeyValueItem = {
  id: string;
  key: string;
  value: string;
};

export type ApiBridgeConfig = {
  headers: BridgeKeyValueItem[];
  queryParams: BridgeKeyValueItem[];
  formData: BridgeKeyValueItem[];
  bodyType: "none" | "json" | "raw";
  body: string;
};

export type BridgeItem = {
  id: string;
  name: string;
  entryKind?: BridgeEntryKind;
  chapterBlockIds?: string[];
  parentChapterId?: string | null;
  bridgeType: BridgeType;
  isPrivateInternal?: boolean;
  endpoint: string;
  environment: "development" | "staging" | "production";
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  apiConfig?: ApiBridgeConfig;
  requiredFields?: BridgeKeyValueItem[];
  serviceName?: string;
  secret?: string;
  privateNote?: string;
  publicNote?: string;
  notes?: string;
  createdAt: string;
};

export const BRIDGE_STORAGE_KEY = "neup.code.bridge.items.v1";
export const BRIDGE_RUN_STORAGE_KEY = "neup.code.bridge.runs.v1";

export type BridgeRunRecord = {
  bridgeId: string;
  status: "idle" | "running" | "success" | "error";
  lastRunAt?: string;
  output?: string;
  response?: {
    requestUrl?: string;
    statusCode?: number;
    statusText?: string;
    headers?: BridgeKeyValueItem[];
    body?: string;
    durationMs?: number;
  };
};

function isBridgeType(value: string): value is BridgeType {
  return value === "api" || value === "webhook" || value === "grpc" || value === "handshake";
}

function isBridgeEntryKind(value: string): value is BridgeEntryKind {
  return (
    value === "bridge" ||
    value === "chapter" ||
    value === "note" ||
    value === "heading1" ||
    value === "heading2" ||
    value === "heading3"
  );
}

function isEnvironment(
  value: string,
): value is "development" | "staging" | "production" {
  return value === "development" || value === "staging" || value === "production";
}

export function loadBridges(): BridgeItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(BRIDGE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is BridgeItem => {
        if (!item || typeof item !== "object") return false;
        if (typeof item.id !== "string") return false;
        if (typeof item.name !== "string") return false;
        if (typeof item.endpoint !== "string") return false;
        if (typeof item.createdAt !== "string") return false;
        if (!isBridgeType(item.bridgeType)) return false;
        if (!isEnvironment(item.environment)) return false;
        if (
          item.entryKind !== undefined &&
          (typeof item.entryKind !== "string" || !isBridgeEntryKind(item.entryKind))
        ) {
          return false;
        }
        return true;
      })
      .map((item) => ({
        ...item,
        entryKind: item.entryKind ?? "bridge",
        chapterBlockIds: Array.isArray(item.chapterBlockIds)
          ? item.chapterBlockIds.filter((id): id is string => typeof id === "string")
          : [],
        parentChapterId:
          typeof item.parentChapterId === "string" ? item.parentChapterId : null,
      }))
      .map((item, _, items) => {
        if (item.parentChapterId) return item;

        const legacyParent =
          items.find((candidate) => (candidate.chapterBlockIds ?? []).includes(item.id))?.id ??
          null;

        return {
          ...item,
          parentChapterId: legacyParent,
        };
      });
  } catch {
    return [];
  }
}

export function saveBridges(items: BridgeItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify(items));
  cleanupOrphanedWorkspaceBridgeBlocks(items.map((item) => item.id));
}

export function deleteBridge(id: string) {
  const items = loadBridges();
  saveBridges(
    items
      .filter((item) => item.id !== id)
      .map((item) => ({
        ...item,
        parentChapterId: item.parentChapterId === id ? null : item.parentChapterId ?? null,
        chapterBlockIds: item.chapterBlockIds?.filter((blockId) => blockId !== id) ?? [],
      })),
  );
}

export function loadBridgeRuns(): Record<string, BridgeRunRecord> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(BRIDGE_RUN_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        if (!value || typeof value !== "object") return false;
        const record = value as Partial<BridgeRunRecord>;
        return (
          typeof record.bridgeId === "string" &&
          (record.status === "idle" ||
            record.status === "running" ||
            record.status === "success" ||
            record.status === "error")
        );
      }),
    ) as Record<string, BridgeRunRecord>;
  } catch {
    return {};
  }
}

export function saveBridgeRuns(items: Record<string, BridgeRunRecord>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRIDGE_RUN_STORAGE_KEY, JSON.stringify(items));
}

export function deleteBridgeRun(id: string) {
  const items = loadBridgeRuns();
  const nextItems = { ...items };
  delete nextItems[id];
  saveBridgeRuns(nextItems);
}
