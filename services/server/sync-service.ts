import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/client";
import type {
  SyncBlock,
  SyncBlockRecord,
  SyncBlocksRequest,
  SyncBridge,
  SyncBridgeRecord,
  SyncBridgesRequest,
  SyncPage,
  SyncPageRecord,
  SyncPagesRequest,
  SyncPinnedPages,
  SyncPinnedPagesRecord,
  SyncPinnedPagesRequest,
  SyncWorkspace,
  SyncWorkspaceRecord,
  SyncWorkspacesRequest,
} from "@/services/sync-types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toBridgeJsonField(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (isRecord(value) || Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }

  return Prisma.DbNull;
}

function toPageIdsJsonField(value: string[]): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function toSyncPageRecord(page: {
  id: string;
  workspaceId: string;
  title: string;
  icon: string | null;
  cover: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SyncPageRecord {
  return {
    id: page.id,
    workspaceId: page.workspaceId,
    title: page.title,
    icon: page.icon,
    cover: page.cover,
    createdAt: toIsoString(page.createdAt),
    updatedAt: toIsoString(page.updatedAt),
  };
}

function toSyncBlockRecord(block: {
  id: string;
  pageId: string;
  type: string;
  content: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): SyncBlockRecord {
  return {
    id: block.id,
    pageId: block.pageId,
    type: block.type,
    content: block.content,
    position: block.position,
    createdAt: toIsoString(block.createdAt),
    updatedAt: toIsoString(block.updatedAt),
  };
}

function toSyncBridgeRecord(bridge: {
  id: string;
  workspaceId: string;
  name: string;
  bridgeType: string;
  endpoint: string;
  environment: string;
  method: string | null;
  apiConfig: Prisma.JsonValue | null;
  requiredFields: Prisma.JsonValue | null;
  serviceName: string | null;
  secret: string | null;
  isPrivateInternal: boolean;
  privateNote: string | null;
  publicNote: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SyncBridgeRecord {
  return {
    id: bridge.id,
    workspaceId: bridge.workspaceId,
    name: bridge.name,
    bridgeType: bridge.bridgeType,
    endpoint: bridge.endpoint,
    environment: bridge.environment,
    method: bridge.method,
    apiConfig: bridge.apiConfig ?? undefined,
    requiredFields: bridge.requiredFields ?? undefined,
    serviceName: bridge.serviceName,
    secret: bridge.secret,
    isPrivateInternal: bridge.isPrivateInternal,
    privateNote: bridge.privateNote,
    publicNote: bridge.publicNote,
    notes: bridge.notes,
    createdAt: toIsoString(bridge.createdAt),
    updatedAt: toIsoString(bridge.updatedAt),
  };
}

function toSyncPinnedPagesRecord(item: {
  id: string;
  workspaceId: string;
  pageIds: Prisma.JsonValue;
  orderBy: string;
  createdAt: Date;
  updatedAt: Date;
}): SyncPinnedPagesRecord {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    pageIds: Array.isArray(item.pageIds) ? (item.pageIds as string[]) : [],
    orderBy: item.orderBy,
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
  };
}

export async function requireSyncAccountId() {
  const cookieStore = await cookies();
  const accountId = cookieStore.get("auth_account_id")?.value?.trim();
  const sessionId = cookieStore.get("auth_session_id")?.value?.trim();
  const sessionKey = cookieStore.get("auth_session_key")?.value?.trim();

  if (!accountId || !sessionId || !sessionKey) {
    return null;
  }

  return accountId;
}

let ensuredSchema = false;

export async function ensureSyncSchema() {
  if (ensuredSchema) return;

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "public";`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT NOT NULL,
      CONSTRAINT "account_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "workspace" (
      "id" TEXT NOT NULL,
      "account_id" TEXT NOT NULL,
      "permit" TEXT NOT NULL DEFAULT 'owner',
      CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "page" (
      "id" TEXT NOT NULL,
      "workspace_id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "icon" VARCHAR(256),
      "cover" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "page_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "block" (
      "id" TEXT NOT NULL,
      "page_id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "content" TEXT NOT NULL DEFAULT '',
      "position" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "block_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "pinned_pages" (
      "id" TEXT NOT NULL,
      "workspace_id" TEXT NOT NULL,
      "page_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "order_by" TEXT NOT NULL DEFAULT 'custom',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "pinned_pages_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "pinned_pages_workspace_id_key"
    ON "pinned_pages"("workspace_id");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "bridges" (
      "id" TEXT NOT NULL,
      "workspace_id" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "bridge_type" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL DEFAULT '',
      "environment" TEXT NOT NULL DEFAULT 'development',
      "method" TEXT,
      "api_config" JSONB,
      "required_fields" JSONB,
      "service_name" TEXT,
      "secret" TEXT,
      "is_private_internal" BOOLEAN NOT NULL DEFAULT false,
      "private_note" TEXT,
      "public_note" TEXT,
      "notes" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "bridges_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "workspace_account_id_idx"
    ON "workspace"("account_id");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "page_workspace_id_idx"
    ON "page"("workspace_id");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "block_page_id_idx"
    ON "block"("page_id");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "block_page_id_position_idx"
    ON "block"("page_id", "position");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "bridges_workspace_id_idx"
    ON "bridges"("workspace_id");
  `);

  ensuredSchema = true;
}

export function isSyncWorkspacesRequest(value: unknown): value is SyncWorkspacesRequest {
  return isRecord(value) && typeof value.fullSync === "boolean" && Array.isArray(value.items);
}

export function isSyncPagesRequest(value: unknown): value is SyncPagesRequest {
  return (
    isRecord(value) &&
    typeof value.fullSync === "boolean" &&
    typeof value.bufferedAt === "string" &&
    isStringArray(value.workspaceIds) &&
    Array.isArray(value.items)
  );
}

export function isSyncBlocksRequest(value: unknown): value is SyncBlocksRequest {
  return (
    isRecord(value) &&
    typeof value.fullSync === "boolean" &&
    typeof value.bufferedAt === "string" &&
    isStringArray(value.pageIds) &&
    Array.isArray(value.items)
  );
}

export function isSyncBridgesRequest(value: unknown): value is SyncBridgesRequest {
  return (
    isRecord(value) &&
    typeof value.fullSync === "boolean" &&
    typeof value.bufferedAt === "string" &&
    isStringArray(value.workspaceIds) &&
    Array.isArray(value.items)
  );
}

export function isSyncPinnedPagesRequest(value: unknown): value is SyncPinnedPagesRequest {
  return (
    isRecord(value) &&
    typeof value.fullSync === "boolean" &&
    isStringArray(value.workspaceIds) &&
    Array.isArray(value.items)
  );
}

async function ensureAccount(accountId: string) {
  await prisma.account.upsert({ where: { id: accountId }, create: { id: accountId }, update: {} });
}

async function listWorkspaceIds(accountId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: { accountId },
    select: { id: true },
  });
  return workspaces.map((workspace) => workspace.id);
}

async function listPageIds(accountId: string) {
  const pages = await prisma.page.findMany({
    where: { workspace: { accountId } },
    select: { id: true },
  });
  return pages.map((page) => page.id);
}

export async function getWorkspacesForAccount(accountId: string): Promise<SyncWorkspaceRecord[]> {
  await ensureAccount(accountId);
  return prisma.workspace.findMany({
    where: { accountId },
    orderBy: { id: "asc" },
  });
}

export async function syncWorkspacesForAccount(accountId: string, body: SyncWorkspacesRequest) {
  await ensureAccount(accountId);

  const workspaceIds = body.items.map((workspace) => workspace.id);
  await prisma.$transaction(async (tx) => {
    const conflicts = await tx.workspace.findMany({
      where: { id: { in: workspaceIds }, NOT: { accountId } },
      select: { id: true },
    });
    if (conflicts.length) {
      throw new Error("Workspace id conflict.");
    }

    for (const workspace of body.items) {
      await tx.workspace.upsert({
        where: { id: workspace.id },
        create: {
          id: workspace.id,
          accountId,
          permit: workspace.permit ?? "owner",
        },
        update: {
          accountId,
          permit: workspace.permit ?? "owner",
        },
      });
    }

    if (body.fullSync) {
      await tx.workspace.deleteMany({
        where: {
          accountId,
          ...(workspaceIds.length ? { id: { notIn: workspaceIds } } : {}),
        },
      });
    }
  });
}

export async function getPagesForAccount(accountId: string): Promise<SyncPageRecord[]> {
  await ensureAccount(accountId);
  const workspaceIds = await listWorkspaceIds(accountId);
  const pages = await prisma.page.findMany({
    where: { workspaceId: { in: workspaceIds } },
    orderBy: { createdAt: "asc" },
  });
  return pages.map(toSyncPageRecord);
}

export async function syncPagesForAccount(accountId: string, body: SyncPagesRequest) {
  await ensureAccount(accountId);
  const bufferedAt = parseDate(body.bufferedAt) ?? new Date();

  const invalidPages = body.items.filter((page) => !body.workspaceIds.includes(page.workspaceId));
  if (invalidPages.length) {
    throw new Error("Invalid page workspace.");
  }

  const pageIds = body.items.map((page) => page.id);
  await prisma.$transaction(async (tx) => {
    const workspaceConflicts = await tx.workspace.findMany({
      where: { id: { in: body.workspaceIds }, NOT: { accountId } },
      select: { id: true },
    });
    if (workspaceConflicts.length) {
      throw new Error("Workspace id conflict.");
    }

    const pageConflicts = await tx.page.findMany({
      where: { id: { in: pageIds }, workspace: { accountId: { not: accountId } } },
      select: { id: true },
    });
    if (pageConflicts.length) {
      throw new Error("Page id conflict.");
    }

    for (const page of body.items) {
      await tx.page.upsert({
        where: { id: page.id },
        create: {
          id: page.id,
          workspaceId: page.workspaceId,
          title: page.title,
          icon: page.icon ?? null,
          cover: page.cover ?? null,
          createdAt: parseDate(page.createdAt) ?? bufferedAt,
        },
        update: {
          workspaceId: page.workspaceId,
          title: page.title,
          icon: page.icon ?? null,
          cover: page.cover ?? null,
        },
      });
    }

    if (body.fullSync) {
      await tx.page.deleteMany({
        where: {
          workspaceId: { in: body.workspaceIds },
          ...(pageIds.length ? { id: { notIn: pageIds } } : {}),
        },
      });
    }
  });
}

export async function getBlocksForAccount(accountId: string): Promise<SyncBlockRecord[]> {
  await ensureAccount(accountId);
  const pageIds = await listPageIds(accountId);
  const blocks = await prisma.block.findMany({
    where: { pageId: { in: pageIds } },
    orderBy: [{ pageId: "asc" }, { position: "asc" }],
  });
  return blocks.map(toSyncBlockRecord);
}

export async function syncBlocksForAccount(accountId: string, body: SyncBlocksRequest) {
  await ensureAccount(accountId);
  const bufferedAt = parseDate(body.bufferedAt) ?? new Date();

  const invalidBlocks = body.items.filter((block) => !body.pageIds.includes(block.pageId));
  if (invalidBlocks.length) {
    throw new Error("Invalid block page.");
  }

  const blockIds = body.items.map((block) => block.id);
  const blocksByPage = new Map<string, SyncBlock[]>();
  for (const block of body.items) {
    const list = blocksByPage.get(block.pageId) ?? [];
    list.push(block);
    blocksByPage.set(block.pageId, list);
  }

  await prisma.$transaction(async (tx) => {
    const pageConflicts = await tx.page.findMany({
      where: { id: { in: body.pageIds }, workspace: { accountId: { not: accountId } } },
      select: { id: true },
    });
    if (pageConflicts.length) {
      throw new Error("Page id conflict.");
    }

    const blockConflicts = await tx.block.findMany({
      where: { id: { in: blockIds }, page: { workspace: { accountId: { not: accountId } } } },
      select: { id: true },
    });
    if (blockConflicts.length) {
      throw new Error("Block id conflict.");
    }

    for (const block of body.items) {
      await tx.block.upsert({
        where: { id: block.id },
        create: {
          id: block.id,
          pageId: block.pageId,
          type: block.type,
          content: block.content,
          position: block.position,
          createdAt: parseDate(block.createdAt) ?? bufferedAt,
        },
        update: {
          pageId: block.pageId,
          type: block.type,
          content: block.content,
          position: block.position,
        },
      });
    }

    if (body.fullSync) {
      for (const pageId of body.pageIds) {
        const incomingBlockIds = (blocksByPage.get(pageId) ?? []).map((block) => block.id);
        await tx.block.deleteMany({
          where: {
            pageId,
            ...(incomingBlockIds.length ? { id: { notIn: incomingBlockIds } } : {}),
          },
        });
      }
    }
  });
}

export async function getBridgesForAccount(accountId: string): Promise<SyncBridgeRecord[]> {
  await ensureAccount(accountId);
  const workspaceIds = await listWorkspaceIds(accountId);
  const bridges = await prisma.bridgeResource.findMany({
    where: { workspaceId: { in: workspaceIds } },
    orderBy: { createdAt: "asc" },
  });
  return bridges.map(toSyncBridgeRecord);
}

export async function syncBridgesForAccount(accountId: string, body: SyncBridgesRequest) {
  await ensureAccount(accountId);
  const bufferedAt = parseDate(body.bufferedAt) ?? new Date();

  const invalidBridges = body.items.filter((bridge) => !body.workspaceIds.includes(bridge.workspaceId));
  if (invalidBridges.length) {
    throw new Error("Invalid bridge workspace.");
  }

  const bridgeIds = body.items.map((bridge) => bridge.id);
  await prisma.$transaction(async (tx) => {
    const workspaceConflicts = await tx.workspace.findMany({
      where: { id: { in: body.workspaceIds }, NOT: { accountId } },
      select: { id: true },
    });
    if (workspaceConflicts.length) {
      throw new Error("Workspace id conflict.");
    }

    const bridgeConflicts = await tx.bridgeResource.findMany({
      where: { id: { in: bridgeIds }, workspace: { accountId: { not: accountId } } },
      select: { id: true },
    });
    if (bridgeConflicts.length) {
      throw new Error("Bridge id conflict.");
    }

    for (const bridge of body.items) {
      await tx.bridgeResource.upsert({
        where: { id: bridge.id },
        create: {
          id: bridge.id,
          workspaceId: bridge.workspaceId,
          name: bridge.name,
          bridgeType: bridge.bridgeType,
          endpoint: bridge.endpoint,
          environment: bridge.environment,
          method: bridge.method ?? null,
          apiConfig: toBridgeJsonField(bridge.apiConfig),
          requiredFields: toBridgeJsonField(bridge.requiredFields),
          serviceName: bridge.serviceName ?? null,
          secret: bridge.secret ?? null,
          isPrivateInternal: bridge.isPrivateInternal ?? false,
          privateNote: bridge.privateNote ?? null,
          publicNote: bridge.publicNote ?? null,
          notes: bridge.notes ?? null,
          createdAt: parseDate(bridge.createdAt) ?? bufferedAt,
        },
        update: {
          workspaceId: bridge.workspaceId,
          name: bridge.name,
          bridgeType: bridge.bridgeType,
          endpoint: bridge.endpoint,
          environment: bridge.environment,
          method: bridge.method ?? null,
          apiConfig: toBridgeJsonField(bridge.apiConfig),
          requiredFields: toBridgeJsonField(bridge.requiredFields),
          serviceName: bridge.serviceName ?? null,
          secret: bridge.secret ?? null,
          isPrivateInternal: bridge.isPrivateInternal ?? false,
          privateNote: bridge.privateNote ?? null,
          publicNote: bridge.publicNote ?? null,
          notes: bridge.notes ?? null,
        },
      });
    }

    if (body.fullSync) {
      await tx.bridgeResource.deleteMany({
        where: {
          workspaceId: { in: body.workspaceIds },
          ...(bridgeIds.length ? { id: { notIn: bridgeIds } } : {}),
        },
      });
    }
  });
}

export async function getPinnedPagesForAccount(accountId: string): Promise<SyncPinnedPagesRecord[]> {
  await ensureAccount(accountId);
  const workspaceIds = await listWorkspaceIds(accountId);
  const items = await prisma.pinnedPages.findMany({
    where: { workspaceId: { in: workspaceIds } },
    orderBy: { createdAt: "asc" },
  });

  return items.map(toSyncPinnedPagesRecord);
}

export async function syncPinnedPagesForAccount(accountId: string, body: SyncPinnedPagesRequest) {
  await ensureAccount(accountId);

  const pinnedWorkspaceIds = body.items.map((item) => item.workspaceId);
  const invalidPinnedPages = body.items.filter((item) => {
    if (!body.workspaceIds.includes(item.workspaceId)) return true;
    if (!isStringArray(item.pageIds)) return true;
    return false;
  });
  if (invalidPinnedPages.length) {
    throw new Error("Invalid pinned page configuration.");
  }

  await prisma.$transaction(async (tx) => {
    const workspaceConflicts = await tx.workspace.findMany({
      where: { id: { in: body.workspaceIds }, NOT: { accountId } },
      select: { id: true },
    });
    if (workspaceConflicts.length) {
      throw new Error("Workspace id conflict.");
    }

    const pageWorkspaceRows = await tx.page.findMany({
      where: { workspaceId: { in: body.workspaceIds } },
      select: { id: true, workspaceId: true },
    });
    const pageWorkspaceById = new Map(pageWorkspaceRows.map((page) => [page.id, page.workspaceId]));
    const invalidPageMappings = body.items.filter((item) =>
      item.pageIds.some((pageId) => pageWorkspaceById.get(pageId) !== item.workspaceId),
    );
    if (invalidPageMappings.length) {
      throw new Error("Invalid pinned page configuration.");
    }

    for (const item of body.items) {
      await tx.pinnedPages.upsert({
        where: { workspaceId: item.workspaceId },
        create: {
          id: item.id,
          workspaceId: item.workspaceId,
          pageIds: toPageIdsJsonField(item.pageIds),
          orderBy: item.orderBy,
        },
        update: {
          pageIds: toPageIdsJsonField(item.pageIds),
          orderBy: item.orderBy,
        },
      });
    }

    if (body.fullSync) {
      await tx.pinnedPages.deleteMany({
        where: {
          workspaceId: { in: body.workspaceIds },
          ...(pinnedWorkspaceIds.length ? { NOT: { workspaceId: { in: pinnedWorkspaceIds } } } : {}),
        },
      });
    }
  });
}
