import { BRIDGE_STORAGE_KEY } from "../bridge/bridge-storage";
import { PINNED_PAGES_STORAGE_KEY } from "../pinned-pages-storage";

export type WorkspaceItem = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  sharedWith: string[];
  isHidden?: boolean;
  isDefault?: boolean;
};

export const WORKSPACE_STORAGE_KEY = "neup.code.workspace.profiles.v1";
export const WORKSPACE_STORAGE_EVENT = "neup.code.workspace.profiles.updated";
const LEGACY_DEFAULT_WORKSPACE_ID = "default";

export function createWorkspaceId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDefaultWorkspace(): WorkspaceItem {
  return {
    id: createWorkspaceId(),
    name: "Personal Workspace",
    description: "Your default profile workspace.",
    createdAt: new Date().toISOString(),
    sharedWith: [],
    isDefault: true,
  };
}

export function normalizeWorkspaces(items: WorkspaceItem[]): WorkspaceItem[] {
  if (!items.length) return [];

  const defaultIndex = items.findIndex((item) => item.isDefault);
  const resolvedDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;

  return items.map((item, index) => ({
    ...item,
    sharedWith: Array.isArray(item.sharedWith) ? item.sharedWith : [],
    isDefault: index === resolvedDefaultIndex,
    isHidden: index === resolvedDefaultIndex ? false : Boolean(item.isHidden),
  }));
}

function writeWorkspaceStorage(items: WorkspaceItem[], dispatchEvent: boolean) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(items));
  window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  if (dispatchEvent) {
    window.dispatchEvent(new Event(WORKSPACE_STORAGE_EVENT));
  }
}

function readWorkspaceStorageRaw() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(WORKSPACE_STORAGE_KEY) ?? window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

function migrateLegacyDefaultWorkspace(
  items: WorkspaceItem[],
): WorkspaceItem[] {
  const legacyWorkspace = items.find((item) => item.id === LEGACY_DEFAULT_WORKSPACE_ID);
  if (!legacyWorkspace) return items;

  const nextWorkspaceId = createWorkspaceId();
  migrateWorkspaceIdReferences(LEGACY_DEFAULT_WORKSPACE_ID, nextWorkspaceId);

  return items.map((item) =>
    item.id === LEGACY_DEFAULT_WORKSPACE_ID
      ? {
          ...item,
          id: nextWorkspaceId,
        }
      : item,
  );
}

function migrateWorkspaceIdReferences(legacyWorkspaceId: string, nextWorkspaceId: string) {
  if (typeof window === "undefined") return;

  const rawBridgeItems =
    window.sessionStorage.getItem(BRIDGE_STORAGE_KEY) ??
    window.localStorage.getItem(BRIDGE_STORAGE_KEY);
  if (rawBridgeItems) {
    try {
      const parsed = JSON.parse(rawBridgeItems);
      if (Array.isArray(parsed)) {
        let didChange = false;
        const nextBridgeItems = parsed.map((item) => {
          if (
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            (item as { workspaceId?: unknown }).workspaceId === legacyWorkspaceId
          ) {
            didChange = true;
            return {
              ...item,
              workspaceId: nextWorkspaceId,
            };
          }

          return item;
        });

        if (didChange) {
          window.sessionStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify(nextBridgeItems));
          window.localStorage.removeItem(BRIDGE_STORAGE_KEY);
        }
      }
    } catch {}
  }

  const rawPinnedPages = window.sessionStorage.getItem(PINNED_PAGES_STORAGE_KEY);
  if (rawPinnedPages) {
    try {
      const parsed = JSON.parse(rawPinnedPages);
      if (Array.isArray(parsed)) {
        let didChange = false;
        const nextPinnedPages = parsed.map((item) => {
          if (
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            (item as { workspaceId?: unknown }).workspaceId === legacyWorkspaceId
          ) {
            didChange = true;
            return {
              ...item,
              workspaceId: nextWorkspaceId,
            };
          }

          return item;
        });

        if (didChange) {
          window.sessionStorage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify(nextPinnedPages));
        }
      }
    } catch {}
  }
}

export function loadWorkspaces(): WorkspaceItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = readWorkspaceStorageRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const migrated = migrateLegacyDefaultWorkspace(parsed as WorkspaceItem[]);
    const normalized = normalizeWorkspaces(migrated);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeWorkspaceStorage(normalized, false);
    }

    return normalized;
  } catch {
    return [];
  }
}

export function saveWorkspaces(items: WorkspaceItem[]) {
  writeWorkspaceStorage(normalizeWorkspaces(items), true);
}
