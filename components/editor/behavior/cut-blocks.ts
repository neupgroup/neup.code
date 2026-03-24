import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";

export function removeBlocksById(
  blocks: WorkspacePageBlock[],
  blockIds: string[],
) {
  const targetIds = new Set(blockIds);
  return blocks.filter((block) => !targetIds.has(block.id));
}
