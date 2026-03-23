export type SyncWorkspace = {
  id: string;
  permit: string;
};

export type SyncPage = {
  id: string;
  workspaceId: string;
  title: string;
  icon: string | null;
  cover: string | null;
  createdAt: string;
};

export type SyncBlock = {
  id: string;
  pageId: string;
  type: string;
  content: string;
  position: number;
  createdAt: string;
};

export type SyncBridge = {
  id: string;
  workspaceId: string;
  name: string;
  bridgeType: string;
  endpoint: string;
  environment: string;
  method: string | null;
  apiConfig?: unknown;
  requiredFields?: unknown;
  serviceName?: string | null;
  secret?: string | null;
  isPrivateInternal?: boolean;
  privateNote?: string | null;
  publicNote?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type SyncPinnedPages = {
  id: string;
  workspaceId: string;
  pageIds: string[];
  orderBy: string;
};

export type SyncWorkspaceRecord = SyncWorkspace & {
  accountId: string;
};

export type SyncPageRecord = SyncPage & {
  updatedAt: string;
};

export type SyncBlockRecord = SyncBlock & {
  updatedAt: string;
};

export type SyncBridgeRecord = SyncBridge & {
  updatedAt: string;
};

export type SyncPinnedPagesRecord = SyncPinnedPages & {
  createdAt: string;
  updatedAt: string;
};

export type SyncSnapshot = {
  ok: true;
  accountId: string;
  workspaces: SyncWorkspaceRecord[];
  pages: SyncPageRecord[];
  blocks: SyncBlockRecord[];
  bridges: SyncBridgeRecord[];
  pinnedPages: SyncPinnedPagesRecord[];
};

export type SyncWorkspacesRequest = {
  fullSync: boolean;
  items: SyncWorkspace[];
};

export type SyncPagesRequest = {
  fullSync: boolean;
  bufferedAt: string;
  workspaceIds: string[];
  items: SyncPage[];
};

export type SyncBlocksRequest = {
  fullSync: boolean;
  bufferedAt: string;
  pageIds: string[];
  items: SyncBlock[];
};

export type SyncBridgesRequest = {
  fullSync: boolean;
  bufferedAt: string;
  workspaceIds: string[];
  items: SyncBridge[];
};

export type SyncPinnedPagesRequest = {
  fullSync: boolean;
  workspaceIds: string[];
  items: SyncPinnedPages[];
};

export type SyncCollectionOkResponse<TField extends string, TItem> = {
  ok: true;
  accountId: string;
} & Record<TField, TItem[]>;
