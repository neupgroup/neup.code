"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RULE_STORAGE_KEY, loadRules, saveRules, type RuleItem } from "../rule-storage";

type RuleDetailProps = {
  id: string;
};

export function RuleDetail({ id }: RuleDetailProps) {
  const [rule, setRule] = useState<RuleItem | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const allRules = loadRules();
    const nextRule = allRules.find((item) => item.id === id) ?? null;
    setRule(nextRule);
    setTitle(nextRule?.title ?? "");
    setContent(nextRule?.content ?? "");
    setReady(true);
  }, [id]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== RULE_STORAGE_KEY) return;
      const allRules = loadRules();
      const nextRule = allRules.find((item) => item.id === id) ?? null;
      setRule(nextRule);
      setTitle(nextRule?.title ?? "");
      setContent(nextRule?.content ?? "");
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [id]);

  function saveRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rule) return;

    setIsSaving(true);
    const nextRules = loadRules().map((item) =>
      item.id === rule.id
        ? {
            ...item,
            title: title.trim() || item.title,
            content,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );

    saveRules(nextRules);
    const nextRule = nextRules.find((item) => item.id === rule.id) ?? null;
    setRule(nextRule);
    setTitle(nextRule?.title ?? "");
    setContent(nextRule?.content ?? "");
    setIsSaving(false);
  }

  if (!ready) {
    return <p className="text-[0.88rem] text-muted-foreground">Loading rule...</p>;
  }

  if (!rule) {
    return (
      <section className="space-y-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Rules
        </p>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">Rule not found</h1>
        <Link
          href="/rules"
          className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
        >
          Back to rules
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <Link
          href="/rules"
          className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
        >
          <span aria-hidden="true">&lt;</span>
          <span>Rules</span>
        </Link>
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            {rule.title}
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            Update the rule title and write the full rule content here.
          </p>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={saveRule}>
        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="Rule title"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">Rule content</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[340px] w-full max-w-4xl rounded-lg border border-border bg-background px-3 py-3 font-mono text-[0.88rem]"
            placeholder="Write the full rule here..."
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save rule"}
          </button>
        </div>
      </form>
    </section>
  );
}
