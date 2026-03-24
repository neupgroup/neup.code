import type { BridgeItem } from "./bridge-storage";

export function getBridgeDocRootHref() {
  return "/blocks";
}

export function getPageDocHref(id: string) {
  return `/blocks?id=${id}`;
}

export function getChapterDocHref(id: string) {
  return getPageDocHref(id);
}

export function getBridgeEditHref(id: string) {
  return `/bridge/${id}/edit`;
}

export function getBridgeEntryHref(item: Pick<BridgeItem, "id" | "entryKind">) {
  return item.entryKind === "chapter" ? getPageDocHref(item.id) : `/bridge/${item.id}`;
}
