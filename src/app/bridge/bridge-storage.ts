export type BridgeType = "api" | "webhook" | "grpc" | "handshake";

export type BridgeKeyValueItem = {
  id: string;
  key: string;
  value: string;
};

export type ApiBridgeConfig = {
  headers: BridgeKeyValueItem[];
  queryParams: BridgeKeyValueItem[];
  formData: BridgeKeyValueItem[];
  bodyType: "none" | "json" | "raw";
  body: string;
};

export type BridgeItem = {
  id: string;
  name: string;
  bridgeType: BridgeType;
  endpoint: string;
  environment: "development" | "staging" | "production";
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  apiConfig?: ApiBridgeConfig;
  serviceName?: string;
  secret?: string;
  notes?: string;
  createdAt: string;
};

export const BRIDGE_STORAGE_KEY = "neup.code.bridge.items.v1";

function isBridgeType(value: string): value is BridgeType {
  return value === "api" || value === "webhook" || value === "grpc" || value === "handshake";
}

function isEnvironment(
  value: string,
): value is "development" | "staging" | "production" {
  return value === "development" || value === "staging" || value === "production";
}

export function loadBridges(): BridgeItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(BRIDGE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is BridgeItem => {
      if (!item || typeof item !== "object") return false;
      if (typeof item.id !== "string") return false;
      if (typeof item.name !== "string") return false;
      if (typeof item.endpoint !== "string") return false;
      if (typeof item.createdAt !== "string") return false;
      if (!isBridgeType(item.bridgeType)) return false;
      if (!isEnvironment(item.environment)) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export function saveBridges(items: BridgeItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify(items));
}
