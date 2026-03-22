"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { loadBridges, saveBridges, type BridgeItem } from "./bridge/bridge-storage";
import { InlineNoteBlock, type SlashCommand } from "./bridge/inline-note-block";
import { getChapterDocHref } from "./bridge/paths";
import { richTextHasContent, richTextToPlainText } from "./bridge/rich-text";
import { loadComponents, saveComponents, type ComponentItem } from "./components/component-storage";
import {
  WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT,
  WORKSPACE_PAGE_BLOCKS_STORAGE_KEY,
  loadWorkspacePageBlocks,
  saveWorkspacePageBlocks,
  type WorkspacePageBlock,
  type WorkspacePageBlockKind,
  type WorkspacePageKey,
} from "./page-blocks-storage";

type FocusTarget = {
  id: string;
  position: "start" | "end";
};

type PageMeta = {
  eyebrow: string;
  title: string;
  description: string;
  commands: SlashCommand[];
};

type StaticBlockMeta = {
  badge: string;
  title: string;
  description: string;
  accentClassName: string;
};

const TEXT_BLOCK_KINDS: WorkspacePageBlockKind[] = ["note", "heading1", "heading2", "heading3"];
const PAGE_KEYS: WorkspacePageKey[] = ["bridge", "design", "components"];

const PAGE_META: Record<WorkspacePageKey, PageMeta> = {
  bridge: {
    eyebrow: "Bridge",
    title: "Bridge",
    description: "Capture APIs, webhooks, sections, and notes in one shared document editor.",
    commands: [
      {
        id: "p",
        label: "Paragraph",
        description: "Standard text block",
        keywords: ["p", "paragraph", "text"],
      },
      {
        id: "chapter",
        label: "Chapter",
        description: "Create a chapter divider block",
        keywords: ["chapter", "section"],
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
        label: "API block",
        description: "Insert an API bridge block",
        keywords: ["api", "http", "request"],
      },
      {
        id: "webhook",
        label: "Webhook block",
        description: "Insert a webhook bridge block",
        keywords: ["webhook", "hook"],
      },
      {
        id: "grpc",
        label: "gRPC block",
        description: "Insert a gRPC bridge block",
        keywords: ["grpc", "rpc"],
      },
    ],
  },
  design: {
    eyebrow: "Design",
    title: "Design",
    description: "Collect design resources, headings, and notes in the shared doc editor.",
    commands: [
      {
        id: "p",
        label: "Paragraph",
        description: "Standard text block",
        keywords: ["p", "paragraph", "text"],
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
    ],
  },
  components: {
    eyebrow: "Components",
    title: "Components",
    description: "Document reusable UI ideas and drop component reference blocks into the same editor.",
    commands: [
      {
        id: "p",
        label: "Paragraph",
        description: "Standard text block",
        keywords: ["p", "paragraph", "text"],
      },
      {
        id: "component",
        label: "Component block",
        description: "Insert a reusable component block",
        keywords: ["component", "ui", "block"],
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
    ],
  },
};

const STATIC_BLOCK_META: Record<Exclude<WorkspacePageBlockKind, "note" | "heading1" | "heading2" | "heading3">, StaticBlockMeta> = {
  chapter: {
    badge: "Chapter",
    title: "Chapter block",
    description: "Use this to separate the bridge doc into larger sections.",
    accentClassName: "border-sky-200 bg-sky-50/70 text-sky-900",
  },
  api: {
    badge: "API",
    title: "API block",
    description: "Placeholder for an API endpoint, request flow, or integration note.",
    accentClassName: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  },
  webhook: {
    badge: "Webhook",
    title: "Webhook block",
    description: "Placeholder for an incoming or outgoing webhook definition.",
    accentClassName: "border-amber-200 bg-amber-50/70 text-amber-900",
  },
  grpc: {
    badge: "gRPC",
    title: "gRPC block",
    description: "Placeholder for a gRPC service, method, or contract note.",
    accentClassName: "border-violet-200 bg-violet-50/70 text-violet-900",
  },
  component: {
    badge: "Component",
    title: "Component block",
    description: "Placeholder for a reusable component reference or implementation note.",
    accentClassName: "border-rose-200 bg-rose-50/70 text-rose-900",
  },
};

const SERVER_PAGE_BLOCKS_SNAPSHOT: Record<WorkspacePageKey, WorkspacePageBlock[]> = {
  bridge: [createEmptyNoteBlock("bridge")],
  design: [createEmptyNoteBlock("design")],
  components: [createEmptyNoteBlock("components")],
};

let pageBlocksSnapshotCache:
  | {
      raw: string | null;
      snapshots: Record<WorkspacePageKey, WorkspacePageBlock[]>;
    }
  | null = null;

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyNoteBlock(pageKey: WorkspacePageKey): WorkspacePageBlock {
  return {
    id: `empty-${pageKey}-note`,
    pageKey,
    kind: "note",
    content: "",
    createdAt: "0",
  };
}

function createBlock(pageKey: WorkspacePageKey, kind: WorkspacePageBlockKind = "note"): WorkspacePageBlock {
  return {
    id: createId(),
    pageKey,
    kind,
    content: "",
    createdAt: new Date().toISOString(),
  };
}

function ensureTrailingNote(blocks: WorkspacePageBlock[], pageKey: WorkspacePageKey) {
  if (!blocks.length || blocks[blocks.length - 1]?.kind !== "note") {
    return [...blocks, createBlock(pageKey, "note")];
  }
  return blocks;
}

function isTextBlockKind(kind: WorkspacePageBlockKind) {
  return TEXT_BLOCK_KINDS.includes(kind);
}

function slashCommandToKind(pageKey: WorkspacePageKey, command: string) {
  if (command === "/p") return "note";
  if (command === "/h1" || command === "#") return "heading1";
  if (command === "/h2" || command === "##") return "heading2";
  if (command === "/h3" || command === "###") return "heading3";

  if (pageKey === "bridge") {
    if (command === "/chapter") return "chapter";
    if (command === "/api") return "api";
    if (command === "/webhook") return "webhook";
    if (command === "/grpc") return "grpc";
  }

  if (pageKey === "components" && command === "/component") {
    return "component";
  }

  return null;
}

function commandIdToKind(pageKey: WorkspacePageKey, commandId: string) {
  if (commandId === "p") return "note";
  if (commandId === "h1") return "heading1";
  if (commandId === "h2") return "heading2";
  if (commandId === "h3") return "heading3";

  if (pageKey === "bridge" && (commandId === "chapter" || commandId === "api" || commandId === "webhook" || commandId === "grpc")) {
    return commandId;
  }

  if (pageKey === "components" && commandId === "component") {
    return "component";
  }

  return null;
}

function headingEditorClassName(kind: WorkspacePageBlockKind) {
  if (kind === "heading1") return "text-[1.55rem] font-semibold tracking-[-0.02em] leading-[1.2]";
  if (kind === "heading2") return "text-[1.25rem] font-semibold tracking-[-0.018em] leading-[1.3]";
  if (kind === "heading3") return "text-[1.06rem] font-semibold tracking-[-0.012em] leading-[1.4]";
  return "";
}

function blockPlaceholder(kind: WorkspacePageBlockKind) {
  if (kind === "heading1") return "Heading 1";
  if (kind === "heading2") return "Heading 2";
  if (kind === "heading3") return "Heading 3";
  return "Continue typing, or type / for commands";
}

function findPreviousTextBlock(blocks: WorkspacePageBlock[], currentIndex: number) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block && isTextBlockKind(block.kind)) return block;
  }

  return null;
}

