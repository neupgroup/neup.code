import { NextResponse } from "next/server";
import {
  ensureSyncSchema,
  getPinnedPagesForAccount,
  isSyncPinnedPagesRequest,
  requireSyncAccountId,
  syncPinnedPagesForAccount,
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
    const pinnedPages = await getPinnedPagesForAccount(accountId);
    return NextResponse.json({ ok: true, accountId, pinnedPages });
  } catch (error) {
    console.error("[api/pinned-pages] GET failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load pinned pages.",
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
    if (!isSyncPinnedPagesRequest(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    await syncPinnedPagesForAccount(accountId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/pinned-pages] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save pinned pages.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}
