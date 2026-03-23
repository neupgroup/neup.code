import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage workspace settings and exports.",
};

export default function SettingsPage() {
  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <p className="text-[0.76rem] font-semibold text-muted-foreground">Settings</p>
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            Settings
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            Manage export and workspace-level settings from here.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <Link
          href="/settings/import"
          className="rounded-xl border border-border bg-background p-4 transition hover:border-foreground/20"
        >
          <p className="text-[0.96rem] font-semibold text-foreground">Import</p>
          <p className="mt-1 text-[0.86rem] text-muted-foreground">
            Import saved workspace documentation and configuration into this browser.
          </p>
        </Link>
        <Link
          href="/settings/publish"
          className="rounded-xl border border-border bg-background p-4 transition hover:border-foreground/20"
        >
          <p className="text-[0.96rem] font-semibold text-foreground">Publish</p>
          <p className="mt-1 text-[0.86rem] text-muted-foreground">
            Export your saved workspace docs, bridges, and components as Markdown in a zip archive.
          </p>
        </Link>
        <Link
          href="/settings/syncstat"
          className="rounded-xl border border-border bg-background p-4 transition hover:border-foreground/20"
        >
          <p className="text-[0.96rem] font-semibold text-foreground">Sync Status</p>
          <p className="mt-1 text-[0.86rem] text-muted-foreground">
            Compare browser-stored data with the current database snapshot returned by the sync API.
          </p>
        </Link>
      </div>
    </section>
  );
}
