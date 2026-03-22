export type WorkspaceItem = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  sharedWith: string[];
};

export const WORKSPACE_STORAGE_KEY = "neup.code.workspace.profiles.v1";
export const WORKSPACE_STORAGE_EVENT = "neup.code.workspace.profiles.updated";

export function loadWorkspaces(): WorkspaceItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkspaceItem[];
  } catch {
    return [];
  }
}

export function saveWorkspaces(items: WorkspaceItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(WORKSPACE_STORAGE_EVENT));
}
