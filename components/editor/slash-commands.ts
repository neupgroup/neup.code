import type { WorkspacePageKey } from "../../app/page-blocks-storage";
import type { BlockActionContext } from "./block-action-context";
import type { BlockCommandDefinition } from "./block-command-definition";
import { getAddActionDefinitions } from "./command-blocks";
import type { SlashCommand } from "./inline-note-block";

export function getSlashCommandDefinitions(
  pageKey: WorkspacePageKey,
): BlockCommandDefinition[] {
  return getAddActionDefinitions(pageKey).map((definition) => ({
    ...definition,
    triggers: ["slash"] as const,
  }));
}

export function getSlashCommands(
  definitions: BlockCommandDefinition[],
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
