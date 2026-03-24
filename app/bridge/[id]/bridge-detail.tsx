"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BRIDGE_RUN_STORAGE_KEY,
  BRIDGE_STORAGE_KEY,
  deleteBridge,
  deleteBridgeRun,
  loadBridgeRuns,
  loadBridges,
  saveBridges,
  saveBridgeRuns,
  type BridgeKeyValueItem,
  type BridgeItem,
  type BridgeRunRecord,
} from "../bridge-storage";
import { InlineNoteBlock, type InlineNoteSplit, type SlashCommand } from "../../../components/editor/inline-note-block";
import { normalizeRichTextHtml, richTextHasContent, richTextToPlainText } from "../rich-text";
import {
  BRIDGE_SESSION_STORAGE_KEY,
  clearBridgeClipboard,
  loadBridgeSessionState,
  setBridgeClipboard,
  type BridgeSessionClipboardAction,
  type BridgeSessionClipboard,
} from "../session-manager";
import { getBridgeDocRootHref, getBridgeEntryHref, getChapterDocHref } from "../paths";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bridgeTypeLabel(type: BridgeItem["bridgeType"]) {
  if (type === "grpc") return "gRPC";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function bridgeEntryKindLabel(kind: BridgeItem["entryKind"]) {
  if (kind === "chapter") return "Chapter";
  if (kind === "note") return "Note";
  if (kind === "heading1") return "Heading 1";
  if (kind === "heading2") return "Heading 2";
  if (kind === "heading3") return "Heading 3";
  return "Bridge";
}

function isHeadingEntryKind(
  kind: BridgeItem["entryKind"],
): kind is "heading1" | "heading2" | "heading3" {
  return kind === "heading1" || kind === "heading2" || kind === "heading3";
}

function isTextEntryKind(
  kind: BridgeItem["entryKind"],
): kind is "note" | "heading1" | "heading2" | "heading3" {
  return kind === "note" || isHeadingEntryKind(kind);
}

type HeadingEntryKind = Extract<BridgeItem["entryKind"], "heading1" | "heading2" | "heading3">;

function headingEditorClassName(kind: BridgeItem["entryKind"]) {
  if (kind === "heading1") {
    return "text-[1.55rem] font-semibold tracking-[-0.02em] leading-[1.2]";
  }

  if (kind === "heading2") {
    return "text-[1.25rem] font-semibold tracking-[-0.018em] leading-[1.3]";
  }

  if (kind === "heading3") {
    return "text-[1.06rem] font-semibold tracking-[-0.012em] leading-[1.4]";
  }

  return "";
}

function textBlockPlaceholder(kind: BridgeItem["entryKind"]) {
  if (kind === "heading1") return "Heading 1";
  if (kind === "heading2") return "Heading 2";
  if (kind === "heading3") return "Heading 3";
  return "Continue typing, or type / for commands";
}

function bridgeCommandToEntryKind(command: string) {
  if (command === "/p") return "note" as const;
  if (command === "/h1" || command === "#") return "heading1" as const;
  if (command === "/h2" || command === "##") return "heading2" as const;
  if (command === "/h3" || command === "###") return "heading3" as const;
  return null;
}

function createCommandBlock(command: string, parentChapterId: string | null): BridgeItem | null {
  if (command === "/chapter") {
    return {
      ...createTextBlock("chapter", parentChapterId),
      name: "Untitled chapter",
    };
  }

  if (command === "/api") {
    return {
      ...createTextBlock("bridge", parentChapterId),
      name: "Untitled API bridge",
      bridgeType: "api",
      method: "GET",
    };
  }

  if (command === "/webhook") {
    return {
      ...createTextBlock("bridge", parentChapterId),
      name: "Untitled webhook bridge",
      bridgeType: "webhook",
    };
  }

  if (command === "/grpc") {
    return {
      ...createTextBlock("bridge", parentChapterId),
      name: "Untitled gRPC bridge",
      bridgeType: "grpc",
    };
  }

  return null;
}

const BRIDGE_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "p",
    label: "Paragraph",
    description: "Standard text block",
    keywords: ["p", "paragraph", "text"],
  },
  {
    id: "chapter",
    label: "Chapter",
    description: "Create a chapter block",
    keywords: ["chapter"],
  },
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "#", "heading"],
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    keywords: ["h2", "##", "heading"],
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small section heading",
    keywords: ["h3", "###", "heading"],
  },
  {
    id: "api",
    label: "API bridge",
    description: "Create an API bridge block",
    keywords: ["api", "http", "request"],
  },
  {
    id: "webhook",
    label: "Webhook bridge",
    description: "Create a webhook bridge block",
    keywords: ["webhook"],
  },
  {
    id: "grpc",
    label: "gRPC bridge",
    description: "Create a gRPC bridge block",
    keywords: ["grpc"],
  },
];

function createTextBlock(
  kind: BridgeItem["entryKind"] = "note",
  parentChapterId: string | null = null,
): BridgeItem {
  return {
    id: createId(),
    name: kind === "note" ? "Untitled note" : bridgeEntryKindLabel(kind),
    entryKind: kind,
    parentChapterId,
    bridgeType: "api",
    endpoint: "",
    environment: "development",
    createdAt: new Date().toISOString(),
  };
}

function ensureTrailingChapterNote(items: BridgeItem[], chapterId: string) {
  const chapterItems = items.filter((item) => item.parentChapterId === chapterId);
  const lastChapterItem = chapterItems[chapterItems.length - 1];

  if (lastChapterItem?.entryKind === "note") {
    return items;
  }

  const nextNote = createTextBlock("note", chapterId);

  if (!chapterItems.length) {
    return [...items, nextNote];
  }

  const lastChapterItemIndex = items.findLastIndex((item) => item.parentChapterId === chapterId);
  if (lastChapterItemIndex === -1) {
    return [...items, nextNote];
  }

  const nextItems = [...items];
  nextItems.splice(lastChapterItemIndex + 1, 0, nextNote);
  return nextItems;
}

