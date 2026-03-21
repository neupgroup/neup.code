"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BRIDGE_STORAGE_KEY,
  loadBridges,
  type BridgeItem,
} from "./bridge-storage";

function bridgeTypeLabel(type: BridgeItem["bridgeType"]) {
  if (type === "grpc") return "gRPC";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function BridgeList() {
  const [bridges, setBridges] = useState<BridgeItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBridges(loadBridges());
    setReady(true);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== BRIDGE_STORAGE_KEY) return;
      setBridges(loadBridges());
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Bridge
          </p>
          <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">Bridge</h1>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            Configure your bridge connections.
          </p>
        </div>

        <Link
          href="/bridge/new"
          className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90"
        >
          Add a bridge
        </Link>
      </div>

      <div className="pt-1">
        {!ready ? (
          <p className="text-[0.88rem] text-muted-foreground">Loading bridges...</p>
        ) : bridges.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[0.88rem] text-muted-foreground">
            No bridge saved yet. Click <span className="font-semibold">Add a bridge</span> to
            create your first one.
          </p>
        ) : (
          <div className="grid gap-3">
            {bridges.map((bridge) => (
              <div
                key={bridge.id}
                className="rounded-xl border border-border bg-background px-4 py-3 transition hover:border-foreground/15 hover:bg-muted/25"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/bridge/${bridge.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[1rem] font-semibold">{bridge.name}</h2>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {bridgeTypeLabel(bridge.bridgeType)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[0.84rem] text-muted-foreground">
                      {bridge.endpoint}
                    </p>
                  </Link>

                  <Link
                    href={`/bridge/${bridge.id}/edit`}
                    className="inline-flex rounded-full border border-border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
                  >
                    Edit bridge
                  </Link>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[0.75rem] text-muted-foreground">
                  <span className="rounded-full border border-border px-2 py-0.5">
                    {bridge.environment}
                  </span>
                  {bridge.method ? (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {bridge.method}
                    </span>
                  ) : null}
                  {bridge.serviceName ? (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      service: {bridge.serviceName}
                    </span>
                  ) : null}
                  {bridge.secret ? (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      secret set
                    </span>
                  ) : null}
                  {bridge.apiConfig ? (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      headers: {bridge.apiConfig.headers.length}
                    </span>
                  ) : null}
                  {bridge.apiConfig ? (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      form-data: {bridge.apiConfig.formData.length}
                    </span>
                  ) : null}
                  {bridge.apiConfig ? (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      body: {bridge.apiConfig.bodyType}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
