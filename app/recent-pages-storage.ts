export type RecentOpenedPageItem = {
  id: string;
  openedAt: string;
};

export const RECENTLY_OPENED_PAGES_STORAGE_KEY = "neup.code.recently-opened-pages.v1";
export const RECENTLY_OPENED_PAGES_STORAGE_EVENT = "neup.code.recently-opened-pages.updated";
const MAX_RECENTLY_OPENED_PAGES = 12;

function isRecentOpenedPageItem(value: unknown): value is RecentOpenedPageItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.openedAt === "string";
}

export function loadRecentlyOpenedPages() {
  if (typeof window === "undefined") return [];

  try {
    const raw =
      window.sessionStorage.getItem(RECENTLY_OPENED_PAGES_STORAGE_KEY) ??
      window.localStorage.getItem(RECENTLY_OPENED_PAGES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is RecentOpenedPageItem => isRecentOpenedPageItem(item));
  } catch {
    return [];
  }
}

export function saveRecentlyOpenedPages(items: RecentOpenedPageItem[]) {
  if (typeof window === "undefined") return;

  const normalizedItems = items.slice(0, MAX_RECENTLY_OPENED_PAGES);
  window.sessionStorage.setItem(
    RECENTLY_OPENED_PAGES_STORAGE_KEY,
    JSON.stringify(normalizedItems),
  );
  window.localStorage.removeItem(RECENTLY_OPENED_PAGES_STORAGE_KEY);
  window.dispatchEvent(new Event(RECENTLY_OPENED_PAGES_STORAGE_EVENT));
}

export function trackRecentlyOpenedPage(id: string) {
  const currentItems = loadRecentlyOpenedPages().filter((item) => item.id !== id);
  saveRecentlyOpenedPages([
    {
      id,
      openedAt: new Date().toISOString(),
    },
    ...currentItems,
  ]);
}
