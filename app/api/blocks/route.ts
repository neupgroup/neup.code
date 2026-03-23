import { NextResponse } from "next/server";
import {
  ensureSyncSchema,
  getBlocksForAccount,
  isSyncBlocksRequest,
  requireSyncAccountId,
  syncBlocksForAccount,
} from "@/services/server/sync-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const accountId = await requireSyncAccountId();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    await ensureSyncSchema();
    const blocks = await getBlocksForAccount(accountId);
    return NextResponse.json({ ok: true, accountId, blocks });
  } catch (error) {
    console.error("[api/blocks] GET failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load blocks.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const accountId = await requireSyncAccountId();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    await ensureSyncSchema();
    const body = (await request.json()) as unknown;
    if (!isSyncBlocksRequest(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    await syncBlocksForAccount(accountId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/blocks] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save blocks.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}
