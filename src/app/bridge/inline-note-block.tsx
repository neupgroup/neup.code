"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeRichTextHtml, richTextHasContent, richTextToPlainText } from "./rich-text";

export type SlashCommand = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
};

type InlineNoteBlockProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  autoFocus?: boolean;
  autoFocusPosition?: "start" | "end";
  onAutoFocusComplete?: () => void;
  onSplit?: () => void;
  onBackspaceAtStart?: () => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  commands?: SlashCommand[];
  onSelectCommand?: (commandId: string) => void;
  maxVisibleCommands?: number;
};

function isCaretAtStart(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return false;

  const probe = range.cloneRange();
  probe.selectNodeContents(element);
  probe.setEnd(range.startContainer, range.startOffset);

  return (probe.toString() ?? "").length === 0;
}

function isCaretAtEnd(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return false;

  const probe = range.cloneRange();
  probe.selectNodeContents(element);
  probe.setStart(range.startContainer, range.startOffset);

  return (probe.toString() ?? "").length === 0;
}

export function InlineNoteBlock({
  value,
  onChange,
  placeholder = "Type your note here...",
  className = "",
  editorClassName = "",
  autoFocus = false,
  autoFocusPosition = "end",
  onAutoFocusComplete,
  onSplit,
  onBackspaceAtStart,
  onNavigatePrevious,
  onNavigateNext,
  commands = [],
  onSelectCommand,
  maxVisibleCommands,
}: InlineNoteBlockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const commandItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [slashQuery, setSlashQuery] = useState("");
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = slashQuery.trim().toLowerCase();

    if (!normalizedQuery) return commands;

    return commands.filter((command) => {
      const haystack = [
        command.label,
        command.description ?? "",
        ...(command.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [commands, slashQuery]);

  const menuListMaxHeight =
    maxVisibleCommands && maxVisibleCommands > 0
      ? maxVisibleCommands * 64 + Math.max(0, maxVisibleCommands - 1) * 4
      : null;

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === value) return;
    editorRef.current.innerHTML = value;
  }, [value]);

  useEffect(() => {
    const nextQuery = getSlashQuery(value);
    setSlashQuery(nextQuery ?? "");
    setIsSlashMenuOpen(Boolean(nextQuery !== null && commands.length));
  }, [commands.length, value]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [slashQuery]);

  useEffect(() => {
    if (!isSlashMenuOpen) return;

    commandItemRefs.current[activeCommandIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeCommandIndex, filteredCommands.length, isSlashMenuOpen]);

  useEffect(() => {
    if (!isSlashMenuOpen || !containerRef.current || !menuRef.current) return;

    function updateMenuPosition() {
      if (!containerRef.current || !menuRef.current) return;

      const viewportPadding = 12;
      const gap = 8;
      const containerRect = containerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const caretAnchor =
        getSlashMenuAnchor(editorRef.current) ?? {
          left: containerRect.left,
          top: containerRect.top,
          bottom: containerRect.top + getEditorLineHeight(editorRef.current),
        };

      let left = caretAnchor.left - containerRect.left;
      let top = caretAnchor.bottom - containerRect.top + gap;

      const minLeft = viewportPadding - containerRect.left;
      const maxLeft = window.innerWidth - menuRect.width - viewportPadding - containerRect.left;

      if (left < minLeft) {
        left = minLeft;
      }

      if (left > maxLeft) {
        left = Math.max(minLeft, maxLeft);
      }

      if (containerRect.top + top + menuRect.height > window.innerHeight - viewportPadding) {
        top = Math.max(
          viewportPadding - containerRect.top,
          caretAnchor.top - containerRect.top - menuRect.height - gap,
        );
      }

      if (containerRect.top + top + menuRect.height > window.innerHeight - viewportPadding) {
        top = Math.max(
          viewportPadding - containerRect.top,
          window.innerHeight - menuRect.height - viewportPadding - containerRect.top,
        );
      }

      setMenuPosition({ left, top });
    }

    updateMenuPosition();
    document.addEventListener("selectionchange", updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("selectionchange", updateMenuPosition);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [filteredCommands.length, isSlashMenuOpen, value]);

  useEffect(() => {
    if (!autoFocus || !editorRef.current) return;

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(autoFocusPosition === "start");
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorRef.current.focus();
    onAutoFocusComplete?.();
  }, [autoFocus, autoFocusPosition, onAutoFocusComplete]);

  function updateSlashMenu(nextHtml: string) {
    const nextQuery = getSlashQuery(nextHtml);
    setSlashQuery(nextQuery ?? "");
    setIsSlashMenuOpen(Boolean(nextQuery !== null && commands.length));
  }

  function syncValue() {
    const nextValue = normalizeRichTextHtml(editorRef.current?.innerHTML ?? "");
    onChange(nextValue);
    updateSlashMenu(nextValue);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (typeof document !== "undefined") {
      document.execCommand("insertText", false, text);
    }
    syncValue();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (isSlashMenuOpen && filteredCommands.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommandIndex((current) => (current + 1) % filteredCommands.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommandIndex((current) =>
          current === 0 ? filteredCommands.length - 1 : current - 1,
        );
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsSlashMenuOpen(false);
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const selectedCommand = filteredCommands[activeCommandIndex];
        if (selectedCommand) {
          setIsSlashMenuOpen(false);
          onSelectCommand?.(selectedCommand.id);
        }
        return;
      }
    }

    if (event.key === "Backspace") {
      if (!editorRef.current || !isCaretAtStart(editorRef.current)) return;
      if (!richTextHasContent(value) || onBackspaceAtStart) {
        event.preventDefault();
        onBackspaceAtStart?.();
      }
      return;
    }

    if (
      (event.key === "ArrowLeft" || event.key === "ArrowUp") &&
      editorRef.current &&
      isCaretAtStart(editorRef.current)
    ) {
      event.preventDefault();
      onNavigatePrevious?.();
      return;
    }

    if (
      (event.key === "ArrowRight" || event.key === "ArrowDown") &&
      editorRef.current &&
      isCaretAtEnd(editorRef.current)
    ) {
      event.preventDefault();
      onNavigateNext?.();
      return;
    }

    if (event.key !== "Enter") return;

    if (event.shiftKey) {
      event.preventDefault();
      if (typeof document !== "undefined") {
        document.execCommand("insertLineBreak");
      }
      syncValue();
      return;
    }

    event.preventDefault();
    onSplit?.();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      {!richTextHasContent(value) ? (
        <p className="pointer-events-none absolute left-0 top-0 text-[0.96rem] text-muted-foreground">
          {placeholder}
        </p>
      ) : null}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncValue}
        onBlur={syncValue}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className={`text-[0.96rem] leading-[1.7] text-foreground outline-none ${editorClassName}`.trim()}
      />

      {isSlashMenuOpen && filteredCommands.length ? (
        <div
          ref={menuRef}
          className="absolute z-40 w-[264px] rounded-2xl border border-border bg-background p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
          style={
            menuPosition
              ? { left: menuPosition.left, top: menuPosition.top }
              : { left: -9999, top: -9999 }
          }
        >
          <div
            className="grid gap-1 overflow-y-auto pr-1"
            style={menuListMaxHeight ? { maxHeight: menuListMaxHeight } : undefined}
          >
            {filteredCommands.map((command, index) => (
              <button
                key={command.id}
                ref={(element) => {
                  commandItemRefs.current[index] = element;
                }}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setIsSlashMenuOpen(false);
                  onSelectCommand?.(command.id);
                }}
                className={`flex min-h-[64px] w-full flex-col rounded-xl px-3 py-2 text-left transition ${
                  index === activeCommandIndex ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <span className="text-[0.88rem] font-medium text-foreground">{command.label}</span>
                {command.description ? (
                  <span className="mt-0.5 text-[0.76rem] text-muted-foreground">
                    {command.description}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSlashQuery(html: string) {
  const plainText = richTextToPlainText(html);
  if (!plainText.startsWith("/")) return null;

  const query = plainText.slice(1);
  if (query.includes(" ") || query.includes("\n")) return null;

  return query;
}

function getEditorLineHeight(editor: HTMLDivElement | null) {
  if (!editor) return 24;
  const computedStyle = window.getComputedStyle(editor);
  const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
  if (Number.isFinite(parsedLineHeight)) return parsedLineHeight;
  return editor.getBoundingClientRect().height || 24;
}

function getSlashMenuAnchor(editor: HTMLDivElement | null) {
  if (!editor) return null;

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;

  const rect = getRangeRect(range) ?? getCollapsedCaretRect(range);
  if (!rect) return null;

  return {
    left: rect.left,
    top: rect.top,
    bottom: rect.bottom,
  };
}

function getRangeRect(range: Range) {
  const rects = Array.from(range.getClientRects());
  const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();

  if (!rect.width && !rect.height) return null;
  return rect;
}

function getCollapsedCaretRect(range: Range) {
  if (!range.collapsed) return null;

  const container = range.startContainer;

  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent ?? "";

    if (range.startOffset > 0) {
      const probe = document.createRange();
      probe.setStart(container, range.startOffset - 1);
      probe.setEnd(container, range.startOffset);
      const rect = getRangeRect(probe);
      if (rect) {
        return {
          left: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }
    }

    if (range.startOffset < text.length) {
      const probe = document.createRange();
      probe.setStart(container, range.startOffset);
      probe.setEnd(container, range.startOffset + 1);
      const rect = getRangeRect(probe);
      if (rect) {
        return {
          left: rect.left,
          top: rect.top,
          bottom: rect.bottom,
        };
      }
    }
  }

  return null;
}
