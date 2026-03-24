"use client";

import { useState } from "react";
import { InlineNoteBlock } from "../bridge/inline-note-block";

const EDITOR_STORAGE_KEY = "neup.code.editor-content";

export function EditorInstance() {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      return window.localStorage.getItem(EDITOR_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  function handleChange(nextValue: string) {
    setValue(nextValue);

    try {
      window.localStorage.setItem(EDITOR_STORAGE_KEY, nextValue);
    } catch {}
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Editor
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">Editor</h1>
      </div>

      <div className="rounded-2xl border border-border bg-background px-4 py-4">
        <InlineNoteBlock
          value={value}
          onChange={handleChange}
          placeholder="Start writing..."
          className="min-h-[65vh]"
          editorClassName="min-h-[65vh]"
          enterBehavior="lineBreak"
          autoFocus
        />
      </div>
    </section>
  );
}
