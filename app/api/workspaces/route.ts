import { NextResponse } from "next/server";
import {
  ensureSyncSchema,
  getWorkspacesForAccount,
  isSyncWorkspacesRequest,
  requireSyncAccountId,
  syncWorkspacesForAccount,
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
    const workspaces = await getWorkspacesForAccount(accountId);
    return NextResponse.json({ ok: true, accountId, workspaces });
  } catch (error) {
    console.error("[api/workspaces] GET failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load workspaces.",
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
    if (!isSyncWorkspacesRequest(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    await syncWorkspacesForAccount(accountId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/workspaces] POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save workspaces.",
        ...(process.env.NODE_ENV !== "production" ? { details: String(error) } : null),
      },
      { status: 503 },
    );
  }
}
