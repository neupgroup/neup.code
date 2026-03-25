import type { BridgeEntryKind, BridgeItem } from "../bridge/bridge-storage";
import { loadBridges, saveBridges } from "../bridge/bridge-storage";

type DefaultPageBlockTemplate = {
  entryKind: Extract<BridgeEntryKind, "note" | "heading1" | "heading2" | "heading3">;
  content: string;
};

type DefaultPageTemplate = {
  title: string;
  blocks: DefaultPageBlockTemplate[];
};

export const defaultPage_en: DefaultPageTemplate = {
  title: "Index",
  blocks: [
    {
      entryKind: "note",
      content: "",
    },
  ],
};

function createLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createBlockName(entryKind: DefaultPageBlockTemplate["entryKind"]) {
  if (entryKind === "note") return "Untitled note";
  if (entryKind === "heading1") return "Heading 1";
  if (entryKind === "heading2") return "Heading 2";
  return "Heading 3";
}

export function createDefaultPageItemsForWorkspace(workspaceId: string): BridgeItem[] {
  const pageId = createLocalId();
  const createdAt = new Date().toISOString();

  const page: BridgeItem = {
    id: pageId,
    name: defaultPage_en.title,
    entryKind: "chapter",
    bridgeType: "api",
    endpoint: "",
    environment: "development",
    createdAt,
    workspaceId,
  };

  const blocks = defaultPage_en.blocks.map<BridgeItem>((block) => ({
    id: createLocalId(),
    name: createBlockName(block.entryKind),
    entryKind: block.entryKind,
    parentChapterId: pageId,
    bridgeType: "api",
    endpoint: "",
    environment: "development",
    createdAt: new Date().toISOString(),
    publicNote: block.content || undefined,
    notes: undefined,
  }));

  return [page, ...blocks];
}

export function seedDefaultPageForWorkspace(workspaceId: string) {
  const bridges = loadBridges();
  const hasRootPage = bridges.some(
    (item) =>
      item.workspaceId === workspaceId &&
      (item.entryKind ?? "bridge") === "chapter" &&
      !item.parentChapterId,
  );

  if (hasRootPage) {
    return null;
  }

  const nextItems = createDefaultPageItemsForWorkspace(workspaceId);
  saveBridges([...nextItems, ...bridges]);
  return nextItems[0] ?? null;
}