function findNextTextBlock(blocks: WorkspacePageBlock[], currentIndex: number) {
  for (let index = currentIndex + 1; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block && isTextBlockKind(block.kind)) return block;
  }

  return null;
}

function getStaticBlockMeta(kind: WorkspacePageBlockKind) {
  if (kind === "chapter") return STATIC_BLOCK_META.chapter;
  if (kind === "api") return STATIC_BLOCK_META.api;
  if (kind === "webhook") return STATIC_BLOCK_META.webhook;
  if (kind === "grpc") return STATIC_BLOCK_META.grpc;
  if (kind === "component") return STATIC_BLOCK_META.component;
  return null;
}

type PageBlocksEditorProps = {
  pageKey: WorkspacePageKey;
};

export function PageBlocksEditor({ pageKey }: PageBlocksEditorProps) {
  const router = useRouter();
  const [focusedTarget, setFocusedTarget] = useState<FocusTarget | null>(null);

  const pageMeta = PAGE_META[pageKey];
  const bridges = loadBridges();
  const blocks = useSyncExternalStore(
    subscribeToPageBlocks,
    () => getPageBlocksSnapshot(pageKey),
    () => SERVER_PAGE_BLOCKS_SNAPSHOT[pageKey],
  );

  useEffect(() => {
    persistPageBlocksIfMissing(pageKey, blocks);
  }, [blocks, pageKey]);

  function saveCurrentPageBlocks(nextBlocks: WorkspacePageBlock[]) {
    const normalizedBlocks = ensureTrailingNote(nextBlocks, pageKey);
    savePageBlocksFor(pageKey, normalizedBlocks);
    return normalizedBlocks;
  }

  function updateBlockContent(blockId: string, value: string) {
    saveCurrentPageBlocks(
      blocks.map((block) => (block.id === blockId ? { ...block, content: value } : block)),
    );
  }

  function persistBlockKind(blockId: string, kind: WorkspacePageBlockKind, content = "") {
    return saveCurrentPageBlocks(
      blocks.map((item) =>
        item.id === blockId
          ? {
              ...item,
              kind,
              content,
            }
          : item,
      ),
    );
  }

  function createLinkedResource(kind: WorkspacePageBlockKind) {
    if (kind === "chapter") {
      const item = createBridgeEntry("chapter");
      saveBridges([item, ...loadBridges()]);
      return { id: item.id, href: getChapterDocHref(item.id) };
    }

    if (kind === "api" || kind === "webhook" || kind === "grpc") {
      const item = createBridgeEntry(kind);
      saveBridges([item, ...loadBridges()]);
      return { id: item.id, href: `/bridge/${item.id}` };
    }

    if (kind === "component") {
      const item = createComponentEntry();
      saveComponents([item, ...loadComponents()]);
      return { id: item.id, href: `/components/${item.id}` };
    }

    return null;
  }

  function focusAfterKindChange(nextBlocks: WorkspacePageBlock[], blockId: string, kind: WorkspacePageBlockKind) {
    if (isTextBlockKind(kind)) {
      setFocusedTarget({ id: blockId, position: "end" });
      return;
    }

    const currentIndex = nextBlocks.findIndex((block) => block.id === blockId);
    if (currentIndex === -1) return;

    const nextTextBlock = findNextTextBlock(nextBlocks, currentIndex);
    if (nextTextBlock) {
      setFocusedTarget({ id: nextTextBlock.id, position: "start" });
      return;
    }

    const previousTextBlock = findPreviousTextBlock(nextBlocks, currentIndex);
    if (previousTextBlock) {
      setFocusedTarget({ id: previousTextBlock.id, position: "end" });
    }
  }

  function handleSplit(blockId: string) {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;

    if (block.kind === "note") {
      const command = richTextToPlainText(block.content);
      const nextKind = slashCommandToKind(pageKey, command);

      if (nextKind) {
        const linkedResource = createLinkedResource(nextKind);
        const nextBlocks = persistBlockKind(blockId, nextKind, linkedResource?.id ?? "");

        if (linkedResource) {
          router.push(linkedResource.href);
          return;
        }

        focusAfterKindChange(nextBlocks, blockId, nextKind);
        return;
      }
    }

    const nextBlock = createBlock(pageKey, "note");
    const sourceIndex = blocks.findIndex((item) => item.id === blockId);
    if (sourceIndex === -1) return;

    const nextBlocks = [...blocks];
    nextBlocks.splice(sourceIndex + 1, 0, nextBlock);
    saveCurrentPageBlocks(nextBlocks);
    setFocusedTarget({ id: nextBlock.id, position: "end" });
  }

  function handleCommandSelection(blockId: string, commandId: string) {
    const selectedKind = commandIdToKind(pageKey, commandId);
    if (!selectedKind) return;

    const linkedResource = createLinkedResource(selectedKind);
    const nextBlocks = persistBlockKind(blockId, selectedKind, linkedResource?.id ?? "");

    if (linkedResource) {
      router.push(linkedResource.href);
      return;
    }

    focusAfterKindChange(nextBlocks, blockId, selectedKind);
  }

  function handleStaticBlockClick(block: WorkspacePageBlock) {
    const existingHref = getStaticBlockHref(block);
    if (existingHref) {
      router.push(existingHref);
      return;
    }

    const linkedResource = createLinkedResource(block.kind);
    if (!linkedResource) return;

    persistBlockKind(block.id, block.kind, linkedResource.id);
    router.push(linkedResource.href);
  }

  function removeBlock(blockId: string) {
    return saveCurrentPageBlocks(blocks.filter((block) => block.id !== blockId));
  }

  function mergeBlockBackward(blockId: string) {
    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex === -1) return;

    const currentBlock = blocks[currentIndex];
    const previousBlock = currentIndex > 0 ? blocks[currentIndex - 1] : null;

    if (!richTextHasContent(currentBlock.content)) {
      removeBlock(blockId);
      const previousTextBlock = findPreviousTextBlock(blocks, currentIndex);
      if (previousTextBlock) {
        setFocusedTarget({ id: previousTextBlock.id, position: "end" });
      }
      return;
    }

    if (!previousBlock || previousBlock.kind !== "note" || currentBlock.kind !== "note") return;

    const nextBlocks = blocks
      .map((block) =>
        block.id === previousBlock.id
          ? {
              ...block,
              content: `${previousBlock.content}${currentBlock.content}`,
            }
          : block,
      )
      .filter((block) => block.id !== blockId);

    saveCurrentPageBlocks(nextBlocks);
    setFocusedTarget({ id: previousBlock.id, position: "end" });
  }

  function focusPreviousNote(blockId: string) {
    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex <= 0) return;
    const previousBlock = findPreviousTextBlock(blocks, currentIndex);
    if (!previousBlock) return;
    setFocusedTarget({ id: previousBlock.id, position: "end" });
  }

  function focusNextNote(blockId: string) {
    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex === -1 || currentIndex >= blocks.length - 1) return;
    const nextBlock = findNextTextBlock(blocks, currentIndex);
    if (!nextBlock) return;
    setFocusedTarget({ id: nextBlock.id, position: "start" });
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {pageMeta.eyebrow}
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">{pageMeta.title}</h1>
        <p className="mt-2 max-w-3xl text-[0.9rem] text-muted-foreground">{pageMeta.description}</p>
      </div>

      <div className="grid gap-3 pt-1">
        {blocks.map((block) => {
          if (isTextBlockKind(block.kind)) {
            return (
              <div key={block.id} className="px-1 py-1">
                <InlineNoteBlock
                  value={block.content}
                  onChange={(value) => updateBlockContent(block.id, value)}
                  placeholder={blockPlaceholder(block.kind)}
                  autoFocus={focusedTarget?.id === block.id}
                  autoFocusPosition={focusedTarget?.position ?? "end"}
                  onAutoFocusComplete={() => setFocusedTarget(null)}
                  onSplit={() => handleSplit(block.id)}
                  onBackspaceAtStart={() => mergeBlockBackward(block.id)}
                  onNavigatePrevious={() => focusPreviousNote(block.id)}
                  onNavigateNext={() => focusNextNote(block.id)}
                  editorClassName={headingEditorClassName(block.kind)}
                  commands={block.kind === "note" ? pageMeta.commands : []}
                  onSelectCommand={(commandId) => handleCommandSelection(block.id, commandId)}
                  maxVisibleCommands={4}
                />
              </div>
            );
          }

          const staticMeta = getStaticBlockMeta(block.kind);
          if (!staticMeta) return null;

          const blockHref = getStaticBlockHref(block);
          const resolvedCard = getResolvedStaticBlockCard(block, bridges);
          const cardContent = (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[1rem] font-semibold text-foreground">
                  {resolvedCard.title}
                </h2>
                <span className="rounded-full border border-border px-2 py-0.5 text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {staticMeta.badge}
                </span>
              </div>
              <p className="mt-1 text-[0.84rem] text-muted-foreground">
                {resolvedCard.description}
              </p>
            </div>
          );

          if (blockHref) {
            return (
              <Link
                key={block.id}
                href={blockHref}
                className="block rounded-xl border border-border bg-background px-4 py-3 transition hover:border-foreground/15 hover:bg-muted/25"
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <button
              key={block.id}
              type="button"
              onClick={() => handleStaticBlockClick(block)}
              className="block w-full rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-foreground/15 hover:bg-muted/25"
            >
              {cardContent}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function subscribeToPageBlocks(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key && event.key !== WORKSPACE_PAGE_BLOCKS_STORAGE_KEY) return;
    onStoreChange();
  }

  function handlePageBlocksUpdate() {
    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, handlePageBlocksUpdate);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT, handlePageBlocksUpdate);
  };
}

function savePageBlocksFor(pageKey: WorkspacePageKey, pageBlocks: WorkspacePageBlock[]) {
  const otherBlocks = loadWorkspacePageBlocks().filter((item) => item.pageKey !== pageKey);
  saveWorkspacePageBlocks([...otherBlocks, ...pageBlocks]);
}

function persistPageBlocksIfMissing(
  pageKey: WorkspacePageKey,
  visibleBlocks: WorkspacePageBlock[],
) {
  const storedBlocks = loadWorkspacePageBlocks().filter((item) => item.pageKey === pageKey);
  const normalizedStoredBlocks = ensureTrailingNote(storedBlocks, pageKey);

  if (arePageBlocksEqual(storedBlocks, visibleBlocks)) {
    return;
  }

  if (arePageBlocksEqual(normalizedStoredBlocks, visibleBlocks)) {
    savePageBlocksFor(pageKey, visibleBlocks);
  }
}

function arePageBlocksEqual(
  left: WorkspacePageBlock[],
  right: WorkspacePageBlock[],
) {
  if (left.length !== right.length) return false;

  return left.every((block, index) => {
    const other = right[index];
    return (
      block.id === other?.id &&
      block.pageKey === other.pageKey &&
      block.kind === other.kind &&
      block.content === other.content &&
      block.createdAt === other.createdAt
    );
  });
}

function getPageBlocksSnapshot(pageKey: WorkspacePageKey) {
  if (typeof window === "undefined") {
    return SERVER_PAGE_BLOCKS_SNAPSHOT[pageKey];
  }

  const raw = window.localStorage.getItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY);
  if (pageBlocksSnapshotCache?.raw === raw) {
    return pageBlocksSnapshotCache.snapshots[pageKey];
  }

  const allBlocks = loadWorkspacePageBlocks();
  const snapshots = Object.fromEntries(
    PAGE_KEYS.map((key) => [
      key,
      ensureTrailingNote(
        allBlocks.filter((item) => item.pageKey === key),
        key,
      ),
    ]),
  ) as Record<WorkspacePageKey, WorkspacePageBlock[]>;

  pageBlocksSnapshotCache = { raw, snapshots };
  return snapshots[pageKey];
}

