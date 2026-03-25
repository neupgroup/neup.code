"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createDefaultWorkspace,
  loadWorkspaces,
  saveWorkspaces,
  type WorkspaceItem,
  WORKSPACE_STORAGE_EVENT,
} from "./workspace-storage";
import { seedDefaultPageForWorkspace } from "./defaultPage_en";

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="size-4">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);

  useEffect(() => {
    function sync() {
      const items = loadWorkspaces();
      if (items.length === 0) {
        const defaultWorkspace: WorkspaceItem = createDefaultWorkspace();
        saveWorkspaces([defaultWorkspace]);
        seedDefaultPageForWorkspace(defaultWorkspace.id);
        setWorkspaces([defaultWorkspace]);
      } else {
        setWorkspaces(items);
      }
    }
    sync();

    window.addEventListener(WORKSPACE_STORAGE_EVENT, sync);
    return () => window.removeEventListener(WORKSPACE_STORAGE_EVENT, sync);
  }, []);

  function handleToggleHide(id: string) {
    const next = workspaces.map((w) => {
      if (w.id !== id || w.isDefault) return w;
      return { ...w, isHidden: !w.isHidden };
    });
    saveWorkspaces(next);
  }

  function handleSetDefault(id: string) {
    const selectedWorkspace = workspaces.find((workspace) => workspace.id === id);
    if (!selectedWorkspace || selectedWorkspace.isHidden) return;

    const next = workspaces.map((w) => ({
      ...w,
      isDefault: w.id === id,
      isHidden: w.id === id ? false : w.isHidden,
    }));
    saveWorkspaces(next);
  }

  return (
    <section className="space-y-7 pb-16">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:justify-between">
        <div className="space-y-3">
          <p className="text-[0.76rem] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
            Profile &amp; Workspaces
          </p>
          <div className="space-y-2">
            <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
              Workspaces
            </h1>
            <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
              Manage your personal workspaces and share them. You can switch between different environments across the app.
            </p>
          </div>
        </div>

        <div>
          <Link
            href="/workspace/new"
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            New Workspace
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {workspaces.map((ws) => (
          <div 
            key={ws.id} 
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border bg-background p-5 transition hover:shadow-sm"
          >
            <Link href={`/workspace/${ws.id}`} className="flex-1 space-y-1 block">
              <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground group-hover:underline">
                {ws.name}
              </h3>
              <p className="text-[0.84rem] text-muted-foreground line-clamp-1">
                {ws.description || "No description provided."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
                  Owner
                </span>
                {ws.isDefault ? (
                  <span className="inline-flex items-center rounded-sm bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-amber-600 uppercase">
                    Default
                  </span>
                ) : null}
                {ws.isHidden ? (
                  <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
                    Hidden
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-sm bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-primary uppercase">
                  {ws.sharedWith.length} Collaborator{ws.sharedWith.length !== 1 && 's'}
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                title={ws.isDefault ? "Default workspaces stay visible" : ws.isHidden ? "Show in sidebar" : "Hide from sidebar"}
                onClick={() => handleToggleHide(ws.id)}
                disabled={ws.isDefault}
                className={`flex size-10 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50 ${ws.isHidden ? 'border-border text-muted-foreground bg-muted/50' : 'border-transparent text-foreground hover:bg-muted'}`}
              >
                <EyeIcon off={ws.isHidden} />
              </button>
              <button 
                type="button"
                title={ws.isDefault ? "Current Default" : ws.isHidden ? "Show this workspace before making it default" : "Set as Default"}
                onClick={() => handleSetDefault(ws.id)}
                disabled={ws.isHidden}
                className={`flex size-10 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50 ${ws.isDefault ? 'border-amber-500/30 text-amber-500 bg-amber-500/10' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
              >
                <StarIcon filled={ws.isDefault} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
