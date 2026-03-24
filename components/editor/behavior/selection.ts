import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";

export function toggleSelectedBlockIds(
  selectedBlockIds: string[],
  blockId: string,
) {
  return selectedBlockIds.includes(blockId)
    ? selectedBlockIds.filter((id) => id !== blockId)
    : [...selectedBlockIds, blockId];
}

export function resolveActionTargetBlocks(
  blocks: WorkspacePageBlock[],
  normalizedSelectedBlockIds: string[],
  contextBlockId: string,
) {
  const targetIds = normalizedSelectedBlockIds.includes(contextBlockId)
    ? normalizedSelectedBlockIds
    : [contextBlockId];

  return blocks.filter((block) => targetIds.includes(block.id));
}
