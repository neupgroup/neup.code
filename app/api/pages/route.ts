import { NextResponse } from "next/server";
import {
  ensureSyncSchema,
  getPagesForAccount,
  isSyncPagesRequest,
  requireSyncAccountId,
  syncPagesForAccount,
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
    const pages = await getPagesForAccount(accountId);
    return NextResponse.json({ ok: true, accountId, pages });
  } catch (error) {
    console.error("[api/pages] GET failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load pages.",
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
    if (!isSyncPagesRequest(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    await syncPagesForAccount(accountId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/pages] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save pages.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}
