import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";

export function moveBlockInDirection(
  blocks: WorkspacePageBlock[],
  blockId: string,
  direction: "up" | "down",
) {
  const currentIndex = blocks.findIndex((block) => block.id === blockId);
  if (currentIndex === -1) return null;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= blocks.length) return null;

  const nextBlocks = [...blocks];
  const [movedBlock] = nextBlocks.splice(currentIndex, 1);
  if (!movedBlock) return null;
  nextBlocks.splice(targetIndex, 0, movedBlock);
  return nextBlocks;
}
