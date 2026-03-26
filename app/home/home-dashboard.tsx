"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getPageDocHref } from "../bridge/paths";
import {
  BRIDGE_STORAGE_EVENT,
  BRIDGE_STORAGE_KEY,
  loadBridges,
  type BridgeItem,
} from "../bridge/bridge-storage";
import {
  loadRecentlyOpenedPages,
  RECENTLY_OPENED_PAGES_STORAGE_EVENT,
  RECENTLY_OPENED_PAGES_STORAGE_KEY,
  type RecentOpenedPageItem,
} from "../recent-pages-storage";
import {
  loadWorkspaces,
  WORKSPACE_STORAGE_EVENT,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceItem,
} from "../workspace/workspace-storage";

type DashboardSnapshot = {
  userName: string;
  workspaces: WorkspaceItem[];
  pages: BridgeItem[];
  recentPages: RecentOpenedPageItem[];
  defaultWorkspaceId: string | null;
};

const EMPTY_DASHBOARD_SNAPSHOT: DashboardSnapshot = {
  userName: "User",
  workspaces: [],
  pages: [],
  recentPages: [],
  defaultWorkspaceId: null,
};

let dashboardSnapshotCache:
  | {
      cacheKey: string;
      snapshot: DashboardSnapshot;
    }
  | null = null;

export function HomeDashboard() {
  const { userName, workspaces, pages, recentPages, defaultWorkspaceId } = useSyncExternalStore(
    subscribeToDashboardSnapshot,
    getDashboardSnapshot,
    getServerDashboardSnapshot,
  );

  const workspaceNames = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  const pagesById = new Map(pages.map((page) => [page.id, page]));

  const recentlyOpenedPages = recentPages
    .map((item) => {
      const page = pagesById.get(item.id);
      if (!page) return null;

      return {
        id: page.id,
        title: page.name?.trim() || "Untitled Page",
        href: getPageDocHref(page.id),
        workspaceName: getWorkspaceNameForPage(page, defaultWorkspaceId, workspaceNames),
        openedAtLabel: formatRelativeTime(item.openedAt),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-2">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Home
        </p>
        <div className="space-y-2">
          <h1 className="text-[clamp(2.25rem,5vw,4.4rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-foreground">
            Welcome back,
            <br />
            <span>{userName}</span>
          </h1>
        </div>
      </section>

      {recentlyOpenedPages.length > 0 ? (
        <section className="overflow-hidden rounded-[1.55rem] border border-border bg-card shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Recently Opened Pages
            </p>
          </div>

          <div className="p-3 sm:p-4">
            <div className="grid gap-1.5">
              {recentlyOpenedPages.map((page) => (
                <Link
                  key={page.id}
                  href={page.href}
                  className="group flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PageIcon />
                    <div className="min-w-0">
                      <p className="truncate text-[0.94rem] font-semibold tracking-[0] text-foreground">
                        {page.title}
                      </p>
                      <p className="mt-0.5 truncate text-[0.78rem] text-muted-foreground">
                        {page.workspaceName}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[0.72rem] font-medium text-muted-foreground">
                      {page.openedAtLabel}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4.5h7l4.5 4.5v10.5H7z" />
      <path d="M14 4.5v4.5h4.5" />
      <path d="M10 13h6" />
      <path d="M10 16.5h4.5" />
    </svg>
  );
}

function subscribeToDashboardSnapshot(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  function handleStorage(event: StorageEvent) {
    if (
      event.key &&
      event.key !== WORKSPACE_STORAGE_KEY &&
      event.key !== BRIDGE_STORAGE_KEY &&
      event.key !== RECENTLY_OPENED_PAGES_STORAGE_KEY
    ) {
      return;
    }

    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(WORKSPACE_STORAGE_EVENT, onStoreChange);
  window.addEventListener(BRIDGE_STORAGE_EVENT, onStoreChange);
  window.addEventListener(RECENTLY_OPENED_PAGES_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(WORKSPACE_STORAGE_EVENT, onStoreChange);
    window.removeEventListener(BRIDGE_STORAGE_EVENT, onStoreChange);
    window.removeEventListener(RECENTLY_OPENED_PAGES_STORAGE_EVENT, onStoreChange);
  };
}

function getDashboardSnapshot(): DashboardSnapshot {
  const cacheKey = [
    readBrowserStore(WORKSPACE_STORAGE_KEY),
    readBrowserStore(BRIDGE_STORAGE_KEY),
    readBrowserStore(RECENTLY_OPENED_PAGES_STORAGE_KEY),
    getUserNameSnapshot(),
  ].join("::");

  if (dashboardSnapshotCache?.cacheKey === cacheKey) {
    return dashboardSnapshotCache.snapshot;
  }

  const workspaces = loadWorkspaces();
  const pages = loadBridges().filter(
    (item) => (item.entryKind ?? "bridge") === "chapter" && !item.parentChapterId,
  );
  const recentPages = loadRecentlyOpenedPages();
  const defaultWorkspaceId =
    workspaces.find((workspace) => workspace.isDefault)?.id ?? workspaces[0]?.id ?? null;

  const snapshot = {
    userName: getUserNameSnapshot(),
    workspaces,
    pages,
    recentPages,
    defaultWorkspaceId,
  };

  dashboardSnapshotCache = {
    cacheKey,
    snapshot,
  };

  return snapshot;
}

function getServerDashboardSnapshot() {
  return EMPTY_DASHBOARD_SNAPSHOT;
}

function readBrowserStore(key: string) {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key) ?? "";
}

function getWorkspaceNameForPage(
  page: BridgeItem,
  defaultWorkspaceId: string | null,
  workspaceNames: Map<string, string>,
) {
  const workspaceId = page.workspaceId ?? defaultWorkspaceId;
  if (!workspaceId) return "Workspace";
  return workspaceNames.get(workspaceId) ?? "Workspace";
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getUserNameSnapshot() {
  if (typeof window === "undefined") return "User";

  const storageKeys = [
    "neup.code.user.name",
    "auth_user_name",
    "user_name",
    "profile_name",
  ];

  for (const key of storageKeys) {
    const stored =
      window.sessionStorage.getItem(key)?.trim() ??
      window.localStorage.getItem(key)?.trim() ??
      "";
    const normalized = normalizeDisplayName(stored);
    if (normalized) return normalized;
  }

  const cookieMatch = document.cookie.match(/(?:^|; )auth_account_id=([^;]+)/);
  const cookieValue = cookieMatch ? decodeURIComponent(cookieMatch[1]) : "";
  return normalizeDisplayName(cookieValue) ?? "User";
}

function normalizeDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const baseValue = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  if (/^[0-9a-f-]{20,}$/i.test(baseValue)) {
    return null;
  }

  const words = baseValue
    .replace(/[^a-zA-Z0-9._ -]/g, " ")
    .split(/[._ -]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return words.length > 0 ? words.join(" ") : null;
}
