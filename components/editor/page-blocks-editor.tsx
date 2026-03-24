"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ActionMenu, type ActionMenuItem } from "./action-menu";
import {
  type ActionMenuState,
  type BlockActionContext,
  type BlockActionTrigger,
} from "./block-action-context";
import * as blockActionUtils from "./block-actions";
import {
  canMoveBlock,
  DRAG_START_THRESHOLD,
  getMeasuredBlockSlotSize,
  getReorderableBlocks,
  type DragState,
  type PendingDragState,
  reorderPageBlocks,
  siblingOffset,
} from "./block-drag";
import {
  blockPlaceholder,
  commandIdToKind,
  getPageMeta,
  headingEditorClassName,
  isTextBlockKind,
  slashCommandToKind,
} from "./command-blocks";
import { copyBlocksToClipboard as copyBlocksToClipboardBehavior } from "./behavior/copy-blocks";
import { removeBlocksById } from "./behavior/cut-blocks";
import { moveBlockInDirection } from "./behavior/move-block";
import { resolveActionTargetBlocks, toggleSelectedBlockIds } from "./behavior/selection";
import { ApiBlockRow } from "./blocks/api-block-row";
import { BlockHandle } from "./blocks/block-handle";
import { ChapterBlockRow } from "./blocks/chapter-block-row";
import { GrpcBlockRow } from "./blocks/grpc-block-row";
import { TextBlockRow } from "./blocks/text-block-row";
import { WebhookBlockRow } from "./blocks/webhook-block-row";
import {
  BRIDGE_STORAGE_EVENT,
  BRIDGE_STORAGE_KEY,
  loadBridges,
  saveBridges,
  type BridgeItem,
} from "../../app/bridge/bridge-storage";
import {
  type InlineNoteBlockHandle,
  type InlineNoteSplit,
  type SlashCommand,
} from "./inline-note-block";
import { getBridgeDocRootHref, getBridgeEditHref, getChapterDocHref } from "../../app/bridge/paths";
import { richTextHasContent, richTextToPlainText } from "../../app/bridge/rich-text";
import {
  WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT,
  WORKSPACE_PAGE_BLOCKS_STORAGE_KEY,
  loadWorkspacePageBlocks,
  saveWorkspacePageBlocks,
  type WorkspacePageBlock,
  type WorkspacePageBlockKind,
  type WorkspacePageKey,
} from "../../app/page-blocks-storage";

type FocusTarget = {
  id: string;
  position: "start" | "end";
};

type StaticBlockMeta = {
  badge: string;
  title: string;
  description: string;
};
const PAGE_KEYS: WorkspacePageKey[] = ["bridge"];

const STATIC_BLOCK_META: Record<Exclude<WorkspacePageBlockKind, "note" | "heading1" | "heading2" | "heading3">, StaticBlockMeta> = {
  chapter: {
    badge: "Page",
    title: "Page block",
    description: "Use this to create a nested page inside the doc.",
  },
  api: {
    badge: "API",
    title: "API block",
    description: "Placeholder for an API endpoint, request flow, or integration note.",
  },
  webhook: {
    badge: "Webhook",
    title: "Webhook block",
    description: "Placeholder for an incoming or outgoing webhook definition.",
  },
  grpc: {
    badge: "gRPC",
    title: "gRPC block",
    description: "Placeholder for a gRPC service, method, or contract note.",
  },
};

const SERVER_PAGE_BLOCKS_SNAPSHOT: Record<WorkspacePageKey, WorkspacePageBlock[]> = {
  bridge: [createEmptyNoteBlock("bridge")],
};
const SERVER_BRIDGES_SNAPSHOT: BridgeItem[] = [];

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
  return null;
}

type PageBlocksEditorProps = {
  pageKey: WorkspacePageKey;
  chapterId?: string;
};

