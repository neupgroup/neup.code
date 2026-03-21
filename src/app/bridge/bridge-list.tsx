"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BRIDGE_STORAGE_KEY,
  loadBridges,
  saveBridges,
  type BridgeItem,
} from "./bridge-storage";

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

function bridgeTypeLabel(type: BridgeItem["bridgeType"]) {
  if (type === "grpc") return "gRPC";
  return type.charAt(0).toUpperCase() + type.slice(1);
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

export function BridgeList() {
  const [bridges, setBridges] = useState<BridgeItem[]>([]);
  const [ready, setReady] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingDragRef = useRef<PendingDragState | null>(null);
  const suppressClickRef = useRef(false);

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

      const remainingBridges = bridges.filter((bridge) => bridge.id !== dragState.id);
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
        const nextBridges = reorderBridges(
          bridges,
          activeDragState.id,
          activeDragState.targetIndex,
        );
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
  }, [bridges, dragState]);

  function beginDrag(
    event: React.PointerEvent<HTMLDivElement>,
    bridgeId: string,
    index: number,
  ) {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button")) return;

    const element = itemRefs.current[bridgeId];
    if (!element) return;

    pendingDragRef.current = {
      id: bridgeId,
      startY: event.clientY,
      initialIndex: index,
      itemHeight: element.getBoundingClientRect().height,
    };
  }

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
            {bridges.map((bridge, index) => {
              const isDragged = dragState?.id === bridge.id;
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
                  onClickCapture={(event) => {
                    if (!suppressClickRef.current) return;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  className={`relative rounded-xl border bg-background px-4 py-3 transition-[transform,box-shadow,border-color] duration-200 ease-out ${
                    isDragged
                      ? "z-30 cursor-grabbing border-foreground/20 bg-background ring-1 ring-foreground/10 shadow-[0_28px_70px_rgba(15,23,42,0.22)]"
                      : dragState
                        ? "z-0 border-border"
                        : "z-0 border-border hover:border-foreground/15 hover:bg-muted/25"
                  }`}
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
                      draggable={false}
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
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
