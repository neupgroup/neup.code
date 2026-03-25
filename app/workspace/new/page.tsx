"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createWorkspaceId,
  loadWorkspaces,
  saveWorkspaces,
  type WorkspaceItem,
} from "../workspace-storage";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    const workspaces = loadWorkspaces();
    const newWorkspace: WorkspaceItem = {
      id: createWorkspaceId(),
      name: newWorkspaceName.trim(),
      description: newWorkspaceDesc.trim(),
      createdAt: new Date().toISOString(),
      sharedWith: [],
    };

    saveWorkspaces([...workspaces, newWorkspace]);
    router.push("/workspace");
  }

  return (
    <section className="space-y-7 pb-16">
      <div className="space-y-3">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
        >
          <span aria-hidden="true">&lt;</span>
          <span>Workspaces</span>
        </Link>
        <div className="space-y-2">
          <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Workspaces
          </p>
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            Create a new workspace
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            Set up a fresh environment for your projects.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="grid w-full max-w-xl gap-4">
        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">
            Workspace name
          </span>
          <input
            type="text"
            autoFocus
            required
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="Engineering Team"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">
            Description (optional)
          </span>
          <input
            type="text"
            value={newWorkspaceDesc}
            onChange={(e) => setNewWorkspaceDesc(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="What is the purpose of this workspace?"
          />
        </label>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={!newWorkspaceName.trim()}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Create
          </button>
          <Link
            href="/workspace"
            className="inline-flex rounded-full border border-border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
