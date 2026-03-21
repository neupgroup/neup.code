"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  COMPONENT_STORAGE_KEY,
  loadComponents,
  saveComponents,
  type ComponentItem,
  type ComponentPart,
} from "../../component-storage";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createPart(): ComponentPart {
  return {
    id: createId(),
    label: "",
    description: "",
    code: "",
  };
}

type AddComponentPartFormProps = {
  id: string;
};

export function AddComponentPartForm({ id }: AddComponentPartFormProps) {
  const router = useRouter();
  const [component, setComponent] = useState<ComponentItem | null>(null);
  const [ready, setReady] = useState(false);
  const [part, setPart] = useState<ComponentPart>(createPart());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  function savePart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!component) return;

    if (!part.label.trim() || !part.code.trim()) {
      setError("Part label and code block are both required.");
      return;
    }

    setIsSaving(true);

    const nextPart: ComponentPart = {
      id: part.id,
      label: part.label.trim(),
      description: part.description?.trim() || undefined,
      code: part.code.trim(),
    };

    const allComponents = loadComponents();
    const nextComponents = allComponents.map((item) =>
      item.id === component.id ? { ...item, parts: [...item.parts, nextPart] } : item,
    );

    saveComponents(nextComponents);
    router.push(`/components/${component.id}`);
    router.refresh();
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
          href={`/components/${component.id}`}
          className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
        >
          <span aria-hidden="true">&lt;</span>
          <span>{component.name}</span>
        </Link>
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            Add component part
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            Add a labeled code block for {component.name}.
          </p>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={savePart}>
        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">Part label</span>
          <input
            value={part.label}
            onChange={(event) => {
              setPart((prev) => ({ ...prev, label: event.target.value }));
              setError(null);
            }}
            className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="html, css, tsx, logic, tokens..."
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">Description</span>
          <textarea
            value={part.description ?? ""}
            onChange={(event) => {
              setPart((prev) => ({ ...prev, description: event.target.value }));
              setError(null);
            }}
            className="min-h-24 w-full max-w-2xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="Short description for this part..."
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">Code block</span>
          <textarea
            value={part.code}
            onChange={(event) => {
              setPart((prev) => ({ ...prev, code: event.target.value }));
              setError(null);
            }}
            className="min-h-40 w-full max-w-3xl rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-[0.86rem]"
            placeholder={`<nav>\n  <!-- component code -->\n</nav>`}
          />
        </label>

        {error ? <p className="text-[0.78rem] text-rose-600">{error}</p> : null}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Add component part"}
          </button>
          <Link
            href={`/components/${component.id}`}
            className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold text-foreground transition hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
