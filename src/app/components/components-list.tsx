"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COMPONENT_STORAGE_KEY,
  loadComponents,
  type ComponentItem,
} from "./component-storage";
import { PageBlocksEditor } from "../page-blocks-editor";

export function ComponentsList() {
  const [items, setItems] = useState<ComponentItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(loadComponents());
    setReady(true);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== COMPONENT_STORAGE_KEY) return;
      setItems(loadComponents());
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Components
          </p>
          <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">Components</h1>
          <p className="mt-2 text-[0.9rem] text-muted-foreground">
            Create and save reusable component blocks in this browser.
          </p>
        </div>

        <Link
          href="/components/add"
          className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90"
        >
          Add component
        </Link>
      </div>

      {!ready ? (
        <p className="text-[0.88rem] text-muted-foreground">Loading components...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[0.88rem] text-muted-foreground">
          No components saved yet. Click <span className="font-semibold">Add component</span> to
          create the first one.
        </p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/components/${item.id}`}
              className="rounded-xl border border-border bg-background px-4 py-3"
            >
              <h2 className="text-[1rem] font-semibold">{item.name}</h2>

              <p className="mt-2 line-clamp-1 text-[0.84rem] text-muted-foreground">
                {item.description || "No description added."}
              </p>
            </Link>
          ))}
        </div>
      )}

      <PageBlocksEditor pageKey="components" />
    </section>
  );
}