export function PageBlocksEditor({ pageKey, chapterId }: PageBlocksEditorProps) {
  const router = useRouter();
  const [focusedTarget, setFocusedTarget] = useState<FocusTarget | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [actionMenuState, setActionMenuState] = useState<ActionMenuState | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const noteBlockRefs = useRef<Record<string, InlineNoteBlockHandle | null>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const pendingDragRef = useRef<PendingDragState | null>(null);
  const suppressClickRef = useRef(false);

  const workspaceBlocks = useSyncExternalStore(
    subscribeToPageBlocks,
    () => getPageBlocksSnapshot(pageKey),
    () => SERVER_PAGE_BLOCKS_SNAPSHOT[pageKey],
  );
  const bridges = useSyncExternalStore(
    subscribeToBridges,
    loadBridges,
    () => SERVER_BRIDGES_SNAPSHOT,
  );
  const chapterBridge = chapterId ? bridges.find((item) => item.id === chapterId) ?? null : null;
  const pageMeta = getPageMeta(pageKey, chapterBridge);
  const blocks = chapterId ? getChapterBlocksSnapshot(bridges, chapterId) : workspaceBlocks;
  const normalizedSelectedBlockIds = selectedBlockIds.filter((id) =>
    blocks.some((block) => block.id === id),
  );

  const saveCurrentPageBlocks = useCallback((nextBlocks: WorkspacePageBlock[]) => {
    const normalizedBlocks = ensureTrailingNote(nextBlocks, pageKey);
    if (chapterId) {
      saveChapterBlocksFor(chapterId, normalizedBlocks, bridges);
    } else {
      savePageBlocksFor(pageKey, normalizedBlocks);
    }
    return normalizedBlocks;
  }, [bridges, chapterId, pageKey]);

  const copyBlocksToClipboard = useCallback(async (blockIds: string[]) => {
    await copyBlocksToClipboardBehavior({
      blocks,
      blockIds,
      bridges,
      isTextBlockKind,
      getResolvedStaticBlockCard,
      getStaticBlockHref,
      richTextToPlainText,
      copyTextToClipboard,
    });
  }, [blocks, bridges]);

  useEffect(() => {
    if (chapterId) return;
    persistPageBlocksIfMissing(pageKey, blocks);
  }, [blocks, chapterId, pageKey]);

  useEffect(() => {
    function closeActionMenu() {
      setActionMenuState(null);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeActionMenu();
      }
    }

    window.addEventListener("click", closeActionMenu);
    window.addEventListener("scroll", closeActionMenu, true);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("click", closeActionMenu);
      window.removeEventListener("scroll", closeActionMenu, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (!actionMenuState || !actionMenuRef.current) return;

    function updateActionMenuPosition() {
      if (!actionMenuRef.current || !actionMenuState) return;

      const viewportPadding = 12;
      const menuRect = actionMenuRef.current.getBoundingClientRect();
      const left = Math.max(
        viewportPadding,
        Math.min(actionMenuState.x, window.innerWidth - menuRect.width - viewportPadding),
      );
      const top = Math.max(
        viewportPadding,
        Math.min(actionMenuState.y, window.innerHeight - menuRect.height - viewportPadding),
      );

      setActionMenuPosition({ left, top });
    }

    updateActionMenuPosition();
    window.addEventListener("resize", updateActionMenuPosition);
    window.addEventListener("scroll", updateActionMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateActionMenuPosition);
      window.removeEventListener("scroll", updateActionMenuPosition, true);
    };
  }, [actionMenuState]);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const pendingDrag = pendingDragRef.current;
      if (!pendingDrag) return;

      const deltaY = event.clientY - pendingDrag.startY;
      if (!dragState && Math.abs(deltaY) < DRAG_START_THRESHOLD) return;

      const reorderableBlocks = getReorderableBlocks(blocks);

      if (!dragState) {
        suppressClickRef.current = true;
        setDragState({
          id: pendingDrag.id,
          startY: pendingDrag.startY,
          currentY: event.clientY,
          initialIndex: pendingDrag.initialIndex,
          targetIndex: pendingDrag.initialIndex,
          slotSize: pendingDrag.slotSize,
        });
        return;
      }

      const remainingBlocks = reorderableBlocks.filter((block) => block.id !== dragState.id);
      let nextTargetIndex = 0;

      for (const block of remainingBlocks) {
        const element = itemRefs.current[block.id];
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (event.clientY > rect.top + rect.height / 2) {
          nextTargetIndex += 1;
        }
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentY: event.clientY,
              targetIndex: nextTargetIndex,
            }
          : prev,
      );
    }

    function onPointerUp() {
      const activeDragState = dragState;
      pendingDragRef.current = null;

      if (activeDragState) {
        const reorderedBlocks = reorderPageBlocks(
          getReorderableBlocks(blocks),
          activeDragState.id,
          activeDragState.targetIndex,
        );
        saveCurrentPageBlocks(reorderedBlocks);
      }

      setDragState(null);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [blocks, dragState, saveCurrentPageBlocks]);

  useEffect(() => {
    async function onKeyDown(event: KeyboardEvent) {
      if (!isModifierSelection(event) || event.key.toLowerCase() !== "c") return;
      if (!normalizedSelectedBlockIds.length || hasActiveTextSelection()) return;

      event.preventDefault();
      await copyBlocksToClipboard(normalizedSelectedBlockIds);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copyBlocksToClipboard, normalizedSelectedBlockIds]);

  function updateBlockContent(blockId: string, value: string) {
    saveCurrentPageBlocks(
      blocks.map((block) => (block.id === blockId ? { ...block, content: value } : block)),
    );
  }

  function openContextMenu(
    event: React.MouseEvent<HTMLElement>,
    block: WorkspacePageBlock,
    showTextActions = false,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedBlockIds((current) => (current.includes(block.id) ? current : [block.id]));
    setActionMenuState({
      x: event.clientX,
      y: event.clientY,
      blockId: block.id,
      showTextActions,
      trigger: "context",
    });
  }

  function persistBlockKind(blockId: string, kind: WorkspacePageBlockKind, content = "") {
    if (chapterId) {
      return saveCurrentPageBlocks(
        blocks.map((item) =>
          item.id === blockId
            ? {
                ...item,
                kind,
                content: isTextBlockKind(kind) ? content : item.id,
              }
            : item,
        ),
      );
    }

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
    if (chapterId) return null;

    if (kind === "chapter") {
      const item = createBridgeEntry("chapter");
      saveBridges([item, ...loadBridges()]);
      return { id: item.id, href: getChapterDocHref(item.id) };
    }

    if (kind === "api" || kind === "webhook" || kind === "grpc") {
      const item = createBridgeEntry(kind);
      saveBridges([item, ...loadBridges()]);
      return { id: item.id, href: getBridgeEditHref(item.id) };
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

  function handleSplit(blockId: string, split: InlineNoteSplit) {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;

    if (block.kind === "note") {
      const command = richTextToPlainText(split.beforeHtml);
      const nextKind =
        !richTextHasContent(split.afterHtml) ? slashCommandToKind(pageKey, command) : null;

      if (nextKind) {
        const linkedResource =
          chapterId || isTextBlockKind(nextKind) ? null : createLinkedResource(nextKind);
        const nextBlocks = persistBlockKind(blockId, nextKind, linkedResource?.id ?? "");

        if (chapterId && !isTextBlockKind(nextKind)) {
          router.push(getBlockRoute(nextKind, blockId));
          return;
        }

        if (linkedResource) {
          router.push(linkedResource.href);
          return;
        }

        focusAfterKindChange(nextBlocks, blockId, nextKind);
        return;
      }
    }

    const nextBlock = {
      ...createBlock(pageKey, "note"),
      content: split.afterHtml,
    };
    const sourceIndex = blocks.findIndex((item) => item.id === blockId);
    if (sourceIndex === -1) return;

    const nextBlocks = blocks.map((item) =>
      item.id === blockId ? { ...item, content: split.beforeHtml } : item,
    );
    nextBlocks.splice(sourceIndex + 1, 0, nextBlock);
    saveCurrentPageBlocks(nextBlocks);
    setFocusedTarget({ id: nextBlock.id, position: "start" });
  }

  function handleCommandSelection(blockId: string, commandId: string) {
    const selectedKind = commandIdToKind(pageKey, commandId);
    if (!selectedKind) return;

    const linkedResource =
      chapterId || isTextBlockKind(selectedKind) ? null : createLinkedResource(selectedKind);
    const nextBlocks = persistBlockKind(blockId, selectedKind, linkedResource?.id ?? "");

    if (chapterId && !isTextBlockKind(selectedKind)) {
      router.push(getBlockRoute(selectedKind, blockId));
      return;
    }

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

  function moveBlock(blockId: string, direction: "up" | "down") {
    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex === -1 || !canMoveBlock(blocks, currentIndex, direction)) return;

    const nextBlocks = moveBlockInDirection(blocks, blockId, direction);
    if (!nextBlocks) return;
    saveCurrentPageBlocks(nextBlocks);
    setActionMenuState(null);
  }

  function insertBlockAfter(blockId: string, kind: WorkspacePageBlockKind) {
    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex === -1) return;

    if (isTextBlockKind(kind)) {
      const nextBlock = createBlock(pageKey, kind);
      const nextBlocks = [...blocks];
      nextBlocks.splice(currentIndex + 1, 0, nextBlock);
      saveCurrentPageBlocks(nextBlocks);
      setFocusedTarget({ id: nextBlock.id, position: "start" });
      setActionMenuState(null);
      return;
    }

    const linkedResource = chapterId ? null : createLinkedResource(kind);
    const nextBlockId = createId();
    const nextBlock = chapterId
      ? {
          id: nextBlockId,
          pageKey,
          kind,
          content: nextBlockId,
          createdAt: new Date().toISOString(),
        }
      : {
          ...createBlock(pageKey, kind),
          content: linkedResource?.id ?? "",
        };
    const nextBlocks = [...blocks];
    nextBlocks.splice(currentIndex + 1, 0, nextBlock);
    saveCurrentPageBlocks(nextBlocks);
    setActionMenuState(null);

    if (chapterId) {
      router.push(getBlockRoute(kind, nextBlock.id));
      return;
    }

    if (linkedResource) {
      router.push(linkedResource.href);
      return;
    }

    focusAfterKindChange(nextBlocks, nextBlock.id, kind);
  }

  async function handleCopyLink(blockId: string) {
    const url = new URL(window.location.href);
    url.hash = getBlockAnchorId(blockId);
    await copyTextToClipboard(url.toString());
    setActionMenuState(null);
  }

  async function handleCut(blockId: string) {
    const targetBlocks = getActionTargetBlocks(blockId);
    if (!targetBlocks.length) return;

    await copyBlocksToClipboard(targetBlocks.map((block) => block.id));
    saveCurrentPageBlocks(removeBlocksById(blocks, targetBlocks.map((block) => block.id)));
    setSelectedBlockIds((current) =>
      current.filter((id) => !targetBlocks.some((target) => target.id === id)),
    );
    setActionMenuState(null);
  }

  function applyTextFormat(blockId: string, format: "bold" | "italic" | "underline") {
    noteBlockRefs.current[blockId]?.applyFormat(format);
    setActionMenuState(null);
  }

  const actionMenuBlock = actionMenuState
    ? blocks.find((block) => block.id === actionMenuState.blockId)
    : null;
  const blockActionDefinitions = blockActionUtils.getBlockActionDefinitions({
    blocks,
    canMoveBlock,
    isTextBlockKind,
    pageKey,
  });

  function getActionContext(
    block: WorkspacePageBlock,
    trigger: BlockActionTrigger,
    showTextActions = false,
  ): BlockActionContext {
    return {
      block,
      blockIndex: blocks.findIndex((item) => item.id === block.id),
      showTextActions,
      trigger,
    };
  }

  function getActionMenuItems(
    block: WorkspacePageBlock,
    trigger: BlockActionTrigger,
    showTextActions = false,
  ): ActionMenuItem[] {
    const context = getActionContext(block, trigger, showTextActions);
    return blockActionUtils.getActionMenuItems(blockActionDefinitions, context);
  }

  function getSlashCommands(block: WorkspacePageBlock): SlashCommand[] {
    const context = getActionContext(block, "slash");
    return blockActionUtils.getSlashCommands(blockActionDefinitions, context);
  }

  function runDocAction(actionId: string, context: BlockActionContext) {
    if (actionId === "cut") {
      return handleCut(context.block.id);
    }

    if (actionId === "copy-link") {
      return handleCopyLink(context.block.id);
    }

    if (actionId === "move-up") {
      moveBlock(context.block.id, "up");
      return;
    }

    if (actionId === "move-down") {
      moveBlock(context.block.id, "down");
      return;
    }

    if (actionId === "bold") {
      applyTextFormat(context.block.id, "bold");
      return;
    }

    if (actionId === "italic") {
      applyTextFormat(context.block.id, "italic");
      return;
    }

    if (actionId === "underline") {
      applyTextFormat(context.block.id, "underline");
      return;
    }

    if (context.trigger === "slash") {
      handleCommandSelection(context.block.id, actionId);
      return;
    }

    const kind = commandIdToKind(pageKey, actionId);
    if (!kind) return;
    insertBlockAfter(context.block.id, kind);
  }

  const actionMenuItems =
    actionMenuState && actionMenuBlock
      ? getActionMenuItems(
          actionMenuBlock,
          actionMenuState.trigger,
          actionMenuState.showTextActions,
        )
      : [];

  const reorderableBlockIds = getReorderableBlocks(blocks).map((block) => block.id);

  function toggleBlockSelection(blockId: string) {
    setSelectedBlockIds((current) => toggleSelectedBlockIds(current, blockId));
  }

  function getActionTargetBlocks(contextBlockId: string) {
    return resolveActionTargetBlocks(blocks, normalizedSelectedBlockIds, contextBlockId);
  }

  function beginDrag(
    event: React.PointerEvent<HTMLElement>,
    blockId: string,
    index: number,
  ) {
    if (event.button !== 0 || isModifierSelection(event) || index === -1) return;

    const target = event.target as HTMLElement;
    if (target.closest("a") || target.closest("[contenteditable='true']")) {
      return;
    }

    const element = itemRefs.current[blockId];
    if (!element) return;

    setActionMenuState(null);
    const reorderableBlocks = getReorderableBlocks(blocks);
    const slotSize = getMeasuredBlockSlotSize(reorderableBlocks, index, itemRefs);

    pendingDragRef.current = {
      id: blockId,
      startY: event.clientY,
      initialIndex: index,
      slotSize,
    };
  }

  function renderBlockHandle(
    block: WorkspacePageBlock,
    reorderIndex: number,
    isDragged: boolean,
    isSelected: boolean,
  ) {
    return (
      <BlockHandle
        isDragged={isDragged}
        isSelected={isSelected}
        isReorderable={reorderIndex !== -1}
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          openContextMenu(event, block);
        }}
        onPointerDown={(event) => beginDrag(event, block.id, reorderIndex)}
      />
    );
  }

  function setItemRef(blockId: string, element: HTMLDivElement | null) {
    itemRefs.current[blockId] = element;
  }

  function setNoteBlockRef(blockId: string, element: InlineNoteBlockHandle | null) {
    noteBlockRefs.current[blockId] = element;
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
        {chapterId ? (
          <input
            type="text"
            className="w-full bg-transparent text-[2.5rem] font-bold tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground/30"
            placeholder="Untitled Page"
            value={
              chapterBridge?.name === "Untitled page" || chapterBridge?.name === "Untitled Page"
                ? ""
                : chapterBridge?.name || ""
            }
            onChange={(e) => {
              if (chapterBridge) {
                const inputValue = e.target.value;
                const nextBridges = bridges.map((b) =>
                  b.id === chapterId ? { ...b, name: inputValue } : b,
                );
                saveBridges(nextBridges);
              }
            }}
          />
        ) : (
          <>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {pageMeta.eyebrow}
            </p>
            <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">{pageMeta.title}</h1>
            <p className="mt-2 max-w-3xl text-[0.9rem] text-muted-foreground">{pageMeta.description}</p>
          </>
        )}
      </div>

      <div className="grid gap-1.5 pt-1">
        {blocks.map((block) => {
          const reorderIndex = reorderableBlockIds.indexOf(block.id);
          const isDragged = dragState?.id === block.id;
          const isSelected = normalizedSelectedBlockIds.includes(block.id);
          const translationY =
            reorderIndex === -1
              ? 0
              : isDragged
                ? dragState.currentY - dragState.startY
                : dragState
                  ? siblingOffset(reorderIndex, dragState)
                  : 0;

          if (isTextBlockKind(block.kind)) {
            return (
              <TextBlockRow
                key={block.id}
                anchorId={getBlockAnchorId(block.id)}
                block={block}
                commands={block.kind === "note" ? getSlashCommands(block) : []}
                editorClassName={headingEditorClassName(block.kind)}
                focusedTarget={focusedTarget}
                isDragged={isDragged}
                isSelected={isSelected}
                placeholder={blockPlaceholder(block.kind)}
                renderBlockHandle={renderBlockHandle(block, reorderIndex, isDragged, isSelected)}
                setItemRef={setItemRef}
                setNoteBlockRef={setNoteBlockRef}
                suppressClickRef={suppressClickRef}
                translationY={translationY}
                onAutoFocusComplete={() => setFocusedTarget(null)}
                onBackspaceAtStart={() => mergeBlockBackward(block.id)}
                onBeforeModifierSelect={() => setActionMenuState(null)}
                onChange={(value) => updateBlockContent(block.id, value)}
                onContextMenu={(event, details) =>
                  openContextMenu(
                    event,
                    block,
                    details?.hasSelection || details?.hasContent || false,
                  )
                }
                onModifierSelect={toggleBlockSelection}
                onNavigateNext={() => focusNextNote(block.id)}
                onNavigatePrevious={() => focusPreviousNote(block.id)}
                onSelectCommand={(commandId) => handleCommandSelection(block.id, commandId)}
                onSplit={(split) => handleSplit(block.id, split)}
              />
            );
          }

          const staticMeta = getStaticBlockMeta(block.kind);
          if (!staticMeta) return null;

          const blockHref = getStaticBlockHref(block);
          const resolvedCard = getResolvedStaticBlockCard(block, bridges);
          const commonStaticProps = {
            anchorId: getBlockAnchorId(block.id),
            block,
            description: resolvedCard.description,
            href: blockHref,
            isDragged,
            isSelected,
            renderBlockHandle: renderBlockHandle(block, reorderIndex, isDragged, isSelected),
            setItemRef,
            suppressClickRef,
            title: resolvedCard.title,
            translationY,
            onActivate: () => handleStaticBlockClick(block),
            onBeforeModifierSelect: () => setActionMenuState(null),
            onContextMenu: (event: React.MouseEvent<HTMLElement>) => openContextMenu(event, block),
            onModifierSelect: toggleBlockSelection,
          };

          if (block.kind === "chapter") {
            return <ChapterBlockRow key={block.id} {...commonStaticProps} />;
          }

          if (block.kind === "api") {
            return <ApiBlockRow key={block.id} {...commonStaticProps} />;
          }

          if (block.kind === "webhook") {
            return <WebhookBlockRow key={block.id} {...commonStaticProps} />;
          }

          return <GrpcBlockRow key={block.id} {...commonStaticProps} />;
        })}
      </div>

      {actionMenuState && actionMenuBlock ? (
        <div
          ref={actionMenuRef}
          className="fixed z-50 min-w-[220px]"
          style={
            actionMenuPosition
              ? { left: actionMenuPosition.left, top: actionMenuPosition.top }
              : { left: -9999, top: -9999 }
          }
          onClick={(event) => event.stopPropagation()}
        >
          <ActionMenu
            items={actionMenuItems}
            onSelectItem={(item) => {
              if (!actionMenuBlock || !actionMenuState) return;

              const context = getActionContext(
                actionMenuBlock,
                actionMenuState.trigger,
                actionMenuState.showTextActions,
              );
              const definition = blockActionDefinitions.find((action) => action.id === item.id);

              if (!definition) return;
              void runDocAction(definition.id, context);
            }}
          />
        </div>
      ) : null}
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

function subscribeToBridges(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key && event.key !== BRIDGE_STORAGE_KEY) return;
    onStoreChange();
  }

  function handleBridgeUpdate() {
    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(BRIDGE_STORAGE_EVENT, handleBridgeUpdate);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(BRIDGE_STORAGE_EVENT, handleBridgeUpdate);
  };
}

