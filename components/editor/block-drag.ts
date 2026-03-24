import type { MutableRefObject } from "react";
import type { WorkspacePageBlock } from "../../app/page-blocks-storage";
import { richTextHasContent } from "../../app/bridge/rich-text";

export type DragState = {
  id: string;
  startY: number;
  currentY: number;
  initialIndex: number;
  targetIndex: number;
  slotSize: number;
};

export type PendingDragState = {
  id: string;
  startY: number;
  initialIndex: number;
  slotSize: number;
};

export const DRAG_START_THRESHOLD = 6;

export function getReorderableBlocks(blocks: WorkspacePageBlock[]) {
  return blocks.filter(
    (block, index) => !isTrailingEmptyNoteBlock(blocks, block, index),
  );
}

export function reorderPageBlocks(
  items: WorkspacePageBlock[],
  sourceId: string,
  targetIndex: number,
) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  if (sourceIndex === -1) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  if (!movedItem) return items;
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

export function siblingOffset(index: number, dragState: DragState) {
  const distance = dragState.slotSize;

  if (dragState.initialIndex < dragState.targetIndex) {
    if (index > dragState.initialIndex && index <= dragState.targetIndex) {
      return -distance;
    }
  } else if (dragState.initialIndex > dragState.targetIndex) {
    if (index >= dragState.targetIndex && index < dragState.initialIndex) {
      return distance;
    }
  }

  return 0;
}

export function getMeasuredBlockSlotSize(
  blocks: WorkspacePageBlock[],
  index: number,
  itemRefs: MutableRefObject<Record<string, HTMLDivElement | null>>,
) {
  const block = blocks[index];
  const element = block ? itemRefs.current[block.id] : null;

  if (!block || !element) {
    return 0;
  }

  const currentRect = element.getBoundingClientRect();
  const nextBlock = index < blocks.length - 1 ? blocks[index + 1] : null;
  const nextElement = nextBlock ? itemRefs.current[nextBlock.id] : null;

  if (nextElement) {
    const nextRect = nextElement.getBoundingClientRect();
    return Math.max(nextRect.top - currentRect.top, currentRect.height);
  }

  const previousBlock = index > 0 ? blocks[index - 1] : null;
  const previousElement = previousBlock ? itemRefs.current[previousBlock.id] : null;

  if (previousElement) {
    const previousRect = previousElement.getBoundingClientRect();
    return Math.max(currentRect.top - previousRect.top, currentRect.height);
  }

  return currentRect.height;
}

export function canMoveBlock(
  blocks: WorkspacePageBlock[],
  currentIndex: number,
  direction: "up" | "down",
) {
  if (direction === "up") {
    return currentIndex > 0;
  }

  if (currentIndex < 0 || currentIndex >= blocks.length - 1) {
    return false;
  }

  const currentBlock = blocks[currentIndex];
  const lastBlock = blocks[blocks.length - 1];

  if (
    currentBlock &&
    currentBlock.kind !== "note" &&
    lastBlock?.kind === "note" &&
    currentIndex === blocks.length - 2
  ) {
    return false;
  }

  return true;
}

function isTrailingEmptyNoteBlock(
  blocks: WorkspacePageBlock[],
  block: WorkspacePageBlock,
  index: number,
) {
  return (
    index === blocks.length - 1 &&
    block.kind === "note" &&
    !richTextHasContent(block.content)
  );
}