function areSameBridgeOrder(left: BridgeItem[], right: BridgeItem[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item.id === right[index]?.id)
  );
}

function isModifierSelection(event: { ctrlKey: boolean; metaKey: boolean }) {
  return event.ctrlKey || event.metaKey;
}

function duplicateKeyValueItems(items?: BridgeKeyValueItem[]) {
  return items?.map((item) => ({
    id: createId(),
    key: item.key,
    value: item.value,
  }));
}

function duplicateBridgeItem(bridge: BridgeItem): BridgeItem {
  return {
    ...bridge,
    id: createId(),
    name: `${bridge.name} Copy`,
    createdAt: new Date().toISOString(),
    chapterBlockIds: [],
    apiConfig: bridge.apiConfig
      ? {
          ...bridge.apiConfig,
          headers: duplicateKeyValueItems(bridge.apiConfig.headers) ?? [],
          queryParams: duplicateKeyValueItems(bridge.apiConfig.queryParams) ?? [],
          formData: duplicateKeyValueItems(bridge.apiConfig.formData) ?? [],
        }
      : undefined,
    requiredFields: duplicateKeyValueItems(bridge.requiredFields),
  };
}

function buildRunOutput(bridge: BridgeItem) {
  const lines = [
    `Bridge "${bridge.name}" executed.`,
    `Type: ${bridgeTypeLabel(bridge.bridgeType)}`,
    `Endpoint: ${bridge.endpoint}`,
    `Environment: ${bridge.environment}`,
  ];

  if (bridge.method) {
    lines.push(`Method: ${bridge.method}`);
  }

  if (bridge.serviceName) {
    lines.push(`Service: ${bridge.serviceName}`);
  }

  if (bridge.requiredFields?.length) {
    lines.push(`Required fields: ${bridge.requiredFields.length}`);
  }

  if (bridge.apiConfig) {
    lines.push(`Headers: ${bridge.apiConfig.headers.length}`);
    lines.push(`Query params: ${bridge.apiConfig.queryParams.length}`);
    lines.push(`Form data fields: ${bridge.apiConfig.formData.length}`);
    lines.push(`Body type: ${bridge.apiConfig.bodyType}`);
  }

  return lines.join("\n");
}

function keyValueItemsToUrl(url: string, items: BridgeKeyValueItem[]) {
  const nextUrl = new URL(url);

  for (const item of items) {
    if (!item.key.trim()) continue;
    nextUrl.searchParams.append(item.key.trim(), item.value);
  }

  return nextUrl.toString();
}

function cleanHeaderItems(items: BridgeKeyValueItem[]) {
  return items.filter((item) => item.key.trim().length > 0);
}

