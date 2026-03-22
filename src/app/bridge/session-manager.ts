import type { BridgeEntryKind } from "./bridge-storage";

export type BridgeSessionClipboardAction = "cut" | "copy";

export type BridgeSessionClipboardEntry = {
  id: string;
  name: string;
  entryKind: BridgeEntryKind;
};

export type BridgeSessionClipboard = {
  action: BridgeSessionClipboardAction;
  items: BridgeSessionClipboardEntry[];
  createdAt: string;
};

export const BRIDGE_SESSION_STORAGE_KEY = "neup.code.bridge.session.v1";

type BridgeSessionState = {
  clipboard?: BridgeSessionClipboard;
};

function isBridgeEntryKind(value: unknown): value is BridgeEntryKind {
  return (
    value === "bridge" ||
    value === "chapter" ||
    value === "note" ||
    value === "heading1" ||
    value === "heading2" ||
    value === "heading3"
  );
}

function normalizeClipboardEntry(value: unknown): BridgeSessionClipboardEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Partial<BridgeSessionClipboardEntry>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !isBridgeEntryKind(candidate.entryKind)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    entryKind: candidate.entryKind,
  };
}

function normalizeClipboard(value: unknown): BridgeSessionClipboard | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as {
    action?: unknown;
    items?: unknown;
    createdAt?: unknown;
    id?: unknown;
    name?: unknown;
    entryKind?: unknown;
  };

  if (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string" &&
    candidate.action === "cut" &&
    isBridgeEntryKind(candidate.entryKind)
  ) {
    return {
      action: "cut",
      createdAt: candidate.createdAt,
      items: [
        {
          id: candidate.id,
          name: candidate.name,
          entryKind: candidate.entryKind,
        },
      ],
    };
  }

  if (
    (candidate.action !== "cut" && candidate.action !== "copy") ||
    typeof candidate.createdAt !== "string" ||
    !Array.isArray(candidate.items)
  ) {
    return null;
  }

  const items = candidate.items
    .map((item) => normalizeClipboardEntry(item))
    .filter((item): item is BridgeSessionClipboardEntry => item !== null);

  if (!items.length) return null;

  return {
    action: candidate.action,
    createdAt: candidate.createdAt,
    items,
  };
}

export function loadBridgeSessionState(): BridgeSessionState {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.sessionStorage.getItem(BRIDGE_SESSION_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const clipboard = normalizeClipboard((parsed as { clipboard?: unknown }).clipboard);
    if (!clipboard) return {};

    return { clipboard };
  } catch {
    return {};
  }
}

export function saveBridgeSessionState(state: BridgeSessionState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(BRIDGE_SESSION_STORAGE_KEY, JSON.stringify(state));
}

export function setBridgeClipboard(clipboard: BridgeSessionClipboard) {
  saveBridgeSessionState({ clipboard });
}

export function clearBridgeClipboard() {
  saveBridgeSessionState({});
}
