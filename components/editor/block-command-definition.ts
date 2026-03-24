import type {
  BlockActionContext,
  BlockActionTrigger,
} from "./block-action-context";

export type BlockCommandDefinition = {
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
