"use client";

import { useEffect, useMemo, useState } from "react";
import { loadBridges, type BridgeItem } from "../../bridge/bridge-storage";
import { richTextHasContent, richTextToMarkdown } from "../../bridge/rich-text";

const ONBOARDING_STORAGE_KEY = "neup.code.onboarding.github-flow.v1";

type OnboardingState = {
  repo?: string;
  target?: "repository" | "profile";
  isAuthorized?: boolean;
  started?: boolean;
};

function formatKeyValueList(items: BridgeItem["requiredFields"]) {
  if (!items?.length) return "";

  return items
    .map((item) => `- ${item.key || "(empty key)"}${item.value ? `: ${item.value}` : ""}`)
    .join("\n");
}

function formatBridgeNotes(bridge: BridgeItem) {
  const sections: string[] = [];

  if (richTextHasContent(bridge.privateNote ?? "")) {
    sections.push(`### Private note\n\n${richTextToMarkdown(bridge.privateNote ?? "")}`);
  }

  const publicNoteSource = bridge.publicNote ?? bridge.notes ?? "";
  if (richTextHasContent(publicNoteSource)) {
    sections.push(`### Public note\n\n${richTextToMarkdown(publicNoteSource)}`);
  }

  return sections.join("\n\n");
}

function formatBridgeRequest(bridge: BridgeItem) {
  if (bridge.bridgeType !== "api" || !bridge.apiConfig) return "";

  const lines = [
    `### Request configuration`,
    ``,
    `- Method: ${bridge.method ?? "GET"}`,
    `- Body type: ${bridge.apiConfig.bodyType}`,
  ];

  if (bridge.apiConfig.headers.length) {
    lines.push("", "#### Headers", "");
    lines.push(
      ...bridge.apiConfig.headers.map(
        (item) => `- ${item.key || "(empty key)"}: ${item.value || "(empty value)"}`,
      ),
    );
  }

  if (bridge.apiConfig.queryParams.length) {
    lines.push("", "#### Query params", "");
    lines.push(
      ...bridge.apiConfig.queryParams.map(
        (item) => `- ${item.key || "(empty key)"} = ${item.value || "(empty value)"}`,
      ),
    );
  }

  if (bridge.apiConfig.formData.length) {
    lines.push("", "#### Form data", "");
    lines.push(
      ...bridge.apiConfig.formData.map(
        (item) => `- ${item.key || "(empty key)"} = ${item.value || "(empty value)"}`,
      ),
    );
  }

  if (bridge.apiConfig.body) {
    lines.push("", "#### Body", "", "```txt", bridge.apiConfig.body, "```");
  }

  return lines.join("\n");
}

function buildMarkdown(onboarding: OnboardingState, bridges: BridgeItem[]) {
  const sections: string[] = [
    "# Neup.Code export",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Onboarding",
    "",
    `- Repository: ${onboarding.repo || "Not set"}`,
    `- Access target: ${onboarding.target || "Not set"}`,
    `- Authorized: ${onboarding.isAuthorized ? "Yes" : "No"}`,
    `- Started: ${onboarding.started ? "Yes" : "No"}`,
    "",
    "## Bridges",
  ];

  if (!bridges.length) {
    sections.push("", "No bridges saved.");
    return sections.join("\n");
  }

  bridges.forEach((bridge, index) => {
    sections.push(
      "",
      `### ${index + 1}. ${bridge.name}`,
      "",
      `- ID: ${bridge.id}`,
      `- Type: ${bridge.bridgeType}`,
      `- Endpoint: ${bridge.endpoint}`,
      `- Environment: ${bridge.environment}`,
      `- Private/internal: ${bridge.isPrivateInternal ? "true" : "false"}`,
      `- Created at: ${bridge.createdAt}`,
    );

    if (bridge.serviceName) {
      sections.push(`- Service name: ${bridge.serviceName}`);
    }

    if (bridge.secret) {
      sections.push(`- Secret configured: yes`);
    }

    if (bridge.requiredFields?.length) {
      sections.push("", "#### Required fields", "", formatKeyValueList(bridge.requiredFields));
    }

    const requestSection = formatBridgeRequest(bridge);
    if (requestSection) {
      sections.push("", requestSection);
    }

    const notesSection = formatBridgeNotes(bridge);
    if (notesSection) {
      sections.push("", notesSection);
    }
  });

  return sections.join("\n");
}

export function PublishExport() {
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState>({});
  const [bridges, setBridges] = useState<BridgeItem[]>([]);

  useEffect(() => {
    try {
      const rawOnboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (rawOnboarding) {
        const parsed = JSON.parse(rawOnboarding) as OnboardingState;
        setOnboarding(parsed);
      }
    } catch {
      setOnboarding({});
    }

    setBridges(loadBridges());
    setReady(true);
  }, []);

  const markdown = useMemo(() => buildMarkdown(onboarding, bridges), [onboarding, bridges]);

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neup-code-export.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <p className="text-[0.76rem] font-semibold text-muted-foreground">Publish</p>
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            Export everything as Markdown
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            Generate a Markdown export from the data saved in this browser, including onboarding state,
            bridge configuration, and notes.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadMarkdown}
          disabled={!ready}
          className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          Download Markdown
        </button>
        <button
          type="button"
          onClick={copyMarkdown}
          disabled={!ready}
          className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy Markdown"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-[0.76rem] font-semibold text-muted-foreground">Markdown preview</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[0.82rem] leading-[1.55] text-foreground">
          {ready ? markdown : "Loading export..."}
        </pre>
      </div>
    </section>
  );
}
