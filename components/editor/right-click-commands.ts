import type { WorkspacePageBlock, WorkspacePageKey } from "../../app/page-blocks-storage";
import type { BlockActionContext } from "./block-action-context";
import type { BlockCommandDefinition } from "./block-command-definition";
import type { ContextMenuItem } from "./context-menu-interface";
import { getAddActionDefinitions } from "./command-blocks";

type GetRightClickCommandDefinitionsOptions = {
  blocks: WorkspacePageBlock[];
  canMoveBlock: (
    blocks: WorkspacePageBlock[],
    currentIndex: number,
    direction: "up" | "down",
  ) => boolean;
  isTextBlockKind: (kind: WorkspacePageBlock["kind"]) => boolean;
  pageKey: WorkspacePageKey;
};

export function getRightClickCommandDefinitions({
  blocks,
  canMoveBlock,
  isTextBlockKind,
  pageKey,
}: GetRightClickCommandDefinitionsOptions): BlockCommandDefinition[] {
  return [
    {
      id: "cut",
      label: "Cut",
      sectionTitle: "Block",
      triggers: ["context"],
    },
    {
      id: "copy-link",
      label: "Copy link",
      sectionTitle: "Block",
      triggers: ["context"],
    },
    {
      id: "move-up",
      label: "Move up",
      sectionTitle: "Block",
      triggers: ["context"],
      isDisabled: (context) => !canMoveBlock(blocks, context.blockIndex, "up"),
    },
    {
      id: "move-down",
      label: "Move down",
      sectionTitle: "Block",
      triggers: ["context"],
      isDisabled: (context) => !canMoveBlock(blocks, context.blockIndex, "down"),
    },
    {
      id: "bold",
      label: "Bold",
      sectionTitle: "Style",
      triggers: ["context"],
      isVisible: (context) =>
        context.showTextActions && isTextBlockKind(context.block.kind),
    },
    {
      id: "italic",
      label: "Italic",
      sectionTitle: "Style",
      triggers: ["context"],
      isVisible: (context) =>
        context.showTextActions && isTextBlockKind(context.block.kind),
    },
    {
      id: "underline",
      label: "Underline",
      sectionTitle: "Style",
      triggers: ["context"],
      isVisible: (context) =>
        context.showTextActions && isTextBlockKind(context.block.kind),
    },
    ...getAddActionDefinitions(pageKey).map((definition) => ({
      ...definition,
      triggers: ["context"] as const,
    })),
  ];
}

export function getRightClickMenuItems(
  definitions: BlockCommandDefinition[],
  context: BlockActionContext,
): ContextMenuItem[] {
  return definitions
    .filter((definition) => definition.triggers.includes("context"))
    .filter((definition) => definition.isVisible?.(context) ?? true)
    .map((definition) => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      sectionTitle: definition.sectionTitle,
      tone: definition.tone,
      disabled: definition.isDisabled?.(context) ?? false,
    }));
}
