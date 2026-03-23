import { fetchRequest } from "@/functions/request";
import type {
  SyncBlocksRequest,
  SyncBridgesRequest,
  SyncCollectionOkResponse,
  SyncPageRecord,
  SyncPagesRequest,
  SyncPinnedPagesRecord,
  SyncPinnedPagesRequest,
  SyncSnapshot,
  SyncWorkspaceRecord,
  SyncWorkspacesRequest,
  SyncBlockRecord,
  SyncBridgeRecord,
} from "@/services/sync-types";

export class SyncApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.name = "SyncApiError";
    this.status = status;
    this.data = data;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetchRequest(url, init);
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed with status ${response.status}.`;
    throw new SyncApiError(response.status, message, data);
  }

  return data as T;
}

export async function loadSyncSnapshot(): Promise<SyncSnapshot> {
  const [workspacesResponse, pagesResponse, blocksResponse, bridgesResponse, pinnedPagesResponse] =
    await Promise.all([
      requestJson<SyncCollectionOkResponse<"workspaces", SyncWorkspaceRecord>>("/api/workspaces", {
        method: "GET",
        cache: "no-store",
      }),
      requestJson<SyncCollectionOkResponse<"pages", SyncPageRecord>>("/api/pages", {
        method: "GET",
        cache: "no-store",
      }),
      requestJson<SyncCollectionOkResponse<"blocks", SyncBlockRecord>>("/api/blocks", {
        method: "GET",
        cache: "no-store",
      }),
      requestJson<SyncCollectionOkResponse<"bridges", SyncBridgeRecord>>("/api/bridges", {
        method: "GET",
        cache: "no-store",
      }),
      requestJson<SyncCollectionOkResponse<"pinnedPages", SyncPinnedPagesRecord>>("/api/pinned-pages", {
        method: "GET",
        cache: "no-store",
      }),
    ]);

  return {
    ok: true,
    accountId: workspacesResponse.accountId,
    workspaces: workspacesResponse.workspaces,
    pages: pagesResponse.pages,
    blocks: blocksResponse.blocks,
    bridges: bridgesResponse.bridges,
    pinnedPages: pinnedPagesResponse.pinnedPages,
  };
}

export async function flushSyncSnapshot(payload: {
  fullSync: boolean;
  bufferedAt: string;
  workspaces: SyncWorkspacesRequest["items"];
  pages: SyncPagesRequest["items"];
  blocks: SyncBlocksRequest["items"];
  bridges: SyncBridgesRequest["items"];
  pinnedPages: SyncPinnedPagesRequest["items"];
}) {
  const workspaceIds = payload.workspaces.map((workspace) => workspace.id);
  const pageIds = payload.pages.map((page) => page.id);

  await requestJson<{ ok: true }>("/api/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullSync: payload.fullSync,
      items: payload.workspaces,
    } satisfies SyncWorkspacesRequest),
  });

  await requestJson<{ ok: true }>("/api/pages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullSync: payload.fullSync,
      bufferedAt: payload.bufferedAt,
      workspaceIds,
      items: payload.pages,
    } satisfies SyncPagesRequest),
  });

  await requestJson<{ ok: true }>("/api/blocks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullSync: payload.fullSync,
      bufferedAt: payload.bufferedAt,
      pageIds,
      items: payload.blocks,
    } satisfies SyncBlocksRequest),
  });

  await requestJson<{ ok: true }>("/api/bridges", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullSync: payload.fullSync,
      bufferedAt: payload.bufferedAt,
      workspaceIds,
      items: payload.bridges,
    } satisfies SyncBridgesRequest),
  });

  await requestJson<{ ok: true }>("/api/pinned-pages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullSync: payload.fullSync,
      workspaceIds,
      items: payload.pinnedPages,
    } satisfies SyncPinnedPagesRequest),
  });
}
