"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BRIDGE_STORAGE_KEY,
  deleteBridge,
  deleteBridgeRun,
  loadBridges,
  saveBridges,
  type BridgeItem,
} from "./bridge-storage";
import {
  BRIDGE_SESSION_STORAGE_KEY,
  loadBridgeSessionState,
  setBridgeClipboard,
  type BridgeSessionClipboard,
  type BridgeSessionClipboardAction,
} from "./session-manager";

const CARD_GAP = 12;
const DRAG_START_THRESHOLD = 6;

type DragState = {
  id: string;
  startY: number;
  currentY: number;
  initialIndex: number;
  targetIndex: number;
  itemHeight: number;
};

type PendingDragState = {
  id: string;
  startY: number;
  initialIndex: number;
  itemHeight: number;
};

type ContextMenuState = {
  bridgeId: string;
  x: number;
  y: number;
};

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

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function duplicateKeyValueItems(items?: BridgeItem["requiredFields"]) {
  return items?.map((item) => ({
    id: createId(),
    key: item.key,
    value: item.value,
  }));
}

function duplicateBridgeItem(item: BridgeItem): BridgeItem {
  return {
    ...item,
    id: createId(),
    name: `${item.name} Copy`,
    createdAt: new Date().toISOString(),
    chapterBlockIds: [],
    apiConfig: item.apiConfig
      ? {
          ...item.apiConfig,
          headers: duplicateKeyValueItems(item.apiConfig.headers) ?? [],
          queryParams: duplicateKeyValueItems(item.apiConfig.queryParams) ?? [],
          formData: duplicateKeyValueItems(item.apiConfig.formData) ?? [],
        }
      : undefined,
    requiredFields: duplicateKeyValueItems(item.requiredFields),
  };
}

