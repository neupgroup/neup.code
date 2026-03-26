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
      triggers: ["context", "selection"],
    },
    {
      id: "copy-link",
      label: "Copy link",
      sectionTitle: "Block",
      triggers: ["context", "selection"],
    },
    {
      id: "move-up",
      label: "Move up",
      sectionTitle: "Block",
      triggers: ["context", "selection"],
      isDisabled: (context) => !canMoveBlock(blocks, context.blockIndex, "up"),
    },
    {
      id: "move-down",
      label: "Move down",
      sectionTitle: "Block",
      triggers: ["context", "selection"],
      isDisabled: (context) => !canMoveBlock(blocks, context.blockIndex, "down"),
    },
    {
      id: "bold",
      label: "Bold",
      compactLabel: "B",
      sectionTitle: "Style",
      triggers: ["context", "selection"],
      menuLayout: "grid",
      isVisible: (context) =>
        context.showTextActions && isTextBlockKind(context.block.kind),
      isActive: (context) => context.activeTextFormats.bold,
    },
    {
      id: "italic",
      label: "Italic",
      compactLabel: "I",
      sectionTitle: "Style",
      triggers: ["context", "selection"],
      menuLayout: "grid",
      isVisible: (context) =>
        context.showTextActions && isTextBlockKind(context.block.kind),
      isActive: (context) => context.activeTextFormats.italic,
    },
    {
      id: "underline",
      label: "Underline",
      compactLabel: "U",
      sectionTitle: "Style",
      triggers: ["context", "selection"],
      menuLayout: "grid",
      isVisible: (context) =>
        context.showTextActions && isTextBlockKind(context.block.kind),
      isActive: (context) => context.activeTextFormats.underline,
    },
    ...getAddActionDefinitions(pageKey).map((definition): BlockCommandDefinition => ({
      ...definition,
      triggers: ["context"],
    })),
  ];
}

export function getRightClickMenuItems(
  definitions: BlockCommandDefinition[],
  context: BlockActionContext,
): ContextMenuItem[] {
  return definitions
    .filter((definition) => definition.triggers.includes(context.trigger))
    .filter((definition) => definition.isVisible?.(context) ?? true)
    .map((definition) => ({
      id: definition.id,
      label: definition.label,
      compactLabel: definition.compactLabel,
      description: definition.description,
      sectionTitle: definition.sectionTitle,
      tone: definition.tone,
      menuLayout: definition.menuLayout,
      active: definition.isActive?.(context) ?? false,
      disabled: definition.isDisabled?.(context) ?? false,
    }));
}
