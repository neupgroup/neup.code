import { cleanupOrphanedWorkspaceComponentBlocks } from "../page-blocks-storage";

export type ComponentPart = {
  id: string;
  label: string;
  description?: string;
  code: string;
};

export type ComponentItem = {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  parts: ComponentPart[];
  createdAt: string;
};

export const COMPONENT_STORAGE_KEY = "neup.code.components.items.v1";

export function loadComponents(): ComponentItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(COMPONENT_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): ComponentItem | null => {
        if (!item || typeof item !== "object") return null;
        if (typeof item.id !== "string") return null;
        if (typeof item.name !== "string") return null;
        if (typeof item.createdAt !== "string") return null;
        if (!Array.isArray(item.parts)) return null;

        const tags = Array.isArray(item.tags)
          ? (item.tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
          : [];

        const rawParts = item.parts as unknown[];

        return {
          id: item.id,
          name: item.name,
          description: typeof item.description === "string" ? item.description : undefined,
          tags,
          parts: rawParts
            .filter((part: unknown): part is ComponentPart => {
              if (!part || typeof part !== "object") return false;
              const candidate = part as Record<string, unknown>;

              return (
                typeof candidate.id === "string" &&
                typeof candidate.label === "string" &&
                typeof candidate.code === "string"
              );
            })
            .map((part) => ({
              ...part,
              description:
                typeof (part as { description?: unknown }).description === "string"
                  ? (part as { description?: string }).description
                  : undefined,
            })),
          createdAt: item.createdAt,
        };
      })
      .filter((item): item is ComponentItem => item !== null);
  } catch {
    return [];
  }
}

export function saveComponents(items: ComponentItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPONENT_STORAGE_KEY, JSON.stringify(items));
  cleanupOrphanedWorkspaceComponentBlocks(items.map((item) => item.id));
}