function reorderBridges(
  items: BridgeItem[],
  sourceId: string,
  targetIndex: number,
): BridgeItem[] {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  if (sourceIndex === -1) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

function siblingOffset(index: number, dragState: DragState) {
  const distance = dragState.itemHeight + CARD_GAP;

  if (dragState.initialIndex < dragState.targetIndex) {
    if (index > dragState.initialIndex && index <= dragState.targetIndex) {
      return -distance;
    }
  } else if (dragState.initialIndex > dragState.targetIndex) {
    if (index >= dragState.targetIndex && index < dragState.initialIndex) {
      return distance;
    }
  }

  return 0;
}

function isModifierSelection(event: { ctrlKey: boolean; metaKey: boolean }) {
  return event.ctrlKey || event.metaKey;
}

export function BridgeList() {
  const [bridges, setBridges] = useState<BridgeItem[]>([]);
  const [ready, setReady] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedBridgeIds, setSelectedBridgeIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<BridgeSessionClipboard | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingDragRef = useRef<PendingDragState | null>(null);
  const suppressClickRef = useRef(false);
  const visibleBridges = useMemo(
    () => bridges.filter((bridge) => !bridge.parentChapterId),
    [bridges],
  );

  useEffect(() => {
    setBridges(loadBridges());
    setClipboard(loadBridgeSessionState().clipboard ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === BRIDGE_STORAGE_KEY) {
        setBridges(loadBridges());
      }

      if (event.key === BRIDGE_SESSION_STORAGE_KEY) {
        setClipboard(loadBridgeSessionState().clipboard ?? null);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const pendingDrag = pendingDragRef.current;
      if (!pendingDrag) return;

      const deltaY = event.clientY - pendingDrag.startY;
      if (!dragState && Math.abs(deltaY) < DRAG_START_THRESHOLD) return;

      if (!dragState) {
        suppressClickRef.current = true;
        setDragState({
          id: pendingDrag.id,
          startY: pendingDrag.startY,
          currentY: event.clientY,
          initialIndex: pendingDrag.initialIndex,
          targetIndex: pendingDrag.initialIndex,
          itemHeight: pendingDrag.itemHeight,
        });
        return;
      }

      const remainingBridges = visibleBridges.filter((bridge) => bridge.id !== dragState.id);
      let nextTargetIndex = 0;

      for (const bridge of remainingBridges) {
        const element = itemRefs.current[bridge.id];
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (event.clientY > rect.top + rect.height / 2) {
          nextTargetIndex += 1;
        }
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentY: event.clientY,
              targetIndex: nextTargetIndex,
            }
          : prev,
      );
    }

    function onPointerUp() {
      const activeDragState = dragState;
      pendingDragRef.current = null;

      if (activeDragState) {
        const reorderedVisibleBridges = reorderBridges(
          visibleBridges,
          activeDragState.id,
          activeDragState.targetIndex,
        );
        const nestedBridges = bridges.filter((bridge) => bridge.parentChapterId);
        const nextBridges = [...reorderedVisibleBridges, ...nestedBridges];
        setBridges(nextBridges);
        saveBridges(nextBridges);
      }

      setDragState(null);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [bridges, dragState, visibleBridges]);

  const clipboardCutIds = useMemo(
    () =>
      new Set(
        clipboard?.action === "cut" ? clipboard.items.map((item) => item.id) : [],
      ),
    [clipboard],
  );

  function beginDrag(
    event: React.PointerEvent<HTMLDivElement>,
    bridgeId: string,
    index: number,
  ) {
    if (event.button !== 0 || isModifierSelection(event)) return;

    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;

    const element = itemRefs.current[bridgeId];
    if (!element) return;

    pendingDragRef.current = {
      id: bridgeId,
      startY: event.clientY,
      initialIndex: index,
      itemHeight: element.getBoundingClientRect().height,
    };
  }

  function toggleBridgeSelection(bridgeId: string) {
    setSelectedBridgeIds((current) =>
      current.includes(bridgeId)
        ? current.filter((id) => id !== bridgeId)
        : [...current, bridgeId],
    );
  }

  function getActionTargetBridges(contextBridgeId: string) {
    const targetIds = selectedBridgeIds.includes(contextBridgeId)
      ? selectedBridgeIds
      : [contextBridgeId];

    return visibleBridges.filter((bridge) => targetIds.includes(bridge.id));
  }

  function saveClipboardSelection(
    action: BridgeSessionClipboardAction,
    targetBridges: BridgeItem[],
  ) {
    if (!targetBridges.length) return;

    const nextClipboard: BridgeSessionClipboard = {
      action,
      createdAt: new Date().toISOString(),
      items: targetBridges.map((bridge) => ({
        id: bridge.id,
        name: bridge.name,
        entryKind: bridge.entryKind ?? "bridge",
      })),
    };

    setBridgeClipboard(nextClipboard);
    setClipboard(nextClipboard);
    setSelectedBridgeIds(targetBridges.map((bridge) => bridge.id));
    setContextMenu(null);
  }

  function handleCut(contextBridgeId: string) {
    saveClipboardSelection("cut", getActionTargetBridges(contextBridgeId));
  }

  function handleCopy(contextBridgeId: string) {
    saveClipboardSelection("copy", getActionTargetBridges(contextBridgeId));
  }

  function handleDuplicate(bridge: BridgeItem) {
    const duplicatedBridge = duplicateBridgeItem(bridge);
    const currentBridges = loadBridges();
    const sourceIndex = currentBridges.findIndex((item) => item.id === bridge.id);

    if (sourceIndex === -1) return;

    const nextBridges = [...currentBridges];
    nextBridges.splice(sourceIndex + 1, 0, duplicatedBridge);
    saveBridges(nextBridges);
    setBridges(nextBridges);
    setSelectedBridgeIds([duplicatedBridge.id]);
    setContextMenu(null);
  }

  function openDeleteDialog(contextBridgeId: string) {
    const targets = getActionTargetBridges(contextBridgeId);
    if (!targets.length) return;

    setDeleteTargetIds(targets.map((bridge) => bridge.id));
    setContextMenu(null);
  }

  function removeBridges() {
    if (!deleteTargetIds.length || isDeleting) return;

    setIsDeleting(true);

    for (const bridgeId of deleteTargetIds) {
      deleteBridge(bridgeId);
      deleteBridgeRun(bridgeId);
    }

    const nextBridges = loadBridges();
    setBridges(nextBridges);
    setSelectedBridgeIds((current) => current.filter((id) => !deleteTargetIds.includes(id)));
    setDeleteTargetIds([]);
    setIsDeleting(false);
  }

  const deleteTargetBridges = visibleBridges.filter((bridge) =>
    deleteTargetIds.includes(bridge.id),
  );

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Bridge
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">Bridge</h1>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Configure your bridge connections.
        </p>
      </div>

      <div className="pt-1">
        {!ready ? (
          <p className="text-[0.88rem] text-muted-foreground">Loading bridges...</p>
        ) : (
          <div className="grid gap-3">
            <Link
              href="/bridge/add?chapter=base"
              className="rounded-xl border border-border bg-background p-4 transition hover:border-foreground/20"
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

            {!visibleBridges.length ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[0.88rem] text-muted-foreground">
                No bridge saved yet. Use the add card above to create your first one.
              </p>
            ) : null}

            {visibleBridges.map((bridge, index) => {
              const isDragged = dragState?.id === bridge.id;
              const isSelected = selectedBridgeIds.includes(bridge.id);
              const isCut = clipboardCutIds.has(bridge.id);
              const translationY = isDragged
                ? dragState.currentY - dragState.startY
                : dragState
                  ? siblingOffset(index, dragState)
                  : 0;

              return (
                <div
                  key={bridge.id}
                  ref={(element) => {
                    itemRefs.current[bridge.id] = element;
                  }}
                  onPointerDown={(event) => beginDrag(event, bridge.id, index)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedBridgeIds((current) =>
                      current.includes(bridge.id) ? current : [bridge.id],
                    );
                    setContextMenu({
                      bridgeId: bridge.id,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  onClickCapture={(event) => {
                    if (suppressClickRef.current) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }

                    if (!isModifierSelection(event)) return;

                    const target = event.target as HTMLElement;
                    if (target.closest("button")) return;

                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu(null);
                    toggleBridgeSelection(bridge.id);
                  }}
                  className={`relative rounded-xl border bg-background px-4 py-3 transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out ${
                    isDragged
                      ? "z-30 cursor-grabbing border-foreground/20 ring-1 ring-foreground/10 shadow-[0_28px_70px_rgba(15,23,42,0.22)]"
                      : isSelected
                        ? "z-10 border-sky-400 ring-2 ring-sky-200"
                        : dragState
                          ? "z-0 border-border"
                          : "z-0 border-border hover:border-foreground/15 hover:bg-muted/25"
                  } ${isCut && !isDragged ? "opacity-60" : "opacity-100"}`}
                  style={{
                    transform: `translateY(${translationY}px) scale(${isDragged ? 1.015 : 1})`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/bridge/${bridge.id}`}
                      draggable={false}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[1rem] font-semibold">{bridge.name}</h2>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {bridgeEntryKindLabel(bridge.entryKind)}
                        </span>
                        {bridge.entryKind === "bridge" ? (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            {bridgeTypeLabel(bridge.bridgeType)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[0.84rem] text-muted-foreground">
                        {bridge.entryKind === "bridge"
                          ? bridge.endpoint
                          : stripHtml(bridge.publicNote ?? bridge.notes ?? "") ||
                            `${bridgeEntryKindLabel(bridge.entryKind)} content`}
                      </p>
                    </Link>

                    <Link
                      href={`/bridge/${bridge.id}/edit`}
                      draggable={false}
                      className="inline-flex rounded-full border border-border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
                    >
                      Edit bridge
                    </Link>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[0.75rem] text-muted-foreground">
                    {bridge.entryKind === "bridge" ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {bridge.environment}
                      </span>
                    ) : null}
                    {bridge.entryKind === "bridge" && bridge.method ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {bridge.method}
                      </span>
                    ) : null}
                    {bridge.entryKind === "bridge" && bridge.serviceName ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        service: {bridge.serviceName}
                      </span>
                    ) : null}
                    {bridge.entryKind === "bridge" && bridge.secret ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        secret set
                      </span>
                    ) : null}
                    {bridge.entryKind === "bridge" && bridge.apiConfig ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        headers: {bridge.apiConfig.headers.length}
                      </span>
                    ) : null}
                    {bridge.entryKind === "bridge" && bridge.apiConfig ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        form-data: {bridge.apiConfig.formData.length}
                      </span>
                    ) : null}
                    {bridge.entryKind === "bridge" && bridge.apiConfig ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        body: {bridge.apiConfig.bodyType}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {contextMenu ? (
        <div
          className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-background p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {visibleBridges
            .filter((bridge) => bridge.id === contextMenu.bridgeId)
            .map((bridge) => {
              const actionTargets = getActionTargetBridges(bridge.id);
              const actionCount = actionTargets.length;

              return (
                <div key={bridge.id} className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => handleCut(bridge.id)}
                    className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted"
                  >
                    {actionCount > 1 ? `Cut ${actionCount} items` : "Cut"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(bridge.id)}
                    className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted"
                  >
                    {actionCount > 1 ? `Copy ${actionCount} items` : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteDialog(bridge.id)}
                    className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    {actionCount > 1 ? `Delete ${actionCount} items` : "Delete"}
                  </button>
                  {bridge.entryKind === "bridge" || bridge.entryKind === "note" ? (
                    <button
                      type="button"
                      onClick={() => handleDuplicate(bridge)}
                      className="flex w-full rounded-lg px-3 py-2 text-left text-[0.84rem] font-medium text-foreground transition hover:bg-muted"
                    >
                      Duplicate
                    </button>
                  ) : null}
                </div>
              );
            })}
        </div>
      ) : null}

      {deleteTargetBridges.length ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
            <div className="space-y-2">
              <p className="text-[0.76rem] font-semibold text-muted-foreground">
                Delete bridge
              </p>
              <h2 className="text-[1.2rem] font-semibold tracking-[-0.02em] text-foreground">
                {deleteTargetBridges.length === 1
                  ? `Remove ${deleteTargetBridges[0]?.name}?`
                  : `Remove ${deleteTargetBridges.length} blocks?`}
              </h2>
              <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
                This will remove the selected blocks and their saved run history from this
                browser.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTargetIds([])}
                disabled={isDeleting}
                className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={removeBridges}
                disabled={isDeleting}
                className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
