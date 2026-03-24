import type { ActionMenuItem } from "./action-menu";
import type {
  BlockActionContext,
  BlockActionTrigger,
} from "./block-action-context";
import { getAddActionDefinitions } from "./command-blocks";
import type { SlashCommand } from "./inline-note-block";
import type {
  WorkspacePageBlock,
  WorkspacePageKey,
} from "../../app/page-blocks-storage";

export type BlockActionDefinition = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  sectionTitle: string;
  triggers: BlockActionTrigger[];
  tone?: "default" | "danger";
  isVisible?: (context: BlockActionContext) => boolean;
  isDisabled?: (context: BlockActionContext) => boolean;
};

type GetBlockActionDefinitionsOptions = {
  blocks: WorkspacePageBlock[];
  canMoveBlock: (
    blocks: WorkspacePageBlock[],
    currentIndex: number,
    direction: "up" | "down",
  ) => boolean;
  isTextBlockKind: (kind: WorkspacePageBlock["kind"]) => boolean;
  pageKey: WorkspacePageKey;
};

export function getBlockActionDefinitions({
  blocks,
  canMoveBlock,
  isTextBlockKind,
  pageKey,
}: GetBlockActionDefinitionsOptions): BlockActionDefinition[] {
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
      triggers: ["slash", "context"] as BlockActionTrigger[],
    })),
  ];
}

export function getActionMenuItems(
  definitions: BlockActionDefinition[],
  context: BlockActionContext,
): ActionMenuItem[] {
  return definitions
    .filter((definition) => definition.triggers.includes(context.trigger))
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

export function getSlashCommands(
  definitions: BlockActionDefinition[],
  context: BlockActionContext,
): SlashCommand[] {
  return definitions
    .filter((definition) => definition.triggers.includes("slash"))
    .filter((definition) => definition.isVisible?.(context) ?? true)
    .map((definition) => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      keywords: definition.keywords,
      sectionTitle: definition.sectionTitle,
    }));
}

