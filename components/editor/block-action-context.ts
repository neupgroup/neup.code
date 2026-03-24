import type { WorkspacePageBlock } from "../../app/page-blocks-storage";

export type BlockActionTrigger = "slash" | "context";

export type ActionMenuState = {
  x: number;
  y: number;
  blockId: string;
  showTextActions: boolean;
  trigger: BlockActionTrigger;
};

export type BlockActionContext = {
  block: WorkspacePageBlock;
  blockIndex: number;
  showTextActions: boolean;
  trigger: BlockActionTrigger;
};

