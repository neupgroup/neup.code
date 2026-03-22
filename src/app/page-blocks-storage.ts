export type WorkspacePageKey = "bridge" | "design" | "components";
export type WorkspacePageBlockKind =
  | "note"
  | "heading1"
  | "heading2"
  | "heading3"
  | "chapter"
  | "api"
  | "webhook"
  | "grpc"
  | "component";

export type WorkspacePageBlock = {
  id: string;
  pageKey: WorkspacePageKey;
  kind: WorkspacePageBlockKind;
  content: string;
  createdAt: string;
};

export const WORKSPACE_PAGE_BLOCKS_STORAGE_KEY = "neup.code.workspace.page-blocks.v1";
export const WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT = "neup.code.workspace.page-blocks.updated";
const BRIDGE_RESOURCE_BLOCK_KINDS = new Set<WorkspacePageBlockKind>([
  "chapter",
  "api",
  "webhook",
  "grpc",
]);

function isWorkspacePageKey(value: string): value is WorkspacePageKey {
  return value === "bridge" || value === "design" || value === "components";
}

function isWorkspacePageBlockKind(value: string): value is WorkspacePageBlockKind {
  return (
    value === "note" ||
    value === "heading1" ||
    value === "heading2" ||
    value === "heading3" ||
    value === "chapter" ||
    value === "api" ||
    value === "webhook" ||
    value === "grpc" ||
    value === "component"
  );
}

function isWorkspacePageBlock(value: unknown): value is WorkspacePageBlock {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.content === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.pageKey === "string" &&
    typeof item.kind === "string" &&
    isWorkspacePageKey(item.pageKey) &&
    isWorkspacePageBlockKind(item.kind)
  );
}

export function parseWorkspacePageBlocks(value: unknown): WorkspacePageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkspacePageBlock => isWorkspacePageBlock(item));
}

export function loadWorkspacePageBlocks(): WorkspacePageBlock[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return parseWorkspacePageBlocks(parsed);
  } catch {
    return [];
  }
}

export function loadWorkspacePageBlocksFor(pageKey: WorkspacePageKey) {
  return loadWorkspacePageBlocks().filter((item) => item.pageKey === pageKey);
}

export function saveWorkspacePageBlocks(items: WorkspacePageBlock[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT));
}

export function filterWorkspacePageBlocksByResources(
  blocks: WorkspacePageBlock[],
  validBridgeIds: string[],
  validComponentIds: string[],
) {
  const bridgeIds = new Set(validBridgeIds);
  const componentIds = new Set(validComponentIds);

  return blocks.filter((block) => {
    if (BRIDGE_RESOURCE_BLOCK_KINDS.has(block.kind)) {
      return !block.content || bridgeIds.has(block.content);
    }

    if (block.kind === "component") {
      return !block.content || componentIds.has(block.content);
    }

    return true;
  });
}

export function cleanupOrphanedWorkspaceBridgeBlocks(validBridgeIds: string[]) {
  const validIds = new Set(validBridgeIds);
  const currentBlocks = loadWorkspacePageBlocks();
  const nextBlocks = currentBlocks.filter(
    (block) =>
      !BRIDGE_RESOURCE_BLOCK_KINDS.has(block.kind) ||
      !block.content ||
      validIds.has(block.content),
  );

  if (nextBlocks.length !== currentBlocks.length) {
    saveWorkspacePageBlocks(nextBlocks);
  }
}

export function cleanupOrphanedWorkspaceComponentBlocks(validComponentIds: string[]) {
  const validIds = new Set(validComponentIds);
  const currentBlocks = loadWorkspacePageBlocks();
  const nextBlocks = currentBlocks.filter(
    (block) => block.kind !== "component" || !block.content || validIds.has(block.content),
  );

  if (nextBlocks.length !== currentBlocks.length) {
    saveWorkspacePageBlocks(nextBlocks);
  }
}
