export type WorkspacePageKey = "bridge";
export type WorkspacePageBlockKind =
  | "note"
  | "heading1"
  | "heading2"
  | "heading3"
  | "chapter"
  | "api"
  | "webhook"
  | "grpc";

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

function readWorkspacePageBlocksRaw() {
  if (typeof window === "undefined") return null;
  return (
    window.sessionStorage.getItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY) ??
    window.localStorage.getItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY)
  );
}

function isWorkspacePageKey(value: string): value is WorkspacePageKey {
  return value === "bridge";
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
    value === "grpc"
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
    const raw = readWorkspacePageBlocksRaw();
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
  window.sessionStorage.setItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY, JSON.stringify(items));
  window.localStorage.removeItem(WORKSPACE_PAGE_BLOCKS_STORAGE_KEY);
  window.dispatchEvent(new Event(WORKSPACE_PAGE_BLOCKS_STORAGE_EVENT));
}

export function filterWorkspacePageBlocksByResources(
  blocks: WorkspacePageBlock[],
  validBridgeIds: string[],
) {
  const bridgeIds = new Set(validBridgeIds);

  return blocks.filter((block) => {
    if (BRIDGE_RESOURCE_BLOCK_KINDS.has(block.kind)) {
      return !block.content || bridgeIds.has(block.content);
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
