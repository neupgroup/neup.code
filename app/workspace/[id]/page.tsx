"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadWorkspaces, saveWorkspaces, type WorkspaceItem } from "../workspace-storage";

export default function WorkspaceDetail() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const [workspace, setWorkspace] = useState<WorkspaceItem | null>(null);
  const [shareEmail, setShareEmail] = useState("");

  useEffect(() => {
    const items = loadWorkspaces();
    const found = items.find((ws) => ws.id === workspaceId);
    if (!found) {
      router.push("/workspace");
    } else {
      setWorkspace(found);
    }
  }, [router, workspaceId]);

  if (!workspace) return null;

  function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!shareEmail.trim()) return;

    if (workspace && !workspace.sharedWith.includes(shareEmail.trim())) {
      const items = loadWorkspaces();
      const nextItems = items.map((ws) => {
        if (ws.id === workspaceId) {
          return {
            ...ws,
            sharedWith: [...ws.sharedWith, shareEmail.trim()],
          };
        }
        return ws;
      });

      saveWorkspaces(nextItems);
      setWorkspace({
        ...workspace,
        sharedWith: [...workspace.sharedWith, shareEmail.trim()],
      });
      setShareEmail("");
    }
  }

  function handleRemoveCollaborator(email: string) {
    if (workspace) {
      const items = loadWorkspaces();
      const nextItems = items.map((ws) => {
        if (ws.id === workspaceId) {
          return {
            ...ws,
            sharedWith: ws.sharedWith.filter((e) => e !== email),
          };
        }
        return ws;
      });

      saveWorkspaces(nextItems);
      setWorkspace({
        ...workspace,
        sharedWith: workspace.sharedWith.filter((e) => e !== email),
      });
    }
  }

  function handleDelete() {
    const confirmDelete = confirm("Are you sure you want to delete this workspace?");
    if (!confirmDelete) return;

    const items = loadWorkspaces();
    if (items.length <= 1) {
      alert("You cannot delete your only workspace.");
      return;
    }
    const nextItems = items.filter((ws) => ws.id !== workspaceId);
    saveWorkspaces(nextItems);
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
            Workspace Detail
          </p>
          <div className="flex items-center justify-between">
            <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
              {workspace.name}
            </h1>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:opacity-80"
            >
              Delete Workspace
            </button>
          </div>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            {workspace.description || "No description provided."}
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-xl gap-4 border-t border-border pt-7">
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">Collaborators</h2>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <span className="text-[0.85rem] font-medium text-foreground">Owner</span>
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              You
            </span>
          </div>
          {workspace.sharedWith.map((email) => (
            <div key={email} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
              <span className="text-[0.85rem] font-medium text-foreground">{email}</span>
              <button
                type="button"
                onClick={() => handleRemoveCollaborator(email)}
                className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:opacity-80"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleShare} className="mt-4 grid gap-4 rounded-lg border border-border bg-muted/20 p-5">
          <div className="space-y-1">
            <h2 className="text-[0.95rem] font-semibold text-foreground tracking-[-0.01em]">Invite to Workspace</h2>
            <p className="text-[0.84rem] text-muted-foreground">Share this environment with a collaborator via email.</p>
          </div>
          
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-semibold text-muted-foreground">
              Collaborator email
            </span>
            <input
              type="email"
              required
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
              placeholder="collaborator@example.com"
            />
          </label>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={!shareEmail.trim()}
              className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