function getStaticBlockHref(block: WorkspacePageBlock) {
  if (!block.content) return null;

  if (block.kind === "chapter") {
    return getChapterDocHref(block.content);
  }

  if (block.kind === "api" || block.kind === "webhook" || block.kind === "grpc") {
    return `/bridge/${block.content}`;
  }

  if (block.kind === "component") {
    return `/components/${block.content}`;
  }

  return null;
}

function getResolvedStaticBlockCard(
  block: WorkspacePageBlock,
  bridges: BridgeItem[],
) {
  const staticMeta = getStaticBlockMeta(block.kind);
  if (!staticMeta) {
    return {
      title: "",
      description: "",
    };
  }

  if (
    (block.kind === "chapter" ||
      block.kind === "api" ||
      block.kind === "webhook" ||
      block.kind === "grpc") &&
    block.content
  ) {
    const bridge = bridges.find((item) => item.id === block.content);
    if (bridge) {
      const description = richTextToPlainText(bridge.publicNote ?? bridge.notes ?? "");

      return {
        title: bridge.name || staticMeta.title,
        description: description || staticMeta.description,
      };
    }
  }

  return {
    title: staticMeta.title,
    description: staticMeta.description,
  };
}

function createBridgeEntry(kind: "chapter" | "api" | "webhook" | "grpc"): BridgeItem {
  const id = createId();

  if (kind === "chapter") {
    return {
      id,
      name: "Untitled chapter",
      entryKind: "chapter",
      bridgeType: "api",
      endpoint: "",
      environment: "development",
      createdAt: new Date().toISOString(),
    };
  }

  return {
    id,
    name:
      kind === "api"
        ? "Untitled API bridge"
        : kind === "webhook"
          ? "Untitled webhook bridge"
          : "Untitled gRPC bridge",
    entryKind: "bridge",
    bridgeType: kind,
    endpoint: "",
    environment: "development",
    method: kind === "api" ? "GET" : undefined,
    createdAt: new Date().toISOString(),
  };
}

function createComponentEntry(): ComponentItem {
  return {
    id: createId(),
    name: "Untitled component",
    description: "",
    tags: [],
    parts: [],
    createdAt: new Date().toISOString(),
  };
}
