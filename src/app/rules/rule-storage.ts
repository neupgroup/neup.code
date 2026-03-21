export type RulePreset = "custom" | "gitignore" | "refactoring" | "formatting";

export type RuleItem = {
  id: string;
  title: string;
  content: string;
  preset: RulePreset;
  createdAt: string;
  updatedAt: string;
};

export const RULE_STORAGE_KEY = "neup.code.rules.items.v1";

export function loadRules(): RuleItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RULE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is RuleItem => {
      if (!item || typeof item !== "object") return false;
      if (typeof item.id !== "string") return false;
      if (typeof item.title !== "string") return false;
      if (typeof item.content !== "string") return false;
      if (typeof item.createdAt !== "string") return false;
      if (typeof item.updatedAt !== "string") return false;
      return (
        item.preset === "custom" ||
        item.preset === "gitignore" ||
        item.preset === "refactoring" ||
        item.preset === "formatting"
      );
    });
  } catch {
    return [];
  }
}

export function saveRules(items: RuleItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RULE_STORAGE_KEY, JSON.stringify(items));
}
