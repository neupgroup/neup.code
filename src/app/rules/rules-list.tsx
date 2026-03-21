"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RULE_STORAGE_KEY, loadRules, saveRules, type RuleItem, type RulePreset } from "./rule-storage";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const presetCards: Array<{
  preset: Exclude<RulePreset, "custom">;
  title: string;
  description: string;
  content: string;
}> = [
  {
    preset: "gitignore",
    title: "Gitignore",
    description: "Create a rule for .gitignore patterns and repository ignore guidance.",
    content: [
      ".gitignore rules",
      "",
      "Set all repository ignore rules here.",
      "",
      "node_modules/",
      ".next/",
      "dist/",
      ".env",
    ].join("\n"),
  },
  {
    preset: "refactoring",
    title: "Refactoring",
    description: "Create a rule for function boundaries, sub-functions, and cleanup decisions.",
    content: [
      "Refactoring rules",
      "",
      "- Keep each function focused on one responsibility.",
      "- Break a function into sub-functions when it mixes concerns.",
      "- Extract repeated logic into a named helper when it improves readability.",
      "- Prefer small, readable steps over dense logic blocks.",
    ].join("\n"),
  },
  {
    preset: "formatting",
    title: "Formatting",
    description: "Create a rule for indentation, spacing, wrapping, and code layout decisions.",
    content: [
      "Formatting rules",
      "",
      "- Use consistent indentation.",
      "- Keep spacing predictable around operators and blocks.",
      "- Wrap long lines before they hurt readability.",
      "- Keep code layout easy to scan.",
    ].join("\n"),
  },
];

function buildRulePreview(content: string) {
  const firstMeaningfulLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstMeaningfulLine || "No rule content added yet.";
}

export function RulesList() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RuleItem[]>([]);
  const [ready, setReady] = useState(false);
  const availablePresetCards = presetCards.filter(
    (card) => !items.some((item) => item.preset === card.preset),
  );

  useEffect(() => {
    setItems(loadRules());
    setReady(true);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== RULE_STORAGE_KEY) return;
      setItems(loadRules());
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function createRule(nextTitle: string, preset: RulePreset, content: string) {
    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle) {
      setError("Rule title is required.");
      return;
    }

    const now = new Date().toISOString();
    const nextRule: RuleItem = {
      id: createId(),
      title: trimmedTitle,
      content,
      preset,
      createdAt: now,
      updatedAt: now,
    };

    const nextItems = [nextRule, ...loadRules()];
    saveRules(nextItems);
    setItems(nextItems);
    setTitle("");
    setError(null);
    router.push(`/rules/${nextRule.id}`);
    router.refresh();
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Rules
        </p>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">Rules</h1>
        <p className="max-w-2xl text-[0.9rem] text-muted-foreground">
          Create reusable rules for gitignore, refactoring, formatting, and any other codebase
          decisions you want to keep consistent.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-semibold text-muted-foreground">Rule title</span>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  createRule(title, "custom", "");
                }
              }}
              className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
              placeholder="Repository naming rules"
            />
          </label>
          <button
            type="button"
            onClick={() => createRule(title, "custom", "")}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90"
          >
            Create rule
          </button>
        </div>

        {error ? <p className="text-[0.78rem] text-rose-600">{error}</p> : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[0.78rem] font-semibold text-muted-foreground">Quick rule cards</p>
          <p className="mt-1 text-[0.84rem] text-muted-foreground">
            Clicking a card creates that rule immediately and opens it.
          </p>
        </div>

        {!ready ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`rule-card-skeleton-${index}`}
                aria-hidden="true"
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="h-4 w-28 rounded-full bg-muted" />
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-full rounded-full bg-muted" />
                  <div className="h-3 w-4/5 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : availablePresetCards.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {availablePresetCards.map((card) => (
              <button
                key={card.preset}
                type="button"
                onClick={() => createRule(card.title, card.preset, card.content)}
                className="rounded-xl border border-border bg-background p-4 text-left transition hover:border-foreground/20"
              >
                <p className="text-[0.96rem] font-semibold text-foreground">{card.title}</p>
                <p className="mt-2 text-[0.84rem] text-muted-foreground">{card.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[0.84rem] text-muted-foreground">
            All quick rule cards have already been created.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[0.78rem] font-semibold text-muted-foreground">Saved rules</p>
          <p className="mt-1 text-[0.84rem] text-muted-foreground">
            {ready
              ? items.length
                ? `${items.length} saved rule${items.length === 1 ? "" : "s"}.`
                : "No rules saved yet."
              : "Loading rules..."}
          </p>
        </div>

        {!ready ? (
          <p className="text-[0.88rem] text-muted-foreground">Loading rules...</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[0.88rem] text-muted-foreground">
            No rules saved yet. Create one above or use a quick rule card.
          </p>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/rules/${item.id}`}
                className="rounded-xl border border-border bg-background px-4 py-3"
              >
                <h2 className="text-[1rem] font-semibold">{item.title}</h2>
                <p className="mt-2 line-clamp-1 text-[0.84rem] text-muted-foreground">
                  {buildRulePreview(item.content)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
