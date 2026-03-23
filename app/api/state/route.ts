import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncWorkspace = {
  id: string;
  permit?: string;
};

type SyncPage = {
  id: string;
  workspaceId: string;
  title: string;
  icon?: string | null;
  cover?: string | null;
  createdAt?: string;
};

type SyncBlock = {
  id: string;
  pageId: string;
  type: string;
  content: string;
  position: number;
  createdAt?: string;
};

type SyncBridge = {
  id: string;
  workspaceId: string;
  name: string;
  bridgeType: string;
  endpoint: string;
  environment: string;
  method?: string | null;
  apiConfig?: unknown;
  requiredFields?: unknown;
  serviceName?: string | null;
  secret?: string | null;
  isPrivateInternal?: boolean;
  privateNote?: string | null;
  publicNote?: string | null;
  notes?: string | null;
  createdAt?: string;
};

type SyncPinnedPages = {
  id: string;
  workspaceId: string;
  pageIds: string[];
  orderBy: string;
};

type SyncPayloadV3 = {
  version: 3;
  fullSync: boolean;
  bufferedAt: string;
  workspaces: SyncWorkspace[];
  pages: SyncPage[];
  blocks: SyncBlock[];
  bridges: SyncBridge[];
  pinnedPages: SyncPinnedPages[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
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

async function requireAccountId() {
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

async function ensureSchema() {
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

function isSyncPayloadV3(value: unknown): value is SyncPayloadV3 {
  if (!isRecord(value)) return false;
  if (value.version !== 3) return false;
  if (typeof value.fullSync !== "boolean") return false;
  if (typeof value.bufferedAt !== "string") return false;
  if (!Array.isArray(value.workspaces)) return false;
  if (!Array.isArray(value.pages)) return false;
  if (!Array.isArray(value.blocks)) return false;
  if (!Array.isArray(value.bridges)) return false;
  if (!Array.isArray(value.pinnedPages)) return false;
  return true;
}

export async function GET() {
  const accountId = await requireAccountId();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    await ensureSchema();
    await prisma.account.upsert({ where: { id: accountId }, create: { id: accountId }, update: {} });

    const workspaces = await prisma.workspace.findMany({
      where: { accountId },
      orderBy: { id: "asc" },
    });

    const workspaceIds = workspaces.map((workspace) => workspace.id);
    const pages = await prisma.page.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "asc" },
    });

    const pageIds = pages.map((page) => page.id);
    const blocks = await prisma.block.findMany({
      where: { pageId: { in: pageIds } },
      orderBy: [{ pageId: "asc" }, { position: "asc" }],
    });

    const bridges = await prisma.bridgeResource.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "asc" },
    });

    const pinnedPages = await prisma.pinnedPages.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      accountId,
      workspaces,
      pages,
      blocks,
      bridges,
      pinnedPages: pinnedPages.map((item) => ({
        ...item,
        pageIds: Array.isArray(item.pageIds) ? item.pageIds : [],
      })),
    });
  } catch (error) {
    console.error("[api/state] GET failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load state.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const accountId = await requireAccountId();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    await ensureSchema();
    await prisma.account.upsert({ where: { id: accountId }, create: { id: accountId }, update: {} });

    const body = (await request.json()) as unknown;
    if (!isSyncPayloadV3(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    const bufferedAt = parseDate(body.bufferedAt) ?? new Date();
    const workspaceIds = body.workspaces.map((workspace) => workspace.id);
    const pageIds = body.pages.map((page) => page.id);
    const pinnedWorkspaceIds = body.pinnedPages.map((item) => item.workspaceId);
    const blocksByPage = new Map<string, SyncBlock[]>();
    const pageWorkspaceById = new Map(body.pages.map((page) => [page.id, page.workspaceId]));

    for (const block of body.blocks) {
      const list = blocksByPage.get(block.pageId) ?? [];
      list.push(block);
      blocksByPage.set(block.pageId, list);
    }

    const invalidPages = body.pages.filter((page) => !workspaceIds.includes(page.workspaceId));
    if (invalidPages.length) {
      return NextResponse.json({ ok: false, error: "Invalid page workspace." }, { status: 400 });
    }

    const invalidBlocks = body.blocks.filter((block) => !pageIds.includes(block.pageId));
    if (invalidBlocks.length) {
      return NextResponse.json({ ok: false, error: "Invalid block page." }, { status: 400 });
    }

    const invalidBridges = body.bridges.filter((bridge) => !workspaceIds.includes(bridge.workspaceId));
    if (invalidBridges.length) {
      return NextResponse.json({ ok: false, error: "Invalid bridge workspace." }, { status: 400 });
    }

    const invalidPinnedPages = body.pinnedPages.filter((item) => {
      if (!workspaceIds.includes(item.workspaceId)) return true;
      if (!isStringArray(item.pageIds)) return true;
      return item.pageIds.some((pageId) => pageWorkspaceById.get(pageId) !== item.workspaceId);
    });
    if (invalidPinnedPages.length) {
      return NextResponse.json({ ok: false, error: "Invalid pinned page configuration." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const workspaceConflicts = await tx.workspace.findMany({
        where: { id: { in: workspaceIds }, NOT: { accountId } },
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

      const bridgeConflicts = await tx.bridgeResource.findMany({
        where: { id: { in: body.bridges.map((bridge) => bridge.id) }, workspace: { accountId: { not: accountId } } },
        select: { id: true },
      });
      if (bridgeConflicts.length) {
        throw new Error("Bridge id conflict.");
      }

      const pinnedConflicts = await tx.pinnedPages.findMany({
        where: {
          workspaceId: { in: pinnedWorkspaceIds },
          workspace: { accountId: { not: accountId } },
        },
        select: { id: true },
      });
      if (pinnedConflicts.length) {
        throw new Error("Pinned page configuration conflict.");
      }

      for (const workspace of body.workspaces) {
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

      for (const page of body.pages) {
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

      for (const bridge of body.bridges) {
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

      for (const block of body.blocks) {
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

      for (const item of body.pinnedPages) {
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
        for (const pageId of pageIds) {
          const incomingBlockIds = (blocksByPage.get(pageId) ?? []).map((block) => block.id);
          await tx.block.deleteMany({
            where: {
              pageId,
              ...(incomingBlockIds.length ? { id: { notIn: incomingBlockIds } } : {}),
            },
          });
        }

        await tx.page.deleteMany({
          where: {
            workspaceId: { in: workspaceIds },
            ...(pageIds.length ? { id: { notIn: pageIds } } : {}),
          },
        });

        await tx.bridgeResource.deleteMany({
          where: {
            workspaceId: { in: workspaceIds },
            ...(body.bridges.length ? { id: { notIn: body.bridges.map((bridge) => bridge.id) } } : {}),
          },
        });

        await tx.pinnedPages.deleteMany({
          where: {
            workspaceId: { in: workspaceIds },
            ...(pinnedWorkspaceIds.length ? { NOT: { workspaceId: { in: pinnedWorkspaceIds } } } : {}),
          },
        });

        await tx.workspace.deleteMany({
          where: {
            accountId,
            ...(workspaceIds.length ? { id: { notIn: workspaceIds } } : {}),
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/state] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to save state.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}
