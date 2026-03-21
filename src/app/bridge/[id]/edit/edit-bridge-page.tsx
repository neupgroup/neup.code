"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRIDGE_STORAGE_KEY, loadBridges, type BridgeItem } from "../../bridge-storage";
import { NewBridgeForm } from "../../new/new-bridge-form";

type EditBridgePageProps = {
  id: string;
};

export function EditBridgePage({ id }: EditBridgePageProps) {
  const [bridge, setBridge] = useState<BridgeItem | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const allBridges = loadBridges();
    setBridge(allBridges.find((item) => item.id === id) ?? null);
    setReady(true);
  }, [id]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== BRIDGE_STORAGE_KEY) return;
      const allBridges = loadBridges();
      setBridge(allBridges.find((item) => item.id === id) ?? null);
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [id]);

  if (!ready) {
    return (
      <section className="rounded-[1.1rem] border border-border bg-card p-6">
        <p className="text-[0.9rem] text-muted-foreground">Loading bridge editor...</p>
      </section>
    );
  }

  if (!bridge) {
    return (
      <section className="rounded-[1.1rem] border border-border bg-card p-6">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Bridge
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">
          Bridge not found
        </h1>
        <p className="mt-2 text-[0.9rem] text-muted-foreground">
          We could not find this bridge in browser storage.
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

  return <NewBridgeForm mode="edit" bridge={bridge} />;
}
