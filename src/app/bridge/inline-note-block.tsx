"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActionMenu } from "../action-menu";
import { normalizeRichTextHtml, richTextHasContent, richTextToPlainText } from "./rich-text";

export type SlashCommand = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  sectionTitle?: string;
};

export type InlineNoteSplit = {
  beforeHtml: string;
  afterHtml: string;
  isAtStart: boolean;
  isAtEnd: boolean;
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
  onSplit?: (split: InlineNoteSplit) => void;
  onBackspaceAtStart?: () => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  commands?: SlashCommand[];
  onSelectCommand?: (commandId: string) => void;
  maxVisibleCommands?: number;
  onContextMenu?: (
    event: React.MouseEvent<HTMLDivElement>,
    details: {
      hasSelection: boolean;
      hasContent: boolean;
    },
  ) => void;
};

export type InlineNoteBlockHandle = {
  applyFormat: (format: "bold" | "italic" | "underline") => void;
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

export const InlineNoteBlock = forwardRef<InlineNoteBlockHandle, InlineNoteBlockProps>(function InlineNoteBlock({
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
  onContextMenu,
}, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const commandItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [dismissedSlashValue, setDismissedSlashValue] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const slashMenuQuery = useMemo(() => getSlashQuery(value), [value]);
  const slashQuery = slashMenuQuery ?? "";
  const isSlashMenuOpen = Boolean(
    slashMenuQuery !== null && commands.length && dismissedSlashValue !== value,
  );

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
  const visibleActiveCommandIndex = filteredCommands.length
    ? Math.min(activeCommandIndex, filteredCommands.length - 1)
    : 0;

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
    if (!isSlashMenuOpen) return;

    commandItemRefs.current[visibleActiveCommandIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [filteredCommands.length, isSlashMenuOpen, visibleActiveCommandIndex]);

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

  const syncValue = useCallback(() => {
    const nextValue = normalizeRichTextHtml(editorRef.current?.innerHTML ?? "");
    if (dismissedSlashValue !== null && dismissedSlashValue !== nextValue) {
      setDismissedSlashValue(null);
      setActiveCommandIndex(0);
    }
    onChange(nextValue);
  }, [dismissedSlashValue, onChange]);

  useImperativeHandle(
    ref,
    () => ({
      applyFormat(format) {
        if (typeof document === "undefined" || !editorRef.current) return;

        editorRef.current.focus();

        if (!restoreSavedSelection(savedSelectionRef.current, editorRef.current)) {
          selectAllEditorContents(editorRef.current);
        }

        document.execCommand(format);
        syncValue();
      },
    }),
    [syncValue],
  );

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (typeof document !== "undefined") {
      document.execCommand("insertText", false, text);
    }
    syncValue();
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    savedSelectionRef.current = getEditorSelectionRange(editorRef.current);
    onContextMenu?.(event, {
      hasSelection: Boolean(savedSelectionRef.current && !savedSelectionRef.current.collapsed),
      hasContent: richTextHasContent(value),
    });
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
        setDismissedSlashValue(value);
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const selectedCommand = filteredCommands[visibleActiveCommandIndex];
        if (selectedCommand) {
          setDismissedSlashValue(value);
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
    onSplit?.(getSplitAtSelection(editorRef.current, value));
  }

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      {!richTextHasContent(value) ? (
        <p
          className={`pointer-events-none absolute left-0 top-0 text-[0.96rem] leading-[1.7] text-foreground/40 ${editorClassName}`.trim()}
        >
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
        onContextMenu={handleContextMenu}
        className={`text-[0.96rem] leading-[1.7] text-foreground outline-none ${editorClassName}`.trim()}
      />

      {isSlashMenuOpen && filteredCommands.length ? (
        <ActionMenu
          ref={menuRef}
          items={filteredCommands.map((command) => ({
            id: command.id,
            label: command.label,
            description: command.description,
            sectionTitle: command.sectionTitle,
            interaction: "mousedown",
          }))}
          activeItemId={filteredCommands[visibleActiveCommandIndex]?.id ?? null}
          itemRefs={commandItemRefs}
          className="absolute z-40 w-[264px] overflow-y-auto pr-1"
          onSelectItem={(item) => {
            setDismissedSlashValue(value);
            onSelectCommand?.(item.id);
          }}
          style={
            menuPosition
              ? {
                  left: menuPosition.left,
                  top: menuPosition.top,
                  maxHeight: menuListMaxHeight ?? undefined,
                }
              : { left: -9999, top: -9999 }
          }
        />
      ) : null}
    </div>
  );
});

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

function getEditorSelectionRange(editor: HTMLDivElement | null) {
  if (!editor) return null;

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return null;
  }

  return range.cloneRange();
}

function restoreSavedSelection(range: Range | null, editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection) return false;

  if (range && editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  return false;
}

function selectAllEditorContents(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getSplitAtSelection(
  editor: HTMLDivElement | null,
  fallbackValue: string,
): InlineNoteSplit {
  const normalizedFallback = normalizeRichTextHtml(fallbackValue);

  if (!editor) {
    return {
      beforeHtml: normalizedFallback,
      afterHtml: "",
      isAtStart: !richTextHasContent(normalizedFallback),
      isAtEnd: true,
    };
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return {
      beforeHtml: normalizedFallback,
      afterHtml: "",
      isAtStart: !richTextHasContent(normalizedFallback),
      isAtEnd: true,
    };
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return {
      beforeHtml: normalizedFallback,
      afterHtml: "",
      isAtStart: !richTextHasContent(normalizedFallback),
      isAtEnd: true,
    };
  }

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(editor);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = document.createRange();
  afterRange.selectNodeContents(editor);
  afterRange.setStart(range.endContainer, range.endOffset);

  const beforeHtml = normalizeRichTextHtml(fragmentToHtml(beforeRange.cloneContents()));
  const afterHtml = normalizeRichTextHtml(fragmentToHtml(afterRange.cloneContents()));

  return {
    beforeHtml,
    afterHtml,
    isAtStart: !richTextHasContent(beforeHtml),
    isAtEnd: !richTextHasContent(afterHtml),
  };
}

function fragmentToHtml(fragment: DocumentFragment) {
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}