function savePageBlocksFor(pageKey: WorkspacePageKey, pageBlocks: WorkspacePageBlock[]) {
  const otherBlocks = loadWorkspacePageBlocks().filter((item) => item.pageKey !== pageKey);
  saveWorkspacePageBlocks([...otherBlocks, ...pageBlocks]);
}

function saveChapterBlocksFor(
  chapterId: string,
  pageBlocks: WorkspacePageBlock[],
  allBridges: BridgeItem[],
) {
  const existingById = new Map(allBridges.map((item) => [item.id, item]));
  const chapterBlocks = pageBlocks.map((block) =>
    pageBlockToChapterBridgeItem(block, existingById.get(block.id), chapterId),
  );
  const bridgesWithoutChapterChildren = allBridges.filter((item) => item.parentChapterId !== chapterId);
  const chapterIndex = bridgesWithoutChapterChildren.findIndex((item) => item.id === chapterId);

  if (chapterIndex === -1) {
    saveBridges([...bridgesWithoutChapterChildren, ...chapterBlocks]);
    return;
  }

  const nextBridges = [
    ...bridgesWithoutChapterChildren.slice(0, chapterIndex + 1),
    ...chapterBlocks,
    ...bridgesWithoutChapterChildren.slice(chapterIndex + 1),
  ];
  saveBridges(nextBridges);
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

  const raw =
    window.sessionStorage.getItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY) ??
    window.localStorage.getItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY);
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

