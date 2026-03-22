"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadWorkspaces, saveWorkspaces, type WorkspaceItem, WORKSPACE_STORAGE_EVENT } from "./workspace-storage";

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);

  useEffect(() => {
    function sync() {
      const items = loadWorkspaces();
      if (items.length === 0) {
        const defaultWorkspace: WorkspaceItem = {
          id: "default",
          name: "Personal Workspace",
          description: "Your default profile workspace.",
          createdAt: new Date().toISOString(),
          sharedWith: [],
        };
        saveWorkspaces([defaultWorkspace]);
        setWorkspaces([defaultWorkspace]);
      } else {
        setWorkspaces(items);
      }
    }
    sync();

    window.addEventListener(WORKSPACE_STORAGE_EVENT, sync);
    return () => window.removeEventListener(WORKSPACE_STORAGE_EVENT, sync);
  }, []);

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

      <div className="grid gap-5 sm:grid-cols-2">
        {workspaces.map((ws) => (
          <Link 
            key={ws.id} 
            href={`/workspace/${ws.id}`}
            className="group flex flex-col justify-between rounded-lg border border-border bg-background p-5 transition hover:shadow-sm"
          >
            <div className="space-y-1">
              <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground group-hover:underline">
                {ws.name}
              </h3>
              <p className="text-[0.84rem] text-muted-foreground line-clamp-2">
                {ws.description || "No description provided."}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
                Owner
              </span>
              <span className="inline-flex items-center rounded-sm bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-primary uppercase">
                {ws.sharedWith.length} Collaborator{ws.sharedWith.length !== 1 && 's'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
