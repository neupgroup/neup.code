import type { WorkspacePageBlock } from "../../app/page-blocks-storage";

export type BlockActionTrigger = "slash" | "context" | "selection";
export type TextFormat = "bold" | "italic" | "underline";
export type TextFormatState = Record<TextFormat, boolean>;

export const EMPTY_TEXT_FORMAT_STATE: TextFormatState = {
  bold: false,
  italic: false,
  underline: false,
};

export type ActionMenuState = {
  x: number;
  y: number;
  blockId: string;
  showTextActions: boolean;
  activeTextFormats: TextFormatState;
  trigger: BlockActionTrigger;
  anchorBottom?: number;
};

export type BlockActionContext = {
  block: WorkspacePageBlock;
  blockIndex: number;
  showTextActions: boolean;
  activeTextFormats: TextFormatState;
  trigger: BlockActionTrigger;
};
