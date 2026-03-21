"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BRIDGE_RUN_STORAGE_KEY,
  saveBridgeRuns,
  saveBridges,
  type BridgeItem,
} from "../../bridge/bridge-storage";
import { saveComponents, type ComponentItem } from "../../components/component-storage";
import { readZip } from "../publish/zip";

const ONBOARDING_STORAGE_KEY = "neup.code.onboarding.github-flow.v1";

type OnboardingState = {
  repo?: string;
  target?: "repository" | "profile";
  isAuthorized?: boolean;
  started?: boolean;
};

type ExportManifest = {
  version: 1;
  generatedAt: string;
  onboarding: OnboardingState;
  bridges: BridgeItem[];
  components: ComponentItem[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidManifest(value: unknown): value is ExportManifest {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (!Array.isArray(value.bridges)) return false;
  if (!Array.isArray(value.components)) return false;
  return true;
}

export function ImportWorkspace() {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setMessage(null);
    setError(null);

    if (!file) {
      setSelectedFileName(null);
      return;
    }

    setSelectedFileName(file.name);
    setIsImporting(true);

    try {
      const zipEntries = readZip(await file.arrayBuffer());
      const manifestEntry = zipEntries.find((entry) => entry.name === ".docs/manifest.json");

      if (!manifestEntry) {
        throw new Error("This export does not include a manifest. Re-export using the latest version of Neup.Code.");
      }

      const parsed = JSON.parse(manifestEntry.content) as unknown;
      if (!isValidManifest(parsed)) {
        throw new Error("The manifest inside this zip is invalid.");
      }

      window.localStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify(parsed.onboarding ?? {}),
      );
      saveBridges(parsed.bridges);
      saveComponents(parsed.components);
      saveBridgeRuns({});
      window.localStorage.removeItem(BRIDGE_RUN_STORAGE_KEY);

      setMessage(
        `Imported ${parsed.components.length} component${parsed.components.length === 1 ? "" : "s"} and ${parsed.bridges.length} bridge${parsed.bridges.length === 1 ? "" : "s"} into this browser.`,
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The selected file could not be imported.",
      );
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
        >
          <span aria-hidden="true">&lt;</span>
          <span>Settings</span>
        </Link>
        <div className="space-y-2">
          <p className="text-[0.76rem] font-semibold text-muted-foreground">Settings</p>
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            Import
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            Upload a Neup.Code export zip and restore its components, bridges, and onboarding data
            into this browser.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-[0.78rem] font-semibold text-muted-foreground">Export zip</span>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={handleFileChange}
            disabled={isImporting}
            className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
          />
        </label>

        {selectedFileName ? (
          <p className="text-[0.84rem] text-muted-foreground">Selected file: {selectedFileName}</p>
        ) : null}

        <p className="max-w-2xl text-[0.84rem] text-muted-foreground">
          Import replaces the saved onboarding state, components, and bridges in this browser. Run
          history is cleared during import because responses are not part of the export package.
        </p>

        {message ? <p className="text-[0.84rem] text-emerald-700">{message}</p> : null}
        {error ? <p className="text-[0.84rem] text-rose-600">{error}</p> : null}
      </div>
    </section>
  );
}
