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

export function loadWorkspaces(): WorkspaceItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = readWorkspaceStorageRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = normalizeWorkspaces(parsed as WorkspaceItem[]);
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
