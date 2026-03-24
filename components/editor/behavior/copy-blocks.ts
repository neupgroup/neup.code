import type { BridgeItem } from "../../../app/bridge/bridge-storage";
import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";

type StaticCard = {
  title: string;
  description: string;
};

type CopyBlocksOptions = {
  blocks: WorkspacePageBlock[];
  blockIds: string[];
  bridges: BridgeItem[];
  isTextBlockKind: (kind: WorkspacePageBlock["kind"]) => boolean;
  getResolvedStaticBlockCard: (block: WorkspacePageBlock, bridges: BridgeItem[]) => StaticCard;
  getStaticBlockHref: (block: WorkspacePageBlock) => string | null;
  richTextToPlainText: (html: string) => string;
  copyTextToClipboard: (value: string) => Promise<void>;
};

export function serializeBlocksForClipboard({
  blocks,
  blockIds,
  bridges,
  isTextBlockKind,
  getResolvedStaticBlockCard,
  getStaticBlockHref,
  richTextToPlainText,
}: Omit<CopyBlocksOptions, "copyTextToClipboard">) {
  return blocks
    .filter((block) => blockIds.includes(block.id))
    .map((block) => {
      if (isTextBlockKind(block.kind)) {
        return richTextToPlainText(block.content);
      }

      const resolvedCard = getResolvedStaticBlockCard(block, bridges);
      const href = getStaticBlockHref(block);
      const lines = [resolvedCard.title];

      if (resolvedCard.description) {
        lines.push(resolvedCard.description);
      }

      if (href && typeof window !== "undefined") {
        lines.push(new URL(href, window.location.origin).toString());
      }

      return lines.filter(Boolean).join("\n");
    })
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n\n");
}

export async function copyBlocksToClipboard(options: CopyBlocksOptions) {
  const serialized = serializeBlocksForClipboard(options);
  if (!serialized) return;
  await options.copyTextToClipboard(serialized);
}
