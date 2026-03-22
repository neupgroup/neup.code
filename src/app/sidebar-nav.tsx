"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BRIDGE_STORAGE_EVENT,
  BRIDGE_STORAGE_KEY,
  loadBridges,
  saveBridges,
  type BridgeItem,
} from "./bridge/bridge-storage";
import { getPageDocHref } from "./bridge/paths";
import { loadWorkspaces, WORKSPACE_STORAGE_EVENT } from "./workspace/workspace-storage";

type SidebarIconName =
  | "bridge"
  | "home"
  | "onboarding"
  | "page"
  | "plus"
  | "profile"
  | "settings"
  | "workspace";

type SidebarLink = {
  href: string;
  label: string;
  icon: SidebarIconName;
};

type SidebarGroup = {
  title: string;
  links: SidebarLink[];
};

const sidebarGroups: SidebarGroup[] = [
  {
    title: "Main",
    links: [
      { href: "/home", label: "Home", icon: "home" },
      { href: "https://neupgroup.com/account", label: "Profile", icon: "profile" },
      { href: "/workspace", label: "Workspace", icon: "workspace" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

function isActivePath(currentPathname: string, currentDocId: string | null, href: string) {
  if (href === "/") {
    return currentPathname === "/";
  }

  if (href === "/home") {
    return currentPathname === "/home" || currentPathname === "/";
  }

  if (href === "/workspace") {
    return currentPathname === "/workspace";
  }

  if (href === "/doc") {
    return (
      (currentPathname === "/doc" && !currentDocId) ||
      currentPathname === "/bridge" ||
      currentPathname.startsWith("/bridge/")
    );
  }

  const [targetPath] = href.split("?");
  return currentPathname === targetPath || currentPathname.startsWith(`${targetPath}/`);
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const baseClass = "h-[14px] w-[14px] shrink-0";

  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 11.5L12 4l9 7.5" />
          <path d="M5.5 10.5V20h13V10.5" />
        </svg>
      );
    case "onboarding":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3z" />
          <path d="M18.5 14.5l.9 2.5 2.6.9-2.6.9-.9 2.6-.9-2.6-2.5-.9 2.5-.9.9-2.5z" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "workspace":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4.5 6.5h15v11h-15z" />
          <path d="M8 4.5v4" />
          <path d="M16 4.5v4" />
          <path d="M4.5 10.5h15" />
        </svg>
      );
    case "bridge":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3.5 12h5M15.5 12h5M8.5 12a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
        </svg>
      );
    case "page":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4.5h7l4.5 4.5v10.5H7z" />
          <path d="M14 4.5v4.5h4.5" />
          <path d="M10 13h6" />
          <path d="M10 16.5h4.5" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4.8a7.3 7.3 0 0 0-1.7-1L14.4 3h-4.8l-.4 2.8a7.3 7.3 0 0 0-1.7 1l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.6 2 3.4 2.4-.8c.5.4 1.1.7 1.7 1l.4 2.8h4.8l.4-2.8c.6-.3 1.2-.6 1.7-1l2.4.8 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const docId = searchParams.get("id");
  const [notePages, setNotePages] = useState<BridgeItem[]>([]);
  const [workspaceName, setWorkspaceName] = useState("Workspace");

  useEffect(() => {
    function syncWorkspace() {
      const items = loadWorkspaces();
      if (items.length > 0) {
        setWorkspaceName(items[0].name);
      }
    }
    syncWorkspace();
    window.addEventListener(WORKSPACE_STORAGE_EVENT, syncWorkspace);
    return () => window.removeEventListener(WORKSPACE_STORAGE_EVENT, syncWorkspace);
  }, []);

  useEffect(() => {
    function syncNotePages() {
      const currentBridges = loadBridges();
      const rootPages = currentBridges.filter(
        (item) => (item.entryKind ?? "bridge") === "chapter" && !item.parentChapterId,
      );

      if (rootPages.length === 0) {
        const nextIndexPage: BridgeItem = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: "Index",
          entryKind: "chapter",
          bridgeType: "api",
          endpoint: "",
          environment: "development",
          createdAt: new Date().toISOString(),
        };
        const nextBridges = [nextIndexPage, ...currentBridges];
        saveBridges(nextBridges);
        setNotePages([nextIndexPage]);
        return;
      }

      const orderedPages = [...rootPages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setNotePages(orderedPages);
    }

    syncNotePages();

    function handleStorage(event: StorageEvent) {
      if (event.key && event.key !== BRIDGE_STORAGE_KEY) return;
      syncNotePages();
    }

    function handleBridgeUpdate() {
      syncNotePages();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(BRIDGE_STORAGE_EVENT, handleBridgeUpdate);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(BRIDGE_STORAGE_EVENT, handleBridgeUpdate);
    };
  }, []);

  function handleAddPage() {
    const nextPage: BridgeItem = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: "Untitled page",
      entryKind: "chapter",
      bridgeType: "api",
      endpoint: "",
      environment: "development",
      createdAt: new Date().toISOString(),
    };
    const nextBridges = [...loadBridges(), nextPage];
    saveBridges(nextBridges);
    setNotePages((current) => [...current, nextPage]);
    router.push(getPageDocHref(nextPage.id));
  }

  return (
    <nav className="space-y-7">
      {sidebarGroups.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.title}
          </p>
          <div className="space-y-1">
            {group.links.map((item) => {
              const isActive = isActivePath(pathname, docId, item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-10 items-center gap-2 rounded-xl px-3 text-[0.93rem] font-semibold tracking-[0] transition ${
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-foreground/75 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <SidebarIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate" title={workspaceName}>
          {workspaceName}
        </p>
        <div className="space-y-1">
          {notePages.map((page) => {
            const href = getPageDocHref(page.id);
            const isActive = pathname === "/doc" && docId === page.id;

            return (
              <Link
                key={page.id}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-10 items-center gap-2 rounded-xl px-3 text-[0.93rem] font-semibold tracking-[0] transition ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-foreground/75 hover:bg-muted hover:text-foreground"
                }`}
              >
                <SidebarIcon name="page" />
                <span className="truncate">{page.name?.trim() || "Untitled page"}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleAddPage}
            className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[0.93rem] font-semibold tracking-[0] text-foreground/75 transition hover:bg-muted hover:text-foreground"
          >
            <SidebarIcon name="plus" />
            Add a page
          </button>
        </div>
      </div>
    </nav>
  );
}
