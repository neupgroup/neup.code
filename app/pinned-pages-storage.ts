export type PinnedPagesOrderBy =
  | "ascending.title"
  | "descending.title"
  | "ascending.date"
  | "descending.date"
  | "custom";

export type WorkspacePinnedPages = {
  id: string;
  workspaceId: string;
  pageIds: string[];
  orderBy: PinnedPagesOrderBy;
};

export const PINNED_PAGES_STORAGE_KEY = "neup.code.workspace.pinned-pages.v1";
export const PINNED_PAGES_STORAGE_EVENT = "neup.code.workspace.pinned-pages.updated";

function isPinnedPagesOrderBy(value: string): value is PinnedPagesOrderBy {
  return (
    value === "ascending.title" ||
    value === "descending.title" ||
    value === "ascending.date" ||
    value === "descending.date" ||
    value === "custom"
  );
}

function isWorkspacePinnedPages(value: unknown): value is WorkspacePinnedPages {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.workspaceId === "string" &&
    Array.isArray(item.pageIds) &&
    item.pageIds.every((pageId) => typeof pageId === "string") &&
    typeof item.orderBy === "string" &&
    isPinnedPagesOrderBy(item.orderBy)
  );
}

export function parsePinnedPages(value: unknown): WorkspacePinnedPages[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkspacePinnedPages => isWorkspacePinnedPages(item));
}

export function loadPinnedPages(): WorkspacePinnedPages[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(PINNED_PAGES_STORAGE_KEY);
    if (!raw) return [];
    return parsePinnedPages(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePinnedPages(items: WorkspacePinnedPages[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PINNED_PAGES_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(PINNED_PAGES_STORAGE_EVENT));
}

export function loadPinnedPagesForWorkspace(workspaceId: string) {
  return loadPinnedPages().find((item) => item.workspaceId === workspaceId) ?? null;
}

export function upsertPinnedPages(nextItem: WorkspacePinnedPages) {
  const current = loadPinnedPages();
  const next = current.filter((item) => item.workspaceId !== nextItem.workspaceId);
  next.push(nextItem);
  savePinnedPages(next);
}

export function removePinnedPage(workspaceId: string, pageId: string) {
  const current = loadPinnedPages();
  const next = current.map((item) =>
    item.workspaceId === workspaceId
      ? { ...item, pageIds: item.pageIds.filter((candidate) => candidate !== pageId) }
      : item,
  );
  savePinnedPages(next);
}

export function prunePinnedPages(validPagesByWorkspace: Record<string, string[]>) {
  const current = loadPinnedPages();
  const next = current.map((item) => {
    const validPageIds = new Set(validPagesByWorkspace[item.workspaceId] ?? []);
    return {
      ...item,
      pageIds: item.pageIds.filter((pageId) => validPageIds.has(pageId)),
    };
  });

  savePinnedPages(next);
}
