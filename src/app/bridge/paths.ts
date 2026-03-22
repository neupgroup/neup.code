import type { BridgeItem } from "./bridge-storage";

export function getBridgeDocRootHref() {
  return "/doc?type=bridge";
}

export function getChapterDocHref(id: string) {
  return `/doc?id=${id}&block=chapter`;
}

export function getBridgeEntryHref(item: Pick<BridgeItem, "id" | "entryKind">) {
  return item.entryKind === "chapter" ? getChapterDocHref(item.id) : `/bridge/${item.id}`;
}
