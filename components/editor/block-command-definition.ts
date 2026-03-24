import type {
  BlockActionContext,
  BlockActionTrigger,
} from "./block-action-context";

export type BlockCommandDefinition = {
  id: string;
  label: string;
  compactLabel?: string;
  description?: string;
  keywords?: string[];
  sectionTitle: string;
  triggers: BlockActionTrigger[];
  menuLayout?: "list" | "grid";
  tone?: "default" | "danger";
  isVisible?: (context: BlockActionContext) => boolean;
  isDisabled?: (context: BlockActionContext) => boolean;
  isActive?: (context: BlockActionContext) => boolean;
};
