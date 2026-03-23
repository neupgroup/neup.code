import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncWorkspace = {
  id: string;
  name: string;
  permit?: string;
  description?: string;
  sharedWith?: string[];
  isHidden?: boolean;
  isDefault?: boolean;
  createdAt?: string;
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
  kind: string;
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

type SyncPayloadV2 = {
  version: 2;
  fullSync: boolean;
  bufferedAt: string;
  workspaces: SyncWorkspace[];
  pages: SyncPage[];
  blocks: SyncBlock[];
  bridges: SyncBridge[];
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

async function requireAccountId() {
  const cookieStore = await cookies();
  const accountId = cookieStore.get("auth_account_id")?.value?.trim();
  return accountId || null;
}

let ensuredSchema = false;

async function ensureSchema() {
  if (ensuredSchema) return;

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "public";`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "accounts" (
      "id" TEXT NOT NULL,
      CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "workspace" (
      "id" TEXT NOT NULL,
      "account_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "permit" TEXT NOT NULL DEFAULT 'owner',
      "description" TEXT NOT NULL DEFAULT '',
      "shared_with" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "is_hidden" BOOLEAN NOT NULL DEFAULT false,
      "is_default" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "pages" (
      "id" TEXT NOT NULL,
      "workspace_id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "icon" VARCHAR(256),
      "cover" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "page_blocks" (
      "id" TEXT NOT NULL,
      "page_id" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "content" TEXT NOT NULL DEFAULT '',
      "position" INTEGER NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "page_blocks_pkey" PRIMARY KEY ("id")
    );
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
    CREATE TABLE IF NOT EXISTS "history" (
      "id" TEXT NOT NULL,
      "page_id" TEXT NOT NULL,
      "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "changes" JSONB NOT NULL,
      "by" TEXT NOT NULL,
      CONSTRAINT "history_pkey" PRIMARY KEY ("id")
    );
  `);

  ensuredSchema = true;
}

function isSyncPayloadV2(value: unknown): value is SyncPayloadV2 {
  if (!isRecord(value)) return false;
  if (value.version !== 2) return false;
  if (typeof value.fullSync !== "boolean") return false;
  if (typeof value.bufferedAt !== "string") return false;
  if (!Array.isArray(value.workspaces)) return false;
  if (!Array.isArray(value.pages)) return false;
  if (!Array.isArray(value.blocks)) return false;
  if (!Array.isArray(value.bridges)) return false;
  return true;
}

function diffBlocks(
  previous: Array<Pick<SyncBlock, "id" | "kind" | "content" | "position">>,
  next: SyncBlock[],
) {
  const prevById = new Map(previous.map((block) => [block.id, block]));
  const nextById = new Map(next.map((block) => [block.id, block]));

  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];

  for (const block of next) {
    const existing = prevById.get(block.id);
    if (!existing) {
      added.push(block.id);
      continue;
    }
    if (
      existing.kind !== block.kind ||
      existing.content !== block.content ||
      existing.position !== block.position
    ) {
      updated.push(block.id);
    }
  }

  for (const block of previous) {
    if (!nextById.has(block.id)) {
      removed.push(block.id);
    }
  }

  return { added, removed, updated };
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
      orderBy: { createdAt: "asc" },
    });

    const workspaceIds = workspaces.map((ws) => ws.id);
    const pages = await prisma.page.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "asc" },
    });

    const pageIds = pages.map((page) => page.id);
    const blocks = await prisma.pageBlock.findMany({
      where: { pageId: { in: pageIds } },
      orderBy: [{ pageId: "asc" }, { position: "asc" }],
    });

    const bridges = await prisma.bridgeResource.findMany({
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
    if (!isSyncPayloadV2(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    const bufferedAt = parseDate(body.bufferedAt) ?? new Date();

    const workspaceIds = body.workspaces.map((ws) => ws.id);
    const pageIds = body.pages.map((page) => page.id);
    const blocksByPage = new Map<string, SyncBlock[]>();
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
        where: { id: { in: body.bridges.map((b) => b.id) }, workspace: { accountId: { not: accountId } } },
        select: { id: true },
      });
      if (bridgeConflicts.length) {
        throw new Error("Bridge id conflict.");
      }

      const previousBlocks = await tx.pageBlock.findMany({
        where: { pageId: { in: pageIds } },
        select: { id: true, pageId: true, kind: true, content: true, position: true },
      });

      const previousByPage = new Map<string, Array<Pick<SyncBlock, "id" | "kind" | "content" | "position">>>();
      for (const block of previousBlocks) {
        const list = previousByPage.get(block.pageId) ?? [];
        list.push({ id: block.id, kind: block.kind, content: block.content, position: block.position });
        previousByPage.set(block.pageId, list);
      }

      for (const ws of body.workspaces) {
        await tx.workspace.upsert({
          where: { id: ws.id },
          create: {
            id: ws.id,
            accountId,
            name: ws.name,
            permit: ws.permit ?? "owner",
            description: ws.description ?? "",
            sharedWith: ws.sharedWith ?? [],
            isHidden: ws.isHidden ?? false,
            isDefault: ws.isDefault ?? false,
            createdAt: parseDate(ws.createdAt) ?? bufferedAt,
          },
          update: {
            accountId,
            name: ws.name,
            permit: ws.permit ?? "owner",
            description: ws.description ?? "",
            sharedWith: ws.sharedWith ?? [],
            isHidden: ws.isHidden ?? false,
            isDefault: ws.isDefault ?? false,
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
            apiConfig: isRecord(bridge.apiConfig) || Array.isArray(bridge.apiConfig) ? bridge.apiConfig : null,
            requiredFields: isRecord(bridge.requiredFields) || Array.isArray(bridge.requiredFields) ? bridge.requiredFields : null,
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
            apiConfig: isRecord(bridge.apiConfig) || Array.isArray(bridge.apiConfig) ? bridge.apiConfig : null,
            requiredFields: isRecord(bridge.requiredFields) || Array.isArray(bridge.requiredFields) ? bridge.requiredFields : null,
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
        await tx.pageBlock.upsert({
          where: { id: block.id },
          create: {
            id: block.id,
            pageId: block.pageId,
            kind: block.kind,
            content: block.content,
            position: block.position,
            createdAt: parseDate(block.createdAt) ?? bufferedAt,
          },
          update: {
            pageId: block.pageId,
            kind: block.kind,
            content: block.content,
            position: block.position,
          },
        });
      }

      if (body.fullSync) {
        for (const pageId of pageIds) {
          const incomingBlockIds = (blocksByPage.get(pageId) ?? []).map((block) => block.id);
          await tx.pageBlock.deleteMany({
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
            ...(body.bridges.length ? { id: { notIn: body.bridges.map((b) => b.id) } } : {}),
          },
        });

        await tx.workspace.deleteMany({
          where: {
            accountId,
            ...(workspaceIds.length ? { id: { notIn: workspaceIds } } : {}),
          },
        });
      }

      const historyRows: Array<{
        id: string;
        pageId: string;
        timestamp: Date;
        changes: unknown;
        by: string;
      }> = [];

      for (const page of body.pages) {
        const previous = previousByPage.get(page.id) ?? [];
        const next = (blocksByPage.get(page.id) ?? []).slice().sort((a, b) => a.position - b.position);
        const diff = diffBlocks(previous, next);
        if (!diff.added.length && !diff.removed.length && !diff.updated.length) continue;

        historyRows.push({
          id: randomUUID(),
          pageId: page.id,
          timestamp: bufferedAt,
          changes: {
            type: "sync",
            bufferedAt: body.bufferedAt,
            blocks: diff,
          },
          by: accountId,
        });
      }

      if (historyRows.length) {
        await tx.history.createMany({ data: historyRows as any });
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
