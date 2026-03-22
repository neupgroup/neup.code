"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SidebarIconName =
  | "bridge"
  | "components"
  | "design"
  | "home"
  | "onboarding"
  | "rules"
  | "settings"

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
      { href: "/", label: "Home", icon: "home" },
      { href: "/onboarding", label: "Onboarding", icon: "onboarding" },
      { href: "/doc?type=component", label: "Components", icon: "components" },
      { href: "/doc?type=design", label: "Design", icon: "design" },
      { href: "/rules", label: "Rules", icon: "rules" },
    ],
  },
  {
    title: "Bridge",
    links: [{ href: "/doc?type=bridge", label: "Bridge", icon: "bridge" }],
  },
  {
    title: "Settings",
    links: [{ href: "/settings", label: "Settings", icon: "settings" }],
  },
];

function isActivePath(currentPathname: string, currentType: string | null, href: string) {
  if (href === "/") {
    return currentPathname === "/";
  }

  if (href === "/doc?type=bridge") {
    return (
      (currentPathname === "/doc" && currentType === "bridge") ||
      currentPathname === "/bridge" ||
      currentPathname.startsWith("/bridge/")
    );
  }

  if (href === "/doc?type=component") {
    return (
      (currentPathname === "/doc" && currentType === "component") ||
      currentPathname === "/component" ||
      currentPathname.startsWith("/component/") ||
      currentPathname === "/components" ||
      currentPathname.startsWith("/components/")
    );
  }

  if (href === "/doc?type=design") {
    return (
      (currentPathname === "/doc" && currentType === "design") ||
      currentPathname === "/design" ||
      currentPathname.startsWith("/design/")
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
    case "components":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4.5" y="4.5" width="6.5" height="6.5" />
          <rect x="13" y="4.5" width="6.5" height="6.5" />
          <rect x="4.5" y="13" width="6.5" height="6.5" />
          <rect x="13" y="13" width="6.5" height="6.5" />
        </svg>
      );
    case "design":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 4.2a7.8 7.8 0 1 0 0 15.6h1.4a2.1 2.1 0 0 0 0-4.2h-.5a1.8 1.8 0 0 1 0-3.6h1.9a4 4 0 1 0 0-7.8H12z" />
          <circle cx="8.2" cy="11.1" r="1" />
          <circle cx="10.1" cy="8.2" r="1" />
          <circle cx="13.7" cy="8.1" r="1" />
        </svg>
      );
    case "bridge":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3.5 12h5M15.5 12h5M8.5 12a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4.8a7.3 7.3 0 0 0-1.7-1L14.4 3h-4.8l-.4 2.8a7.3 7.3 0 0 0-1.7 1l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.6 2 3.4 2.4-.8c.5.4 1.1.7 1.7 1l.4 2.8h4.8l.4-2.8c.6-.3 1.2-.6 1.7-1l2.4.8 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
        </svg>
      );
    case "rules":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 5.5h10" />
          <path d="M7 9.5h10" />
          <path d="M7 13.5h6" />
          <path d="M5 4.5h14v15H5z" />
        </svg>
      );
    default:
      return null;
  }
}

export function SidebarNav() {
  const pathname = usePathname();
  const [docType, setDocType] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextType = new URLSearchParams(window.location.search).get("type");
    setDocType(nextType);
  }, [pathname]);

  return (
    <nav className="space-y-7">
      {sidebarGroups.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.title}
          </p>
          <div className="space-y-1">
            {group.links.map((item) => {
              const isActive = isActivePath(pathname, docType, item.href);

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
    </nav>
  );
}