function getChapterBlocksSnapshot(
  bridges: BridgeItem[],
  chapterId: string,
): WorkspacePageBlock[] {
  const blocks = bridges
    .filter((item) => item.parentChapterId === chapterId)
    .map((item) => bridgeItemToPageBlock(item));

  if (!blocks.length || blocks[blocks.length - 1]?.kind !== "note") {
    const createdAt = typeof window === "undefined" ? "0" : new Date().toISOString();
    return [
      ...blocks,
      {
        id: `draft-${chapterId}-note`,
        pageKey: "bridge",
        kind: "note",
        content: "",
        createdAt,
      },
    ];
  }

  return blocks;
}

function getStaticBlockHref(block: WorkspacePageBlock) {
  if (!block.content) return null;

  if (block.kind === "chapter") {
    return getChapterDocHref(block.content);
  }

  if (block.kind === "api" || block.kind === "webhook" || block.kind === "grpc") {
    return `/bridge/${block.content}`;
  }

  return null;
}

function getBlockRoute(kind: WorkspacePageBlockKind, id: string) {
  if (kind === "chapter") return getChapterDocHref(id);
  if (kind === "api" || kind === "webhook" || kind === "grpc") {
    return getBridgeEditHref(id);
  }
  return getBridgeDocRootHref();
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
      name: "Untitled page",
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

function createTextBridgeEntry(
  kind: Extract<WorkspacePageBlockKind, "note" | "heading1" | "heading2" | "heading3">,
  id: string,
  parentChapterId: string,
  createdAt: string,
): BridgeItem {
  return {
    id,
    name:
      kind === "note"
        ? "Untitled note"
        : kind === "heading1"
          ? "Heading 1"
          : kind === "heading2"
            ? "Heading 2"
            : "Heading 3",
    entryKind: kind,
    parentChapterId,
    bridgeType: "api",
    endpoint: "",
    environment: "development",
    createdAt,
  };
}

function getBlockAnchorId(blockId: string) {
  return `page-block-${blockId}`;
}

function isModifierSelection(event: { ctrlKey: boolean; metaKey: boolean }) {
  return event.ctrlKey || event.metaKey;
}

function hasActiveTextSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  return (selection.toString() ?? "").trim().length > 0;
}