function cleanKeyValueItems(items: BridgeKeyValueItem[]) {
  return items.filter((item) => item.key.trim().length > 0 || item.value.trim().length > 0);
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

type BridgeDetailProps = {
  id: string;
};

export function BridgeDetail({ id }: BridgeDetailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [bridge, setBridge] = useState<BridgeItem | null>(null);
  const [parentBridge, setParentBridge] = useState<BridgeItem | null>(null);
  const [ready, setReady] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [clipboard, setClipboard] = useState<BridgeSessionClipboard | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetId?: string | null;
  } | null>(null);
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [selectedChapterBlockIds, setSelectedChapterBlockIds] = useState<string[]>([]);
  const [deleteChapterBlockIds, setDeleteChapterBlockIds] = useState<string[]>([]);
  const [isDeletingChapterBlocks, setIsDeletingChapterBlocks] = useState(false);
  const [focusedChildNoteTarget, setFocusedChildNoteTarget] = useState<{
    id: string;
    position: "start" | "end";
  } | null>(null);
  const [runRecord, setRunRecord] = useState<BridgeRunRecord>({
    bridgeId: id,
    status: "idle",
  });
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const hasRunActivity = runRecord.status !== "idle";
  const isBridgeEntry = (bridge?.entryKind ?? "bridge") === "bridge";
  const apiHeaders = bridge?.apiConfig ? cleanKeyValueItems(bridge.apiConfig.headers) : [];
  const apiQueryParams = bridge?.apiConfig ? cleanKeyValueItems(bridge.apiConfig.queryParams) : [];
  const apiFormData = bridge?.apiConfig ? cleanKeyValueItems(bridge.apiConfig.formData) : [];
  const requiredFields = bridge?.requiredFields ? cleanKeyValueItems(bridge.requiredFields) : [];
  const hasRequestBody =
    bridge?.apiConfig?.bodyType !== "none" && Boolean(bridge?.apiConfig?.body);
  const normalizedPrivateNote = normalizeRichTextHtml(bridge?.privateNote ?? "");
  const normalizedPublicNote = normalizeRichTextHtml(bridge?.publicNote ?? bridge?.notes ?? "");
  const chapterBlocks =
    bridge?.entryKind === "chapter"
      ? loadBridges().filter((item) => item.parentChapterId === bridge.id)
      : [];

  const syncBridgeState = useCallback((targetId = id) => {
    const loadedBridges = loadBridges();
    const loadedBridge = loadedBridges.find((item) => item.id === targetId) ?? null;

    let normalizedBridges = loadedBridges;
    if (loadedBridge?.entryKind === "chapter") {
      normalizedBridges = ensureTrailingChapterNote(loadedBridges, loadedBridge.id);
      if (!areSameBridgeOrder(loadedBridges, normalizedBridges)) {
        saveBridges(normalizedBridges);
      }
    }

    const nextBridge = normalizedBridges.find((item) => item.id === targetId) ?? null;
    setBridge(nextBridge);
    setParentBridge(
      nextBridge?.parentChapterId
        ? normalizedBridges.find((item) => item.id === nextBridge.parentChapterId) ?? null
        : null,
    );
  }, [id]);

  function persistChapterBridges(nextBridges: BridgeItem[]) {
    if (!bridge || bridge.entryKind !== "chapter") {
      saveBridges(nextBridges);
      syncBridgeState();
      return nextBridges;
    }

    const normalizedBridges = ensureTrailingChapterNote(nextBridges, bridge.id);
    saveBridges(normalizedBridges);
    syncBridgeState();
    return normalizedBridges;
  }

  function saveClipboardSelection(
    action: BridgeSessionClipboardAction,
    targetBlocks: BridgeItem[],
  ) {
    if (!targetBlocks.length) return;

    const nextClipboard: BridgeSessionClipboard = {
      action,
      createdAt: new Date().toISOString(),
      items: targetBlocks.map((item) => ({
        id: item.id,
        name: item.name,
        entryKind: item.entryKind ?? "bridge",
      })),
    };

    setBridgeClipboard(nextClipboard);
    setClipboard(nextClipboard);
    setSelectedChapterBlockIds(targetBlocks.map((item) => item.id));
    setContextMenu(null);
  }

  function getContextBlock() {
    if (!contextMenu?.targetId) return null;
    return chapterBlocks.find((item) => item.id === contextMenu.targetId) ?? null;
  }

  function toggleChapterBlockSelection(blockId: string) {
    setSelectedChapterBlockIds((current) =>
      current.includes(blockId)
        ? current.filter((id) => id !== blockId)
        : [...current, blockId],
    );
  }

  function getActionTargetBlocks(contextBlockId: string) {
    const targetIds = selectedChapterBlockIds.includes(contextBlockId)
      ? selectedChapterBlockIds
      : [contextBlockId];

    return chapterBlocks.filter((item) => targetIds.includes(item.id));
  }

  function updateNoteContent(value: string) {
    if (!bridge || bridge.entryKind !== "note") return;

    const normalizedValue = normalizeRichTextHtml(value);
    const nextBridge: BridgeItem = {
      ...bridge,
      publicNote: normalizedValue || undefined,
      notes: undefined,
    };

    const allBridges = loadBridges();
    const nextBridges = allBridges.map((item) => (item.id === bridge.id ? nextBridge : item));
    saveBridges(nextBridges);
    setBridge(nextBridge);
    setParentBridge(
      nextBridge.parentChapterId
        ? allBridges.find((item) => item.id === nextBridge.parentChapterId) ?? null
        : null,
    );
  }

  function updateChildNoteContent(noteId: string, value: string) {
    const normalizedValue = normalizeRichTextHtml(value);
    const allBridges = loadBridges();
    const nextBridges = allBridges.map((item) =>
      item.id === noteId
        ? {
            ...item,
            publicNote: normalizedValue || undefined,
            notes: undefined,
          }
        : item,
    );

    persistChapterBridges(nextBridges);
  }

  function handleChildTextBlockSplit(blockId: string, split: InlineNoteSplit) {
    const allBridges = loadBridges();
    const currentBlock = allBridges.find((item) => item.id === blockId);
    if (!bridge || !currentBlock || !isTextEntryKind(currentBlock.entryKind)) return;

    if (currentBlock.entryKind === "note") {
      const command = richTextToPlainText(split.beforeHtml);
      const nextKind: HeadingEntryKind | "note" | null = !richTextHasContent(split.afterHtml)
        ? bridgeCommandToEntryKind(command)
        : null;

      if (nextKind) {
        const nextBridges = allBridges.map((item) =>
          item.id === blockId
            ? {
                ...item,
                name: nextKind === "note" ? "Untitled note" : bridgeEntryKindLabel(nextKind),
                entryKind: nextKind,
                publicNote: undefined,
                notes: undefined,
              }
            : item,
        );

        persistChapterBridges(nextBridges);
        setFocusedChildNoteTarget({ id: blockId, position: "end" });
        return;
      }

      const commandBlock = createCommandBlock(command, bridge.id);
      if (commandBlock) {
        const sourceIndex = allBridges.findIndex((item) => item.id === blockId);
        if (sourceIndex === -1) return;

        const nextNote = createTextBlock("note", bridge.id);
        const nextBridges = [...allBridges];
        nextBridges.splice(sourceIndex, 1, commandBlock, nextNote);
        persistChapterBridges(nextBridges);
        setFocusedChildNoteTarget({ id: nextNote.id, position: "end" });
        return;
      }
    }

    const sourceIndex = allBridges.findIndex((item) => item.id === blockId);
    if (sourceIndex === -1) return;

    const nextNote = {
      ...createTextBlock("note", bridge.id),
      publicNote: normalizeRichTextHtml(split.afterHtml) || undefined,
      notes: undefined,
    };
    const nextBridges = allBridges.map((item) =>
      item.id === blockId
        ? {
            ...item,
            publicNote: normalizeRichTextHtml(split.beforeHtml) || undefined,
            notes: undefined,
          }
        : item,
    );

    nextBridges.splice(sourceIndex + 1, 0, nextNote);
    persistChapterBridges(nextBridges);
    setFocusedChildNoteTarget({ id: nextNote.id, position: "start" });
  }

  function handleChildSlashCommandSelection(blockId: string, commandId: string) {
    const allBridges = loadBridges();
    const currentBlock = allBridges.find((item) => item.id === blockId);
    if (!bridge || !currentBlock) return;

    const nextKind: HeadingEntryKind | "note" | null =
      commandId === "p"
        ? "note"
        : commandId === "h1"
        ? "heading1"
        : commandId === "h2"
          ? "heading2"
          : commandId === "h3"
            ? "heading3"
            : null;

    if (nextKind) {
      const nextBridges = allBridges.map((item) =>
        item.id === blockId
          ? {
              ...item,
              name: nextKind === "note" ? "Untitled note" : bridgeEntryKindLabel(nextKind),
              entryKind: nextKind,
              publicNote: undefined,
              notes: undefined,
            }
          : item,
      );

      persistChapterBridges(nextBridges);
      setFocusedChildNoteTarget({ id: blockId, position: "end" });
      return;
    }

    const commandBlock = createCommandBlock(`/${commandId}`, bridge.id);
    if (!commandBlock) return;

    const nextNote = createTextBlock("note", bridge.id);
    const sourceIndex = allBridges.findIndex((item) => item.id === blockId);
    if (sourceIndex === -1) return;

    const nextBridges = [...allBridges];
    nextBridges.splice(sourceIndex, 1, commandBlock, nextNote);
    persistChapterBridges(nextBridges);
    setFocusedChildNoteTarget({ id: nextNote.id, position: "end" });
  }

  function removeChildNote(noteId: string) {
    deleteBridgeRun(noteId);
    const nextBridges = loadBridges().filter((item) => item.id !== noteId);
    persistChapterBridges(nextBridges);
  }

  function mergeChildNoteBackward(noteId: string) {
    const currentBridges = loadBridges();
    const currentNote = currentBridges.find((item) => item.id === noteId);
    if (!bridge || !currentNote || !isTextEntryKind(currentNote.entryKind)) return;

    const chapterItems = currentBridges.filter((item) => item.parentChapterId === bridge.id);
    const currentIndex = chapterItems.findIndex((item) => item.id === noteId);
    if (currentIndex === -1) return;

    const previousBlock = currentIndex > 0 ? chapterItems[currentIndex - 1] : null;
    const currentContent = currentNote.publicNote ?? currentNote.notes ?? "";

    if (!richTextHasContent(currentContent)) {
      removeChildNote(noteId);
      if (previousBlock && isTextEntryKind(previousBlock.entryKind)) {
        setFocusedChildNoteTarget({ id: previousBlock.id, position: "end" });
      }
      return;
    }

    if (!previousBlock || previousBlock.entryKind !== "note") return;

    const previousContent = previousBlock.publicNote ?? previousBlock.notes ?? "";
    const mergedContent = `${previousContent}${currentContent}`;
    const nextBridges = currentBridges
      .map((item) =>
        item.id === previousBlock.id
          ? {
              ...item,
              publicNote: mergedContent || undefined,
              notes: undefined,
            }
          : item,
      )
      .filter((item) => item.id !== noteId);

    persistChapterBridges(nextBridges);
    deleteBridgeRun(noteId);
    setFocusedChildNoteTarget({ id: previousBlock.id, position: "end" });
  }

  useEffect(() => {
    syncBridgeState();
    setClipboard(loadBridgeSessionState().clipboard ?? null);

    const runMap = loadBridgeRuns();
    setRunRecord(runMap[id] ?? { bridgeId: id, status: "idle" });
    setReady(true);
  }, [id, syncBridgeState]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === BRIDGE_STORAGE_KEY) {
        syncBridgeState();
      }

      if (event.key === BRIDGE_RUN_STORAGE_KEY) {
        const runMap = loadBridgeRuns();
        setRunRecord(runMap[id] ?? { bridgeId: id, status: "idle" });
      }

      if (event.key === BRIDGE_SESSION_STORAGE_KEY) {
        setClipboard(loadBridgeSessionState().clipboard ?? null);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [id, syncBridgeState]);

  useEffect(() => {
    function closeMenus() {
      setContextMenu(null);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenus();
      }
    }

    window.addEventListener("click", closeMenus);
    window.addEventListener("scroll", closeMenus, true);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("click", closeMenus);
      window.removeEventListener("scroll", closeMenus, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (!bridge || bridge.entryKind !== "chapter") return;
    const targetHref = getChapterDocHref(bridge.id);
    const currentSearch = typeof window !== "undefined" ? window.location.search : "";
    const isOnTargetRoute =
      pathname === "/doc" &&
      new URLSearchParams(currentSearch).get("id") === bridge.id &&
      new URLSearchParams(currentSearch).get("block") === "chapter";

    if (!isOnTargetRoute) {
      router.replace(targetHref);
    }
  }, [bridge, pathname, router]);

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    function updateContextMenuPosition() {
      if (!contextMenuRef.current || !contextMenu) return;

      const viewportPadding = 12;
      const menuRect = contextMenuRef.current.getBoundingClientRect();
      const left = Math.max(
        viewportPadding,
        Math.min(contextMenu.x, window.innerWidth - menuRect.width - viewportPadding),
      );
      const top = Math.max(
        viewportPadding,
        Math.min(contextMenu.y, window.innerHeight - menuRect.height - viewportPadding),
      );

      setContextMenuPosition({ left, top });
    }

    updateContextMenuPosition();
    window.addEventListener("resize", updateContextMenuPosition);
    window.addEventListener("scroll", updateContextMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateContextMenuPosition);
      window.removeEventListener("scroll", updateContextMenuPosition, true);
    };
  }, [contextMenu]);

  async function runBridge() {
    if (!bridge) return;

    const runningRecord: BridgeRunRecord = {
      bridgeId: bridge.id,
      status: "running",
      lastRunAt: new Date().toISOString(),
      output: "Running bridge...",
    };

    setRunRecord(runningRecord);
    const runningMap = loadBridgeRuns();
    saveBridgeRuns({ ...runningMap, [bridge.id]: runningRecord });

    try {
      const startedAt = performance.now();
      let requestUrl = bridge.endpoint;
      let response: Response;

      if (bridge.bridgeType === "grpc") {
        throw new Error("gRPC bridge execution is not supported directly in the browser.");
      }

      if (bridge.bridgeType === "api") {
        requestUrl = bridge.apiConfig
          ? keyValueItemsToUrl(bridge.endpoint, bridge.apiConfig.queryParams)
          : bridge.endpoint;

        const headers = new Headers();
        if (bridge.apiConfig) {
          for (const item of cleanHeaderItems(bridge.apiConfig.headers)) {
            headers.append(item.key.trim(), item.value);
          }
        }

        let body: BodyInit | undefined;
        if (bridge.apiConfig?.formData.length) {
          const formData = new FormData();
          for (const item of bridge.apiConfig.formData) {
            if (!item.key.trim()) continue;
            formData.append(item.key.trim(), item.value);
          }
          body = formData;
        } else if (bridge.apiConfig?.bodyType === "json" && bridge.apiConfig.body) {
          if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
          }
          body = bridge.apiConfig.body;
        } else if (bridge.apiConfig?.bodyType === "raw" && bridge.apiConfig.body) {
          body = bridge.apiConfig.body;
        }

        response = await fetch(requestUrl, {
          method: bridge.method ?? "GET",
          headers,
          body,
        });
      } else if (bridge.bridgeType === "webhook") {
        const headers = new Headers();
        headers.set("content-type", "application/json");
        if (bridge.secret) {
          headers.set("x-webhook-secret", bridge.secret);
        }

        response = await fetch(bridge.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            bridgeId: bridge.id,
            name: bridge.name,
            timestamp: new Date().toISOString(),
          }),
        });
      } else {
        const headers = new Headers();
        if (bridge.secret) {
          headers.set("x-handshake-key", bridge.secret);
        }

        response = await fetch(bridge.endpoint, {
          method: "POST",
          headers,
        });
      }

      const bodyText = await readResponseBody(response);
      const durationMs = Math.round(performance.now() - startedAt);
      const responseHeaders = Array.from(response.headers.entries()).map(([key, value]) => ({
        id: `${key}-${value}`,
        key,
        value,
      }));

      const nextRecord: BridgeRunRecord = {
        bridgeId: bridge.id,
        status: response.ok ? "success" : "error",
        lastRunAt: new Date().toISOString(),
        output: buildRunOutput(bridge),
        response: {
          requestUrl,
          statusCode: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: bodyText || "No response body",
          durationMs,
        },
      };

      setRunRecord(nextRecord);
      const nextMap = loadBridgeRuns();
      saveBridgeRuns({ ...nextMap, [bridge.id]: nextRecord });
    } catch (error) {
      const nextRecord: BridgeRunRecord = {
        bridgeId: bridge.id,
        status: "error",
        lastRunAt: new Date().toISOString(),
        output: buildRunOutput(bridge),
        response: {
          requestUrl: bridge.endpoint,
          body: error instanceof Error ? error.message : "Unknown bridge run error",
        },
      };

      setRunRecord(nextRecord);
      const nextMap = loadBridgeRuns();
      saveBridgeRuns({ ...nextMap, [bridge.id]: nextRecord });
    }
  }

  function removeBridge() {
    if (!bridge || isDeleting) return;

    setIsDeleting(true);
    deleteBridge(bridge.id);
    deleteBridgeRun(bridge.id);
    setIsDeleteDialogOpen(false);
    router.push(parentBridge ? getChapterDocHref(parentBridge.id) : getBridgeDocRootHref());
    router.refresh();
  }

  function duplicateBridge() {
    if (!bridge || isDuplicating) return;

    setIsDuplicating(true);
    const allBridges = loadBridges();
    const duplicatedBridge = duplicateBridgeItem(bridge);
    saveBridges([duplicatedBridge, ...allBridges]);
    router.push(`/bridge/${duplicatedBridge.id}/edit`);
    router.refresh();
  }

  function pasteIntoChapter() {
    if (!bridge || bridge.entryKind !== "chapter" || !clipboard?.items.length) return;

    const clipboardIds = clipboard.items
      .map((item) => item.id)
      .filter((clipboardId) => clipboardId !== bridge.id);

    const allBridges = loadBridges();
    const nextBridges = allBridges.map((item) =>
      clipboardIds.includes(item.id)
        ? {
            ...item,
            parentChapterId: bridge.id,
          }
        : item,
    );

    persistChapterBridges(nextBridges);
    clearBridgeClipboard();
    setClipboard(null);
    setContextMenu(null);
    setPasteMessage(
      clipboard.items.length === 1
        ? `${clipboard.items[0]?.name ?? "Item"} pasted into ${bridge.name}.`
        : `${clipboard.items.length} items pasted into ${bridge.name}.`,
    );
    window.setTimeout(() => setPasteMessage(null), 2200);
  }

  function handleCutBlock(blockId: string) {
    saveClipboardSelection("cut", getActionTargetBlocks(blockId));
  }

  function handleCopyBlock(blockId: string) {
    saveClipboardSelection("copy", getActionTargetBlocks(blockId));
  }

  function openDeleteBlocksDialog(blockId: string) {
    const targets = getActionTargetBlocks(blockId);
    if (!targets.length) return;

    setDeleteChapterBlockIds(targets.map((item) => item.id));
    setContextMenu(null);
  }

  function handleDuplicateBlock(block: BridgeItem) {
    const duplicatedBlock = {
      ...duplicateBridgeItem(block),
      parentChapterId: bridge?.entryKind === "chapter" ? bridge.id : block.parentChapterId ?? null,
    };

    const allBridges = loadBridges();
    const sourceIndex = allBridges.findIndex((item) => item.id === block.id);
    if (sourceIndex === -1) return;

    const nextBridges = [...allBridges];
    nextBridges.splice(sourceIndex + 1, 0, duplicatedBlock);
    persistChapterBridges(nextBridges);
    setContextMenu(null);
  }

  function removeChapterBlocks() {
    if (!deleteChapterBlockIds.length || isDeletingChapterBlocks) return;

    setIsDeletingChapterBlocks(true);

    for (const blockId of deleteChapterBlockIds) {
      deleteBridgeRun(blockId);
    }

    const nextBridges = loadBridges().filter((item) => !deleteChapterBlockIds.includes(item.id));
    persistChapterBridges(nextBridges);
    setSelectedChapterBlockIds((current) =>
      current.filter((item) => !deleteChapterBlockIds.includes(item)),
    );
    setDeleteChapterBlockIds([]);
    setIsDeletingChapterBlocks(false);
  }

  if (!ready) {
    return (
      <section>
        <p className="text-[0.9rem] text-muted-foreground">Loading bridge...</p>
      </section>
    );
  }

  if (!bridge) {
    return (
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Bridge
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">
          Bridge not found
        </h1>
        <p className="mt-2 text-[0.9rem] text-muted-foreground">
          This bridge does not exist in browser storage.
        </p>
        <Link
          href={getBridgeDocRootHref()}
          className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
        >
          Back to bridge
        </Link>
      </section>
    );
  }

  const backHref = parentBridge ? getChapterDocHref(parentBridge.id) : getBridgeDocRootHref();
  const backLabel = parentBridge ? parentBridge.name : "Bridge";
  const contextBlock = getContextBlock();
  const deleteChapterBlocks = chapterBlocks.filter((item) => deleteChapterBlockIds.includes(item.id));

  function focusPreviousChildNote(noteId: string) {
    const currentIndex = chapterBlocks.findIndex((item) => item.id === noteId);
    if (currentIndex <= 0) return;

    const previousBlock = chapterBlocks[currentIndex - 1];
    if (!previousBlock || !isTextEntryKind(previousBlock.entryKind)) return;

    setFocusedChildNoteTarget({ id: previousBlock.id, position: "end" });
  }

  function focusNextChildNote(noteId: string) {
    const currentIndex = chapterBlocks.findIndex((item) => item.id === noteId);
    if (currentIndex === -1 || currentIndex >= chapterBlocks.length - 1) return;

    const nextBlock = chapterBlocks[currentIndex + 1];
    if (!nextBlock || !isTextEntryKind(nextBlock.entryKind)) return;

    setFocusedChildNoteTarget({ id: nextBlock.id, position: "start" });
  }

  return (
    <section className={isBridgeEntry ? "space-y-7" : "space-y-2.5"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className={isBridgeEntry ? "" : "space-y-0.5"}>
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
            >
              <span aria-hidden="true">&lt;</span>
              <span>{backLabel}</span>
            </Link>
            <div className={`${isBridgeEntry ? "mt-3" : "mt-0.5"} flex flex-wrap items-center gap-3`}>
              <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">
                {bridge.name}
              </h1>
              {isBridgeEntry ? (
                <button
                  type="button"
                  onClick={runBridge}
                  disabled={runRecord.status === "running"}
                  aria-label="Run bridge"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                  >
                    <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                  </svg>
                </button>
              ) : null}
            </div>
            {isBridgeEntry ? (
              <p className="mt-1 text-[0.88rem] text-muted-foreground">{bridge.endpoint}</p>
            ) : null}
          </div>
        </div>

        {isBridgeEntry ? (
          <div className="flex flex-wrap gap-2 text-[0.75rem] text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">
              {bridgeEntryKindLabel(bridge.entryKind)}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5">
              {bridgeTypeLabel(bridge.bridgeType)}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5">
              {bridge.environment}
            </span>
            {bridge.method ? (
              <span className="rounded-full border border-border px-2 py-0.5">
                {bridge.method}
              </span>
            ) : null}
            {bridge.serviceName ? (
              <span className="rounded-full border border-border px-2 py-0.5">
                {bridge.serviceName}
              </span>
            ) : null}
          </div>
        ) : null}

        {bridge.entryKind === "note" ? (
          <InlineNoteBlock
            value={normalizedPublicNote}
            onChange={updateNoteContent}
            className="pt-3"
            maxVisibleCommands={4}
          />
        ) : null}

        {bridge.entryKind === "chapter" && richTextHasContent(normalizedPublicNote) ? (
          <div
            className="pt-0"
            onContextMenu={(event) => {
              if (bridge.entryKind !== "chapter") return;
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY, targetId: null });
            }}
          >
            <div
              className="prose prose-sm max-w-none text-[0.88rem] text-foreground"
              dangerouslySetInnerHTML={{ __html: normalizedPublicNote }}
            />
          </div>
        ) : null}

        {bridge.entryKind === "chapter" ? (
          <div
            className="grid gap-3 pt-0"
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY, targetId: null });
            }}
          >
            {pasteMessage ? (
              <p className="text-[0.84rem] text-muted-foreground">{pasteMessage}</p>
            ) : null}

            <Link
              href={`/bridge/add?chapter=${bridge.id}`}
              className="block rounded-xl border border-border bg-background p-4 transition hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.84rem] font-semibold text-foreground">Add a bridge</p>
                  <p className="mt-1 text-[0.84rem] text-muted-foreground">
                    Create a new bridge connection and configure its request flow.
                  </p>
                </div>
                <span className="pt-0.5 text-[1rem] leading-none text-muted-foreground">+</span>
              </div>
            </Link>

            {chapterBlocks.length ? (
              <div className="grid gap-3">
                {chapterBlocks.map((block) =>
                  isTextEntryKind(block.entryKind) ? (
                    <div
                      key={block.id}
                      className={`rounded-xl px-1 py-1 ${
                        selectedChapterBlockIds.includes(block.id) ? "border border-sky-400 ring-2 ring-sky-200" : ""
                      }`}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedChapterBlockIds((current) =>
                          current.includes(block.id) ? current : [block.id],
                        );
                        setContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          targetId: block.id,
                        });
                      }}
                      onClickCapture={(event) => {
                        if (!isModifierSelection(event)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setContextMenu(null);
                        toggleChapterBlockSelection(block.id);
                      }}
                    >
                      <InlineNoteBlock
                        value={normalizeRichTextHtml(block.publicNote ?? block.notes ?? "")}
                        onChange={(value) => updateChildNoteContent(block.id, value)}
                        placeholder={textBlockPlaceholder(block.entryKind)}
                        autoFocus={focusedChildNoteTarget?.id === block.id}
                        autoFocusPosition={focusedChildNoteTarget?.position ?? "end"}
                        onAutoFocusComplete={() => setFocusedChildNoteTarget(null)}
                        onSplit={(split) => handleChildTextBlockSplit(block.id, split)}
                        onBackspaceAtStart={() => mergeChildNoteBackward(block.id)}
                        onNavigatePrevious={() => focusPreviousChildNote(block.id)}
                        onNavigateNext={() => focusNextChildNote(block.id)}
                        editorClassName={headingEditorClassName(block.entryKind)}
                        commands={block.entryKind === "note" ? BRIDGE_SLASH_COMMANDS : []}
                        onSelectCommand={(commandId) =>
                          handleChildSlashCommandSelection(block.id, commandId)
                        }
                        maxVisibleCommands={4}
                      />
                    </div>
                  ) : (
                    <Link
                      key={block.id}
                      href={getBridgeEntryHref(block)}
                      onClickCapture={(event) => {
                        if (!isModifierSelection(event)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setContextMenu(null);
                        toggleChapterBlockSelection(block.id);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedChapterBlockIds((current) =>
                          current.includes(block.id) ? current : [block.id],
                        );
                        setContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          targetId: block.id,
                        });
                      }}
                      className={`rounded-xl border bg-background px-4 py-3 transition ${
                        selectedChapterBlockIds.includes(block.id)
                          ? "border-sky-400 ring-2 ring-sky-200"
                          : "border-border hover:border-foreground/15"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.94rem] font-semibold text-foreground">{block.name}</p>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {bridgeEntryKindLabel(block.entryKind)}
                        </span>
                      </div>
                      <p className="mt-1 text-[0.84rem] text-muted-foreground">
                        {block.entryKind === "bridge"
                          ? block.endpoint
                          : normalizeRichTextHtml(block.publicNote ?? block.notes ?? "")
                              .replace(/<[^>]+>/g, " ")
                              .replace(/\s+/g, " ")
                              .trim() || `${bridgeEntryKindLabel(block.entryKind)} content`}
                      </p>
                    </Link>
                  ),
                )}
              </div>
            ) : (
              <p className="text-[0.84rem] text-muted-foreground">
                No blocks here yet.
              </p>
            )}
          </div>
        ) : null}

        {isBridgeEntry && bridge.apiConfig ? (
          <div className="grid gap-3 pt-2">
            <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">
              API configuration
            </h2>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Request preview
              </p>

              <div className="mt-3 grid gap-3 text-[0.84rem] text-foreground">
                <div>
                  <p className="font-semibold">Method</p>
                  <p className="mt-1 text-muted-foreground">{bridge.method ?? "GET"}</p>
                </div>

                <div>
                  <p className="font-semibold">Request URL</p>
                  <p className="mt-1 break-all text-muted-foreground">
                    {keyValueItemsToUrl(bridge.endpoint, bridge.apiConfig.queryParams)}
                  </p>
                </div>

                {apiHeaders.length ? (
                  <div>
                    <p className="font-semibold">Headers</p>
                    <div className="mt-1 grid gap-1">
                    {apiHeaders.map((item) => (
                      <p key={item.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{item.key || "(empty key)"}:</span>{" "}
                        {item.value || "(empty value)"}
                      </p>
                    ))}
                    </div>
                  </div>
                ) : null}

                {apiQueryParams.length ? (
                  <div>
                    <p className="font-semibold">Query params</p>
                    <div className="mt-1 grid gap-1">
                    {apiQueryParams.map((item) => (
                      <p key={item.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{item.key || "(empty key)"}</span>
                        {" = "}
                        {item.value || "(empty value)"}
                      </p>
                    ))}
                    </div>
                  </div>
                ) : null}

                {apiFormData.length ? (
                  <div>
                    <p className="font-semibold">Form data</p>
                    <div className="mt-1 grid gap-1">
                      {apiFormData.map((item) => (
                        <p key={item.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{item.key || "(empty key)"}</span>
                          {" = "}
                          {item.value || "(empty value)"}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {apiFormData.length ? (
                  <div>
                    <p className="font-semibold">Request body</p>
                    <p className="mt-1 text-muted-foreground">
                      This request will be sent as multipart form data.
                    </p>
                  </div>
                ) : hasRequestBody ? (
                  <div>
                    <p className="font-semibold">Request body</p>
                    <div className="mt-1">
                      <p className="text-muted-foreground">
                        Body type: <span className="font-medium text-foreground">{bridge.apiConfig.bodyType}</span>
                      </p>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-[0.78rem] text-foreground">
                        {bridge.apiConfig.body}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {isBridgeEntry && !bridge.apiConfig && (bridge.serviceName || bridge.secret || requiredFields.length) ? (
          <div className="grid gap-3 pt-2">
            <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">
              Bridge configuration
            </h2>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="grid gap-3 text-[0.84rem] text-foreground">
                {bridge.serviceName ? (
                  <div>
                    <p className="font-semibold">Service name</p>
                    <p className="mt-1 text-muted-foreground">{bridge.serviceName}</p>
                  </div>
                ) : null}

                {bridge.secret ? (
                  <div>
                    <p className="font-semibold">
                      {bridge.bridgeType === "webhook" ? "Signing secret" : "Handshake key"}
                    </p>
                    <p className="mt-1 text-muted-foreground">Configured</p>
                  </div>
                ) : null}

                {requiredFields.length ? (
                  <div>
                    <p className="font-semibold">Required fields</p>
                    <div className="mt-1 grid gap-1">
                      {requiredFields.map((item) => (
                        <p key={item.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {item.key || "(empty key)"}
                          </span>
                          {item.value ? ` - ${item.value}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {isBridgeEntry && richTextHasContent(normalizedPrivateNote) ? (
          <div className="pt-2">
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Private note
            </p>
            <div
              className="mt-2 prose prose-sm max-w-none text-[0.88rem] text-foreground"
              dangerouslySetInnerHTML={{ __html: normalizedPrivateNote }}
            />
          </div>
        ) : null}

        {isBridgeEntry && richTextHasContent(normalizedPublicNote) ? (
          <div className="pt-2">
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Public note
            </p>
            <div
              className="mt-2 prose prose-sm max-w-none text-[0.88rem] text-foreground"
              dangerouslySetInnerHTML={{ __html: normalizedPublicNote }}
            />
          </div>
        ) : null}
        {isBridgeEntry && hasRunActivity ? (
          <div className="space-y-5 pt-4">
            <div>
              <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">Response</h2>
            </div>

            {runRecord.output ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Output
                </p>
                <p className="mt-2 text-[0.98rem] font-semibold capitalize">
                  {runRecord.status}
                </p>
                <p className="mt-1 text-[0.84rem] text-muted-foreground">
                  {runRecord.lastRunAt
                    ? `Last run: ${new Date(runRecord.lastRunAt).toLocaleString()}`
                    : "Bridge has not been run yet."}
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-[0.8rem] text-foreground">
                  {runRecord.output}
                </pre>
                <div className="mt-3 grid gap-2 text-[0.82rem] text-foreground">
                  <p>
                    <span className="font-semibold">Request URL:</span>{" "}
                    {runRecord.response?.requestUrl || "No response yet."}
                  </p>
                  <p>
                    <span className="font-semibold">Status:</span>{" "}
                    {runRecord.response?.statusCode
                      ? `${runRecord.response.statusCode} ${runRecord.response.statusText ?? ""}`.trim()
                      : "No response yet."}
                  </p>
                  <p>
                    <span className="font-semibold">Duration:</span>{" "}
                    {typeof runRecord.response?.durationMs === "number"
                      ? `${runRecord.response.durationMs}ms`
                      : "N/A"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {runRecord.response?.headers?.length ? (
                <div>
                  <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Response headers
                  </p>
                  <div className="mt-2 rounded-xl border border-border bg-background p-4">
                    <div className="grid gap-1">
                      {runRecord.response.headers.map((header) => (
                        <p key={header.id} className="text-[0.78rem] text-foreground">
                          <span className="font-semibold">{header.key}:</span> {header.value}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Response body
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-[0.78rem] text-foreground">
                  {runRecord.response?.body || "No response body yet."}
                </pre>
              </div>
            </div>
          </div>
        ) : null}

        {isBridgeEntry ? (
          <div className="flex flex-wrap gap-2 pt-4">
            <Link
              href={`/bridge/${bridge.id}/edit`}
              className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
            >
              Edit bridge
            </Link>
            <button
              type="button"
              onClick={duplicateBridge}
              disabled={isDuplicating}
              className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted disabled:opacity-60"
            >
              {isDuplicating ? "Duplicating..." : "Duplicate bridge"}
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="inline-flex rounded-full border border-rose-200 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete bridge"}
            </button>
          </div>
        ) : null}

        {isDeleteDialogOpen && bridge ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
              <div className="space-y-2">
                <p className="text-[0.76rem] font-semibold text-muted-foreground">Delete bridge</p>
                <h2 className="text-[1.2rem] font-semibold tracking-[-0.02em] text-foreground">
                  Remove {bridge.name}?
                </h2>
                <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
                  This will remove the bridge configuration and its saved run history from this
                  browser.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeleting}
                  className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={removeBridge}
                  disabled={isDeleting}
                  className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting..." : "Delete bridge"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteChapterBlocks.length ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
              <div className="space-y-2">
                <p className="text-[0.76rem] font-semibold text-muted-foreground">Delete blocks</p>
                <h2 className="text-[1.2rem] font-semibold tracking-[-0.02em] text-foreground">
                  {deleteChapterBlocks.length === 1
                    ? `Remove ${deleteChapterBlocks[0]?.name}?`
                    : `Remove ${deleteChapterBlocks.length} blocks?`}
                </h2>
                <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
                  This will remove the selected blocks and their saved run history from this
                  browser.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteChapterBlockIds([])}
                  disabled={isDeletingChapterBlocks}
                  className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={removeChapterBlocks}
                  disabled={isDeletingChapterBlocks}
                  className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  {isDeletingChapterBlocks ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {contextMenu && bridge.entryKind === "chapter" ? (
          <div
            ref={contextMenuRef}
            className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-background p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
            style={
              contextMenuPosition
                ? { left: contextMenuPosition.left, top: contextMenuPosition.top }
                : { left: -9999, top: -9999 }
            }
            onClick={(event) => event.stopPropagation()}
          >
            {contextBlock ? (
              <div className="grid gap-1">
                {(() => {
                  const actionTargets = getActionTargetBlocks(contextBlock.id);
                  const actionCount = actionTargets.length;

                  return (
                    <>
                <button
                  type="button"
                  onClick={() => handleCutBlock(contextBlock.id)}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted"
                >
                  {actionCount > 1 ? `Cut ${actionCount} items` : "Cut"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyBlock(contextBlock.id)}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted"
                >
                  {actionCount > 1 ? `Copy ${actionCount} items` : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteBlocksDialog(contextBlock.id)}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  {actionCount > 1 ? `Delete ${actionCount} items` : "Delete"}
                </button>
                {contextBlock.entryKind === "bridge" || contextBlock.entryKind === "note" ? (
                  <button
                    type="button"
                    onClick={() => handleDuplicateBlock(contextBlock)}
                    className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted"
                  >
                    Duplicate
                  </button>
                ) : null}
                    </>
                  );
                })()}
              </div>
            ) : (
              <button
                type="button"
                onClick={pasteIntoChapter}
                disabled={!clipboard?.items.length}
                className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {clipboard?.items.length
                  ? clipboard.items.length === 1
                    ? `Paste ${clipboard.items[0]?.name ?? "block"}`
                    : `Paste ${clipboard.items.length} blocks`
                  : "Paste"}
              </button>
            )}
          </div>
        ) : null}
      </section>
  );
}
