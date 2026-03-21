"use client";

import { useEffect, useMemo, useState } from "react";

type AccessTarget = "repository" | "profile";
type StoredFlowState = {
  repo: string;
  target: AccessTarget;
  isAuthorized: boolean;
  started: boolean;
};

const STORAGE_KEY = "neup.code.onboarding.github-flow.v1";

function normalizeRepo(repoInput: string) {
  const value = repoInput.trim();
  if (!value) return "";

  if (value.startsWith("https://github.com/")) {
    return value.replace("https://github.com/", "").replace(/\.git$/, "");
  }

  return value.replace(/\.git$/, "");
}

function isValidRepo(repoInput: string) {
  const normalized = normalizeRepo(repoInput);
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized);
}

export function GitHubRepoFlow() {
  const [repo, setRepo] = useState("");
  const [target, setTarget] = useState<AccessTarget>("repository");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [started, setStarted] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setIsStorageReady(true);
        return;
      }

      const parsed = JSON.parse(saved) as Partial<StoredFlowState>;
      if (typeof parsed.repo === "string") {
        setRepo(parsed.repo);
      }

      if (parsed.target === "repository" || parsed.target === "profile") {
        setTarget(parsed.target);
      }

      if (typeof parsed.isAuthorized === "boolean") {
        setIsAuthorized(parsed.isAuthorized);
      }

      if (typeof parsed.started === "boolean") {
        setStarted(parsed.started);
      }
    } catch {
      // Ignore malformed local storage payloads.
    } finally {
      setIsStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isStorageReady) return;

    const payload: StoredFlowState = {
      repo,
      target,
      isAuthorized,
      started,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [repo, target, isAuthorized, started, isStorageReady]);

  const normalizedRepo = useMemo(() => normalizeRepo(repo), [repo]);
  const validRepo = useMemo(() => isValidRepo(repo), [repo]);
  const canStart = validRepo && isAuthorized;

  async function authorizeGitHub() {
    if (!validRepo || isAuthorizing) return;

    setStarted(false);
    setIsAuthorizing(true);

    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });

    setIsAuthorizing(false);
    setIsAuthorized(true);
  }

  function startChanges() {
    if (!canStart) return;
    setStarted(true);
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1.2fr)_20rem]">
      <section className="space-y-6">
        <div className="space-y-5">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Step 1
            </p>
            <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.01em]">
              GitHub repository
            </h2>
            <p className="mt-1 text-[0.86rem] text-muted-foreground">
              Paste a GitHub URL or `owner/repo`.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Repository
            </span>
            <input
              value={repo}
              onChange={(event) => {
                setRepo(event.target.value);
                setIsAuthorized(false);
                setStarted(false);
              }}
              placeholder="owner/repository or https://github.com/owner/repository"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem] outline-none transition focus:border-foreground/30"
            />
            {!validRepo && repo.trim().length > 0 ? (
              <p className="mt-2 text-[0.78rem] text-rose-600">
                Use `owner/repository` format.
              </p>
            ) : null}
          </label>

          <div>
            <p className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Access target
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTarget("repository")}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  target === "repository"
                    ? "border-foreground/20 bg-muted"
                    : "border-border bg-background hover:bg-muted/60"
                }`}
              >
                <p className="text-[0.9rem] font-semibold">Repository</p>
                <p className="mt-1 text-[0.8rem] text-muted-foreground">
                  Read and write to the selected repository.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTarget("profile")}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  target === "profile"
                    ? "border-foreground/20 bg-muted"
                    : "border-border bg-background hover:bg-muted/60"
                }`}
              >
                <p className="text-[0.9rem] font-semibold">Profile</p>
                <p className="mt-1 text-[0.8rem] text-muted-foreground">
                  Read profile, then select repositories to grant.
                </p>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Step 2
            </p>
            <p className="mt-1 text-[0.88rem] text-foreground">
              Authorize GitHub with read and write access to your{" "}
              <span className="font-semibold">{target}</span>.
            </p>
            <button
              type="button"
              onClick={authorizeGitHub}
              disabled={!validRepo || isAuthorizing}
              className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAuthorizing
                ? "Authorizing..."
                : isAuthorized
                  ? "GitHub authorized"
                  : "Authorize with GitHub"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={startChanges}
              disabled={!canStart}
              className="inline-flex rounded-full bg-foreground px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start doing changes
            </button>
            <p className="text-[0.8rem] text-muted-foreground">
              {canStart
                ? "Repository and authorization confirmed."
                : "Complete repository and authorization first."}
            </p>
            <p className="w-full text-[0.75rem] text-muted-foreground/90">
              Progress is saved locally in this browser.
            </p>
          </div>
        </div>
      </section>

      <aside className="space-y-4 xl:pl-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Status
        </p>
        <ul className="mt-3 space-y-2.5">
          <li className="rounded-xl border border-border bg-background px-3 py-2.5">
            <p className="text-[0.82rem] font-medium text-muted-foreground">Repository</p>
            <p className="mt-1 text-[0.88rem] font-semibold">
              {validRepo ? normalizedRepo : "Waiting for repository"}
            </p>
          </li>
          <li className="rounded-xl border border-border bg-background px-3 py-2.5">
            <p className="text-[0.82rem] font-medium text-muted-foreground">Access target</p>
            <p className="mt-1 text-[0.88rem] font-semibold">
              {target === "repository" ? "Repository access" : "Profile access"}
            </p>
          </li>
          <li className="rounded-xl border border-border bg-background px-3 py-2.5">
            <p className="text-[0.82rem] font-medium text-muted-foreground">Authorization</p>
            <p className="mt-1 text-[0.88rem] font-semibold">
              {isAuthorized ? "Authorized" : "Not authorized"}
            </p>
          </li>
        </ul>

        {started ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Ready
            </p>
            <p className="mt-1 text-[0.86rem] text-emerald-800">
              Great. We can now start making changes in {normalizedRepo}.
            </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
