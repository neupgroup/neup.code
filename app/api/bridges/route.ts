import { NextResponse } from "next/server";
import {
  ensureSyncSchema,
  getBridgesForAccount,
  isSyncBridgesRequest,
  requireSyncAccountId,
  syncBridgesForAccount,
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
    const bridges = await getBridgesForAccount(accountId);
    return NextResponse.json({ ok: true, accountId, bridges });
  } catch (error) {
    console.error("[api/bridges] GET failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load bridges.",
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
    if (!isSyncBridgesRequest(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    await syncBridgesForAccount(accountId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/bridges] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save bridges.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}
