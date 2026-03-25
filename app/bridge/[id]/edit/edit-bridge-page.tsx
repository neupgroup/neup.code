"use client";

import { useSyncExternalStore } from "react";
import { PageNotFoundView } from "@/components/page-not-found-view";
import { BRIDGE_STORAGE_EVENT, BRIDGE_STORAGE_KEY, loadBridges, type BridgeItem } from "../../bridge-storage";
import { NewBridgeForm } from "../../new/new-bridge-form";
import { getBridgeDocRootHref } from "../../paths";

type EditBridgePageProps = {
  id: string;
};

export function EditBridgePage({ id }: EditBridgePageProps) {
  const ready = useSyncExternalStore(subscribeToHydrationState, getHydrationSnapshot, getServerHydrationSnapshot);
  const bridge = useSyncExternalStore(
    subscribeToBridgeChanges,
    () => getBridgeSnapshot(id),
    () => null,
  );

  if (!ready) {
    return (
      <section>
        <p className="text-[0.9rem] text-muted-foreground">Loading bridge editor...</p>
      </section>
    );
  }

  if (!bridge) {
    return <PageNotFoundView href={getBridgeDocRootHref()} ctaLabel="Back to Bridge" />;
  }

  return <NewBridgeForm mode="edit" bridge={bridge} />;
}

function subscribeToBridgeChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  function onStorage(event: StorageEvent) {
    if (event.key && event.key !== BRIDGE_STORAGE_KEY) return;
    onStoreChange();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(BRIDGE_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BRIDGE_STORAGE_EVENT, onStoreChange);
  };
}

function getBridgeSnapshot(id: string): BridgeItem | null {
  return loadBridges().find((item) => item.id === id) ?? null;
}

function subscribeToHydrationState() {
  return () => {};
}

function getHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}