function bridgeItemToPageBlock(item: BridgeItem): WorkspacePageBlock {
  const entryKind = item.entryKind ?? "bridge";

  if (entryKind === "note" || entryKind === "heading1" || entryKind === "heading2" || entryKind === "heading3") {
    return {
      id: item.id,
      pageKey: "bridge",
      kind: entryKind,
      content: item.publicNote ?? item.notes ?? "",
      createdAt: item.createdAt,
    };
  }

  if (entryKind === "chapter") {
    return {
      id: item.id,
      pageKey: "bridge",
      kind: "chapter",
      content: item.id,
      createdAt: item.createdAt,
    };
  }

  return {
    id: item.id,
    pageKey: "bridge",
    kind:
      item.bridgeType === "webhook"
        ? "webhook"
        : item.bridgeType === "grpc"
          ? "grpc"
          : "api",
    content: item.id,
    createdAt: item.createdAt,
  };
}

function pageBlockToChapterBridgeItem(
  block: WorkspacePageBlock,
  existingItem: BridgeItem | undefined,
  chapterId: string,
): BridgeItem {
  if (block.kind === "note" || block.kind === "heading1" || block.kind === "heading2" || block.kind === "heading3") {
    const baseItem = existingItem ?? createTextBridgeEntry(block.kind, block.id, chapterId, block.createdAt);

    return {
      ...baseItem,
      id: block.id,
      name:
        block.kind === "note"
          ? "Untitled note"
          : block.kind === "heading1"
            ? "Heading 1"
            : block.kind === "heading2"
              ? "Heading 2"
              : "Heading 3",
      entryKind: block.kind,
      parentChapterId: chapterId,
      publicNote: block.content || undefined,
      notes: undefined,
      createdAt: existingItem?.createdAt ?? block.createdAt,
    };
  }

  if (block.kind === "chapter") {
    const baseItem = existingItem ?? createBridgeEntry("chapter");

    return {
      ...baseItem,
      id: block.id,
      name: existingItem?.name || "Untitled page",
      entryKind: "chapter",
      parentChapterId: chapterId,
      bridgeType: "api",
      endpoint: existingItem?.endpoint ?? "",
      environment: existingItem?.environment ?? "development",
      createdAt: existingItem?.createdAt ?? block.createdAt,
    };
  }

  const bridgeType = block.kind === "webhook" ? "webhook" : block.kind === "grpc" ? "grpc" : "api";
  const baseItem = existingItem ?? createBridgeEntry(bridgeType);

  return {
    ...baseItem,
    id: block.id,
    name:
      existingItem?.name ||
      (bridgeType === "api"
        ? "Untitled API bridge"
        : bridgeType === "webhook"
          ? "Untitled webhook bridge"
          : "Untitled gRPC bridge"),
    entryKind: "bridge",
    parentChapterId: chapterId,
    bridgeType,
    endpoint: existingItem?.endpoint ?? "",
    environment: existingItem?.environment ?? "development",
    method: bridgeType === "api" ? existingItem?.method ?? "GET" : undefined,
    createdAt: existingItem?.createdAt ?? block.createdAt,
  };
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to the execCommand copy path below.
    }
  }

  if (typeof document === "undefined") return;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
