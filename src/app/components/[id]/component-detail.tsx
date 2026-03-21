"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COMPONENT_STORAGE_KEY,
  loadComponents,
  type ComponentItem,
} from "../component-storage";

type ComponentDetailProps = {
  id: string;
};

export function ComponentDetail({ id }: ComponentDetailProps) {
  const [component, setComponent] = useState<ComponentItem | null>(null);
  const [ready, setReady] = useState(false);
  const [expandedPartIds, setExpandedPartIds] = useState<string[]>([]);

  useEffect(() => {
    const allComponents = loadComponents();
    setComponent(allComponents.find((item) => item.id === id) ?? null);
    setReady(true);
  }, [id]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== COMPONENT_STORAGE_KEY) return;
      const allComponents = loadComponents();
      setComponent(allComponents.find((item) => item.id === id) ?? null);
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [id]);

  function togglePart(id: string) {
    setExpandedPartIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  if (!ready) {
    return <p className="text-[0.88rem] text-muted-foreground">Loading component...</p>;
  }

  if (!component) {
    return (
      <section className="space-y-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Components
        </p>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">Component not found</h1>
        <Link
          href="/components"
          className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
        >
          Back to components
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <Link
          href="/components"
          className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
        >
          <span aria-hidden="true">&lt;</span>
          <span>Components</span>
        </Link>
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            {component.name}
          </h1>
          {component.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {component.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-2 py-0.5 text-[0.72rem] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[0.88rem] text-muted-foreground">No tags added.</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[0.78rem] font-semibold text-muted-foreground">Component parts</p>
          <p className="mt-1 text-[0.84rem] text-muted-foreground">
            {component.parts.length
              ? `${component.parts.length} saved part${component.parts.length === 1 ? "" : "s"}.`
              : "No parts added yet."}
          </p>
        </div>

        <div className="grid gap-4">
          <Link
            href={`/components/${component.id}/add`}
            className="rounded-xl border border-border bg-background p-4 transition hover:border-foreground/20"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.84rem] font-semibold text-foreground">Add component part</p>
                <p className="mt-1 text-[0.84rem] text-muted-foreground">
                  Add a labeled code block to this component.
                </p>
              </div>
              <span className="pt-0.5 text-[1rem] leading-none text-muted-foreground">+</span>
            </div>
          </Link>

          {component.parts.length ? (
            component.parts.map((savedPart, index) => {
              const isExpanded = expandedPartIds.includes(savedPart.id);
              const codeLines = savedPart.code.split("\n");
              const previewCode =
                codeLines.length > 2 ? `${codeLines.slice(0, 2).join("\n")}\n...` : savedPart.code;

              return (
                <div
                  key={savedPart.id}
                  className="space-y-3 rounded-xl border border-border bg-background p-4"
                >
                  <button
                    type="button"
                    onClick={() => togglePart(savedPart.id)}
                    className="text-left text-[0.84rem] font-semibold text-foreground transition hover:text-muted-foreground"
                  >
                    {savedPart.label || `Component part ${index + 1}`}
                  </button>
                  {savedPart.description ? (
                    <p className="text-[0.84rem] text-muted-foreground">{savedPart.description}</p>
                  ) : null}
                  <pre className="overflow-x-auto whitespace-pre-wrap text-[0.82rem] text-foreground">
                    {isExpanded ? savedPart.code : previewCode}
                  </pre>
                </div>
              );
            })
          ) : null}
        </div>
      </div>
    </section>
  );
}
