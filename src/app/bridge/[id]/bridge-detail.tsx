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
  saveBridges,
  saveBridgeRuns,
  type BridgeKeyValueItem,
  type BridgeItem,
  type BridgeRunRecord,
} from "../bridge-storage";
import { normalizeRichTextHtml, richTextHasContent } from "../rich-text";
import {
  BRIDGE_SESSION_STORAGE_KEY,
  clearBridgeClipboard,
  loadBridgeSessionState,
  type BridgeSessionClipboard,
} from "../session-manager";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bridgeTypeLabel(type: BridgeItem["bridgeType"]) {
  if (type === "grpc") return "gRPC";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function bridgeEntryKindLabel(kind: BridgeItem["entryKind"]) {
  if (kind === "chapter") return "Chapter";
  if (kind === "note") return "Note";
  return "Bridge";
}

function duplicateKeyValueItems(items?: BridgeKeyValueItem[]) {
  return items?.map((item) => ({
    id: createId(),
    key: item.key,
    value: item.value,
  }));
}

function duplicateBridgeItem(bridge: BridgeItem): BridgeItem {
  return {
    ...bridge,
    id: createId(),
    name: `${bridge.name} Copy`,
    createdAt: new Date().toISOString(),
    chapterBlockIds: [],
    apiConfig: bridge.apiConfig
      ? {
          ...bridge.apiConfig,
          headers: duplicateKeyValueItems(bridge.apiConfig.headers) ?? [],
          queryParams: duplicateKeyValueItems(bridge.apiConfig.queryParams) ?? [],
          formData: duplicateKeyValueItems(bridge.apiConfig.formData) ?? [],
        }
      : undefined,
    requiredFields: duplicateKeyValueItems(bridge.requiredFields),
  };
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

  if (bridge.requiredFields?.length) {
    lines.push(`Required fields: ${bridge.requiredFields.length}`);
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

function cleanKeyValueItems(items: BridgeKeyValueItem[]) {
  return items.filter((item) => item.key.trim().length > 0 || item.value.trim().length > 0);
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [clipboard, setClipboard] = useState<BridgeSessionClipboard | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [runRecord, setRunRecord] = useState<BridgeRunRecord>({
    bridgeId: id,
    status: "idle",
  });
  const hasRunActivity = runRecord.status !== "idle";
  const isBridgeEntry = (bridge?.entryKind ?? "bridge") === "bridge";
  const apiHeaders = bridge?.apiConfig ? cleanKeyValueItems(bridge.apiConfig.headers) : [];
  const apiQueryParams = bridge?.apiConfig ? cleanKeyValueItems(bridge.apiConfig.queryParams) : [];
  const apiFormData = bridge?.apiConfig ? cleanKeyValueItems(bridge.apiConfig.formData) : [];
  const requiredFields = bridge?.requiredFields ? cleanKeyValueItems(bridge.requiredFields) : [];
  const hasRequestBody =
    bridge?.apiConfig?.bodyType !== "none" && Boolean(bridge?.apiConfig?.body);
  const normalizedPrivateNote = normalizeRichTextHtml(bridge?.privateNote ?? "");
  const normalizedPublicNote = normalizeRichTextHtml(bridge?.publicNote ?? bridge?.notes ?? "");

  useEffect(() => {
    const allBridges = loadBridges();
    const foundBridge = allBridges.find((item) => item.id === id) ?? null;
    setBridge(foundBridge);
    setClipboard(loadBridgeSessionState().clipboard ?? null);

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

      if (event.key === BRIDGE_SESSION_STORAGE_KEY) {
        setClipboard(loadBridgeSessionState().clipboard ?? null);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [id]);

  useEffect(() => {
    function closeMenus() {
      setContextMenu(null);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenus();
      }
    }

    window.addEventListener("click", closeMenus);
    window.addEventListener("scroll", closeMenus, true);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("click", closeMenus);
      window.removeEventListener("scroll", closeMenus, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

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

    setIsDeleting(true);
    deleteBridge(bridge.id);
    deleteBridgeRun(bridge.id);
    setIsDeleteDialogOpen(false);
    router.push("/bridge");
    router.refresh();
  }

  function duplicateBridge() {
    if (!bridge || isDuplicating) return;

    setIsDuplicating(true);
    const allBridges = loadBridges();
    const duplicatedBridge = duplicateBridgeItem(bridge);
    saveBridges([duplicatedBridge, ...allBridges]);
    router.push(`/bridge/${duplicatedBridge.id}/edit`);
    router.refresh();
  }

  function pasteIntoChapter() {
    if (!bridge || bridge.entryKind !== "chapter" || !clipboard?.items.length) return;

    const clipboardIds = clipboard.items
      .map((item) => item.id)
      .filter((clipboardId) => clipboardId !== bridge.id);

    const allBridges = loadBridges();
    const nextBridges = allBridges.map((item) =>
      clipboardIds.includes(item.id)
        ? {
            ...item,
            parentChapterId: bridge.id,
          }
        : item,
    );

    saveBridges(nextBridges);
    setBridge(nextBridges.find((item) => item.id === bridge.id) ?? bridge);
    clearBridgeClipboard();
    setClipboard(null);
    setContextMenu(null);
    setPasteMessage(
      clipboard.items.length === 1
        ? `${clipboard.items[0]?.name ?? "Item"} pasted into ${bridge.name}.`
        : `${clipboard.items.length} items pasted into ${bridge.name}.`,
    );
    window.setTimeout(() => setPasteMessage(null), 2200);
  }

  if (!ready) {
    return (
      <section>
        <p className="text-[0.9rem] text-muted-foreground">Loading bridge...</p>
      </section>
    );
  }

  if (!bridge) {
    return (
      <section>
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

  const chapterBlocks =
    bridge.entryKind === "chapter"
      ? loadBridges().filter((item) => item.parentChapterId === bridge.id)
      : [];

  return (
    <section className="space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/bridge"
              className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
            >
              <span aria-hidden="true">&lt;</span>
              <span>Bridge</span>
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">
                {bridge.name}
              </h1>
              {isBridgeEntry ? (
                <button
                  type="button"
                  onClick={runBridge}
                  disabled={runRecord.status === "running"}
                  aria-label="Run bridge"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                  >
                    <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                  </svg>
                </button>
              ) : null}
            </div>
            {isBridgeEntry ? (
              <p className="mt-1 text-[0.88rem] text-muted-foreground">{bridge.endpoint}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[0.75rem] text-muted-foreground">
          <span className="rounded-full border border-border px-2 py-0.5">
            {bridgeEntryKindLabel(bridge.entryKind)}
          </span>
          {isBridgeEntry ? (
            <span className="rounded-full border border-border px-2 py-0.5">
              {bridgeTypeLabel(bridge.bridgeType)}
            </span>
          ) : null}
          {isBridgeEntry ? (
            <span className="rounded-full border border-border px-2 py-0.5">
              {bridge.environment}
            </span>
          ) : null}
          {isBridgeEntry && bridge.method ? (
            <span className="rounded-full border border-border px-2 py-0.5">
              {bridge.method}
            </span>
          ) : null}
          {isBridgeEntry && bridge.serviceName ? (
            <span className="rounded-full border border-border px-2 py-0.5">
              {bridge.serviceName}
            </span>
          ) : null}
        </div>

        {!isBridgeEntry && richTextHasContent(normalizedPublicNote) ? (
          <div
            className="pt-2"
            onContextMenu={(event) => {
              if (bridge.entryKind !== "chapter") return;
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY });
            }}
          >
            <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">Content</h2>
            <div
              className="mt-2 prose prose-sm max-w-none text-[0.88rem] text-foreground"
              dangerouslySetInnerHTML={{ __html: normalizedPublicNote }}
            />
          </div>
        ) : null}

        {bridge.entryKind === "chapter" ? (
          <div
            className="grid gap-3 pt-4"
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY });
            }}
          >
            {pasteMessage ? (
              <p className="text-[0.84rem] text-muted-foreground">{pasteMessage}</p>
            ) : null}

            <Link
              href={`/bridge/add?chapter=${bridge.id}`}
              className="block rounded-xl border border-border bg-background p-4 transition hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.84rem] font-semibold text-foreground">Add a bridge</p>
                  <p className="mt-1 text-[0.84rem] text-muted-foreground">
                    Create a new bridge connection and configure its request flow.
                  </p>
                </div>
                <span className="pt-0.5 text-[1rem] leading-none text-muted-foreground">+</span>
              </div>
            </Link>

            {chapterBlocks.length ? (
              <div className="grid gap-3">
                {chapterBlocks.map((block) => (
                  <Link
                    key={block.id}
                    href={`/bridge/${block.id}`}
                    className="rounded-xl border border-border bg-background px-4 py-3 transition hover:border-foreground/15"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.94rem] font-semibold text-foreground">{block.name}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {bridgeEntryKindLabel(block.entryKind)}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.84rem] text-muted-foreground">
                      {block.entryKind === "bridge"
                        ? block.endpoint
                        : normalizeRichTextHtml(block.publicNote ?? block.notes ?? "")
                            .replace(/<[^>]+>/g, " ")
                            .replace(/\s+/g, " ")
                            .trim() || `${bridgeEntryKindLabel(block.entryKind)} content`}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[0.84rem] text-muted-foreground">
                No blocks here yet.
              </p>
            )}
          </div>
        ) : null}

        {isBridgeEntry && bridge.apiConfig ? (
          <div className="grid gap-3 pt-2">
            <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">
              API configuration
            </h2>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Request preview
              </p>

              <div className="mt-3 grid gap-3 text-[0.84rem] text-foreground">
                <div>
                  <p className="font-semibold">Method</p>
                  <p className="mt-1 text-muted-foreground">{bridge.method ?? "GET"}</p>
                </div>

                <div>
                  <p className="font-semibold">Request URL</p>
                  <p className="mt-1 break-all text-muted-foreground">
                    {keyValueItemsToUrl(bridge.endpoint, bridge.apiConfig.queryParams)}
                  </p>
                </div>

                {apiHeaders.length ? (
                  <div>
                    <p className="font-semibold">Headers</p>
                    <div className="mt-1 grid gap-1">
                    {apiHeaders.map((item) => (
                      <p key={item.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{item.key || "(empty key)"}:</span>{" "}
                        {item.value || "(empty value)"}
                      </p>
                    ))}
                    </div>
                  </div>
                ) : null}

                {apiQueryParams.length ? (
                  <div>
                    <p className="font-semibold">Query params</p>
                    <div className="mt-1 grid gap-1">
                    {apiQueryParams.map((item) => (
                      <p key={item.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{item.key || "(empty key)"}</span>
                        {" = "}
                        {item.value || "(empty value)"}
                      </p>
                    ))}
                    </div>
                  </div>
                ) : null}

                {apiFormData.length ? (
                  <div>
                    <p className="font-semibold">Form data</p>
                    <div className="mt-1 grid gap-1">
                      {apiFormData.map((item) => (
                        <p key={item.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{item.key || "(empty key)"}</span>
                          {" = "}
                          {item.value || "(empty value)"}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {apiFormData.length ? (
                  <div>
                    <p className="font-semibold">Request body</p>
                    <p className="mt-1 text-muted-foreground">
                      This request will be sent as multipart form data.
                    </p>
                  </div>
                ) : hasRequestBody ? (
                  <div>
                    <p className="font-semibold">Request body</p>
                    <div className="mt-1">
                      <p className="text-muted-foreground">
                        Body type: <span className="font-medium text-foreground">{bridge.apiConfig.bodyType}</span>
                      </p>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-[0.78rem] text-foreground">
                        {bridge.apiConfig.body}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {isBridgeEntry && !bridge.apiConfig && (bridge.serviceName || bridge.secret || requiredFields.length) ? (
          <div className="grid gap-3 pt-2">
            <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">
              Bridge configuration
            </h2>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="grid gap-3 text-[0.84rem] text-foreground">
                {bridge.serviceName ? (
                  <div>
                    <p className="font-semibold">Service name</p>
                    <p className="mt-1 text-muted-foreground">{bridge.serviceName}</p>
                  </div>
                ) : null}

                {bridge.secret ? (
                  <div>
                    <p className="font-semibold">
                      {bridge.bridgeType === "webhook" ? "Signing secret" : "Handshake key"}
                    </p>
                    <p className="mt-1 text-muted-foreground">Configured</p>
                  </div>
                ) : null}

                {requiredFields.length ? (
                  <div>
                    <p className="font-semibold">Required fields</p>
                    <div className="mt-1 grid gap-1">
                      {requiredFields.map((item) => (
                        <p key={item.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {item.key || "(empty key)"}
                          </span>
                          {item.value ? ` - ${item.value}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {isBridgeEntry && richTextHasContent(normalizedPrivateNote) ? (
          <div className="pt-2">
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Private note
            </p>
            <div
              className="mt-2 prose prose-sm max-w-none text-[0.88rem] text-foreground"
              dangerouslySetInnerHTML={{ __html: normalizedPrivateNote }}
            />
          </div>
        ) : null}

        {isBridgeEntry && richTextHasContent(normalizedPublicNote) ? (
          <div className="pt-2">
            <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Public note
            </p>
            <div
              className="mt-2 prose prose-sm max-w-none text-[0.88rem] text-foreground"
              dangerouslySetInnerHTML={{ __html: normalizedPublicNote }}
            />
          </div>
        ) : null}
        {isBridgeEntry && hasRunActivity ? (
          <div className="space-y-5 pt-4">
            <div>
              <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">Response</h2>
            </div>

            {runRecord.output ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Output
                </p>
                <p className="mt-2 text-[0.98rem] font-semibold capitalize">
                  {runRecord.status}
                </p>
                <p className="mt-1 text-[0.84rem] text-muted-foreground">
                  {runRecord.lastRunAt
                    ? `Last run: ${new Date(runRecord.lastRunAt).toLocaleString()}`
                    : "Bridge has not been run yet."}
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-[0.8rem] text-foreground">
                  {runRecord.output}
                </pre>
                <div className="mt-3 grid gap-2 text-[0.82rem] text-foreground">
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
              </div>
            ) : null}

            <div className="space-y-4">
              {runRecord.response?.headers?.length ? (
                <div>
                  <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Response headers
                  </p>
                  <div className="mt-2 rounded-xl border border-border bg-background p-4">
                    <div className="grid gap-1">
                      {runRecord.response.headers.map((header) => (
                        <p key={header.id} className="text-[0.78rem] text-foreground">
                          <span className="font-semibold">{header.key}:</span> {header.value}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Response body
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-[0.78rem] text-foreground">
                  {runRecord.response?.body || "No response body yet."}
                </pre>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-4">
          <Link
            href={`/bridge/${bridge.id}/edit`}
            className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
          >
            Edit bridge
          </Link>
          <button
            type="button"
            onClick={duplicateBridge}
            disabled={isDuplicating}
            className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted disabled:opacity-60"
          >
            {isDuplicating ? "Duplicating..." : "Duplicate bridge"}
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
            className="inline-flex rounded-full border border-rose-200 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete bridge"}
          </button>
        </div>

        {isDeleteDialogOpen && bridge ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
              <div className="space-y-2">
                <p className="text-[0.76rem] font-semibold text-muted-foreground">Delete bridge</p>
                <h2 className="text-[1.2rem] font-semibold tracking-[-0.02em] text-foreground">
                  Remove {bridge.name}?
                </h2>
                <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
                  This will remove the bridge configuration and its saved run history from this
                  browser.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeleting}
                  className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={removeBridge}
                  disabled={isDeleting}
                  className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting..." : "Delete bridge"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {contextMenu && bridge.entryKind === "chapter" ? (
          <div
            className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-background p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={pasteIntoChapter}
              disabled={!clipboard?.items.length}
              className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clipboard?.items.length
                ? clipboard.items.length === 1
                  ? `Paste ${clipboard.items[0]?.name ?? "block"}`
                  : `Paste ${clipboard.items.length} blocks`
                : "Paste"}
            </button>
          </div>
        ) : null}
      </section>
  );
}
