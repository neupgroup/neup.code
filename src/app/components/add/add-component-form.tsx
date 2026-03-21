"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  loadComponents,
  saveComponents,
  type ComponentItem,
} from "../component-storage";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type FormState = {
  name: string;
  description: string;
};

const INITIAL_STATE: FormState = {
  name: "",
  description: "",
};

type FormErrors = {
  name?: string;
};

export function AddComponentForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function validate() {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Component name is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function saveComponent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setIsSaving(true);

    const item: ComponentItem = {
      id: createId(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      tags: [],
      createdAt: new Date().toISOString(),
      parts: [],
    };

    saveComponents([item, ...loadComponents()]);
    router.push(`/components/${item.id}`);
    router.refresh();
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
            Add component
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            Start by saving the component name and description. After that, you can add one or
            more component parts on the component page.
          </p>
        </div>
      </div>

      <form className="grid gap-5" onSubmit={saveComponent}>
        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">
            Component name
          </span>
          <input
            value={form.name}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, name: event.target.value }));
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="Navigation"
          />
          {errors.name ? <span className="text-[0.78rem] text-rose-600">{errors.name}</span> : null}
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">
            Description
          </span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            className="min-h-24 w-full max-w-2xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="Short one-line description for this component..."
          />
        </label>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save component"}
          </button>
          <Link
            href="/components"
            className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
