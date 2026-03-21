"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BRIDGE_RUN_STORAGE_KEY,
  BRIDGE_STORAGE_KEY,
  deleteBridge,
  deleteBridgeRun,
  loadBridgeRuns,
  loadBridges,
  saveBridgeRuns,
  type BridgeKeyValueItem,
  type BridgeItem,
  type BridgeRunRecord,
} from "../bridge-storage";

function bridgeTypeLabel(type: BridgeItem["bridgeType"]) {
  if (type === "grpc") return "gRPC";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildRunOutput(bridge: BridgeItem) {
  const lines = [
    `Bridge "${bridge.name}" executed.`,
    `Type: ${bridgeTypeLabel(bridge.bridgeType)}`,
    `Endpoint: ${bridge.endpoint}`,
    `Environment: ${bridge.environment}`,
  ];

  if (bridge.method) {
    lines.push(`Method: ${bridge.method}`);
  }

  if (bridge.serviceName) {
    lines.push(`Service: ${bridge.serviceName}`);
  }

  if (bridge.apiConfig) {
    lines.push(`Headers: ${bridge.apiConfig.headers.length}`);
    lines.push(`Query params: ${bridge.apiConfig.queryParams.length}`);
    lines.push(`Form data fields: ${bridge.apiConfig.formData.length}`);
    lines.push(`Body type: ${bridge.apiConfig.bodyType}`);
  }

  return lines.join("\n");
}

function keyValueItemsToUrl(url: string, items: BridgeKeyValueItem[]) {
  const nextUrl = new URL(url);

  for (const item of items) {
    if (!item.key.trim()) continue;
    nextUrl.searchParams.append(item.key.trim(), item.value);
  }

  return nextUrl.toString();
}

function cleanHeaderItems(items: BridgeKeyValueItem[]) {
  return items.filter((item) => item.key.trim().length > 0);
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

type BridgeDetailProps = {
  id: string;
};

export function BridgeDetail({ id }: BridgeDetailProps) {
  const router = useRouter();
  const [bridge, setBridge] = useState<BridgeItem | null>(null);
  const [ready, setReady] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runRecord, setRunRecord] = useState<BridgeRunRecord>({
    bridgeId: id,
    status: "idle",
  });

  useEffect(() => {
    const allBridges = loadBridges();
    const foundBridge = allBridges.find((item) => item.id === id) ?? null;
    setBridge(foundBridge);

    const runMap = loadBridgeRuns();
    setRunRecord(runMap[id] ?? { bridgeId: id, status: "idle" });
    setReady(true);
  }, [id]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === BRIDGE_STORAGE_KEY) {
        const allBridges = loadBridges();
        setBridge(allBridges.find((item) => item.id === id) ?? null);
      }

      if (event.key === BRIDGE_RUN_STORAGE_KEY) {
        const runMap = loadBridgeRuns();
        setRunRecord(runMap[id] ?? { bridgeId: id, status: "idle" });
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [id]);

  async function runBridge() {
    if (!bridge) return;

    const runningRecord: BridgeRunRecord = {
      bridgeId: bridge.id,
      status: "running",
      lastRunAt: new Date().toISOString(),
      output: "Running bridge...",
    };

    setRunRecord(runningRecord);
    const runningMap = loadBridgeRuns();
    saveBridgeRuns({ ...runningMap, [bridge.id]: runningRecord });

    try {
      const startedAt = performance.now();
      let requestUrl = bridge.endpoint;
      let response: Response;

      if (bridge.bridgeType === "grpc") {
        throw new Error("gRPC bridge execution is not supported directly in the browser.");
      }

      if (bridge.bridgeType === "api") {
        requestUrl = bridge.apiConfig
          ? keyValueItemsToUrl(bridge.endpoint, bridge.apiConfig.queryParams)
          : bridge.endpoint;

        const headers = new Headers();
        if (bridge.apiConfig) {
          for (const item of cleanHeaderItems(bridge.apiConfig.headers)) {
            headers.append(item.key.trim(), item.value);
          }
        }

        let body: BodyInit | undefined;
        if (bridge.apiConfig?.formData.length) {
          const formData = new FormData();
          for (const item of bridge.apiConfig.formData) {
            if (!item.key.trim()) continue;
            formData.append(item.key.trim(), item.value);
          }
          body = formData;
        } else if (bridge.apiConfig?.bodyType === "json" && bridge.apiConfig.body) {
          if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
          }
          body = bridge.apiConfig.body;
        } else if (bridge.apiConfig?.bodyType === "raw" && bridge.apiConfig.body) {
          body = bridge.apiConfig.body;
        }

        response = await fetch(requestUrl, {
          method: bridge.method ?? "GET",
          headers,
          body,
        });
      } else if (bridge.bridgeType === "webhook") {
        const headers = new Headers();
        headers.set("content-type", "application/json");
        if (bridge.secret) {
          headers.set("x-webhook-secret", bridge.secret);
        }

        response = await fetch(bridge.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            bridgeId: bridge.id,
            name: bridge.name,
            timestamp: new Date().toISOString(),
          }),
        });
      } else {
        const headers = new Headers();
        if (bridge.secret) {
          headers.set("x-handshake-key", bridge.secret);
        }

        response = await fetch(bridge.endpoint, {
          method: "POST",
          headers,
        });
      }

      const bodyText = await readResponseBody(response);
      const durationMs = Math.round(performance.now() - startedAt);
      const responseHeaders = Array.from(response.headers.entries()).map(([key, value]) => ({
        id: `${key}-${value}`,
        key,
        value,
      }));

      const nextRecord: BridgeRunRecord = {
        bridgeId: bridge.id,
        status: response.ok ? "success" : "error",
        lastRunAt: new Date().toISOString(),
        output: buildRunOutput(bridge),
        response: {
          requestUrl,
          statusCode: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: bodyText || "No response body",
          durationMs,
        },
      };

      setRunRecord(nextRecord);
      const nextMap = loadBridgeRuns();
      saveBridgeRuns({ ...nextMap, [bridge.id]: nextRecord });
    } catch (error) {
      const nextRecord: BridgeRunRecord = {
        bridgeId: bridge.id,
        status: "error",
        lastRunAt: new Date().toISOString(),
        output: buildRunOutput(bridge),
        response: {
          requestUrl: bridge.endpoint,
          body: error instanceof Error ? error.message : "Unknown bridge run error",
        },
      };

      setRunRecord(nextRecord);
      const nextMap = loadBridgeRuns();
      saveBridgeRuns({ ...nextMap, [bridge.id]: nextRecord });
    }
  }

  function removeBridge() {
    if (!bridge || isDeleting) return;

    const confirmed = window.confirm(
      `Delete bridge "${bridge.name}"? This will remove its saved config and run history from this browser.`,
    );

    if (!confirmed) return;

    setIsDeleting(true);
    deleteBridge(bridge.id);
    deleteBridgeRun(bridge.id);
    router.push("/bridge");
    router.refresh();
  }

  if (!ready) {
    return (
      <section className="rounded-[1.1rem] border border-border bg-card p-6">
        <p className="text-[0.9rem] text-muted-foreground">Loading bridge...</p>
      </section>
    );
  }

  if (!bridge) {
    return (
      <section className="rounded-[1.1rem] border border-border bg-card p-6">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Bridge
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">
          Bridge not found
        </h1>
        <p className="mt-2 text-[0.9rem] text-muted-foreground">
          This bridge does not exist in browser storage.
        </p>
        <Link
          href="/bridge"
          className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
        >
          Back to bridge
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_20rem]">
      <section className="rounded-[1.1rem] border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Bridge
            </p>
            <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">
              {bridge.name}
            </h1>
            <p className="mt-1 text-[0.88rem] text-muted-foreground">{bridge.endpoint}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/bridge"
              className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
            >
              Back
            </Link>
            <Link
              href={`/bridge/${bridge.id}/edit`}
              className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
            >
              Edit bridge
            </Link>
            <button
              type="button"
              onClick={removeBridge}
              disabled={isDeleting}
              className="inline-flex rounded-full border border-rose-200 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete bridge"}
            </button>
            <button
              type="button"
              onClick={runBridge}
              disabled={runRecord.status === "running"}
              className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {runRecord.status === "running" ? "Running..." : "Run bridge"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-[0.75rem] text-muted-foreground">
          <span className="rounded-full border border-border px-2 py-0.5">
            {bridgeTypeLabel(bridge.bridgeType)}
          </span>
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
              {bridge.serviceName}
            </span>
          ) : null}
        </div>

        {bridge.apiConfig ? (
          <div className="mt-5 grid gap-3 rounded-lg border border-border bg-muted/20 p-4">
            <h2 className="text-[1rem] font-semibold">API configuration</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Headers
                </p>
                <p className="mt-1 text-[0.92rem] font-semibold">
                  {bridge.apiConfig.headers.length}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Query Params
                </p>
                <p className="mt-1 text-[0.92rem] font-semibold">
                  {bridge.apiConfig.queryParams.length}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Form Data
                </p>
                <p className="mt-1 text-[0.92rem] font-semibold">
                  {bridge.apiConfig.formData.length}
                </p>
              </div>
            </div>

            {bridge.apiConfig.bodyType !== "none" ? (
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Body
                </p>
                <p className="mt-1 text-[0.8rem] text-muted-foreground">
                  Type: {bridge.apiConfig.bodyType}
                </p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-3 text-[0.78rem] text-foreground">
                  {bridge.apiConfig.body || "No body content"}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {bridge.notes ? (
          <div className="mt-5 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Notes
            </p>
            <p className="mt-2 text-[0.88rem] text-foreground">{bridge.notes}</p>
          </div>
        ) : null}
      </section>

      <aside className="rounded-[1.1rem] border border-border bg-card p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Run status
        </p>
        <p className="mt-3 text-[1rem] font-semibold capitalize">{runRecord.status}</p>
        <p className="mt-1 text-[0.82rem] text-muted-foreground">
          {runRecord.lastRunAt
            ? `Last run: ${new Date(runRecord.lastRunAt).toLocaleString()}`
            : "Bridge has not been run yet."}
        </p>

        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Output
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-[0.8rem] text-foreground">
            {runRecord.output || "No run output yet."}
          </pre>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Response
          </p>
          <div className="mt-2 grid gap-2 text-[0.8rem] text-foreground">
            <p>
              <span className="font-semibold">Request URL:</span>{" "}
              {runRecord.response?.requestUrl || "No response yet."}
            </p>
            <p>
              <span className="font-semibold">Status:</span>{" "}
              {runRecord.response?.statusCode
                ? `${runRecord.response.statusCode} ${runRecord.response.statusText ?? ""}`.trim()
                : "No response yet."}
            </p>
            <p>
              <span className="font-semibold">Duration:</span>{" "}
              {typeof runRecord.response?.durationMs === "number"
                ? `${runRecord.response.durationMs}ms`
                : "N/A"}
            </p>
          </div>

          {runRecord.response?.headers?.length ? (
            <div className="mt-3">
              <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Response headers
              </p>
              <div className="mt-2 grid gap-1">
                {runRecord.response.headers.map((header) => (
                  <p key={header.id} className="text-[0.78rem] text-foreground">
                    <span className="font-semibold">{header.key}:</span> {header.value}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Response body
            </p>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-background p-3 text-[0.78rem] text-foreground">
              {runRecord.response?.body || "No response body yet."}
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
}
