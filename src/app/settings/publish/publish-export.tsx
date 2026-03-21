"use client";

import { useEffect, useMemo, useState } from "react";
import { loadBridges, type BridgeItem } from "../../bridge/bridge-storage";
import { richTextHasContent, richTextToMarkdown } from "../../bridge/rich-text";
import { loadComponents, type ComponentItem } from "../../components/component-storage";
import { buildZip } from "./zip";

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

function formatFileName(title: string, fallback: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function buildComponentMarkdown(component: ComponentItem) {
  const sections: string[] = [component.name, ""];

  if (component.description?.trim()) {
    sections.push(component.description.trim(), "");
  }

  if (!component.parts.length) {
    sections.push("No component parts added.");
    return sections.join("\n");
  }

  component.parts.forEach((part, index) => {
    sections.push(`## ${part.label || `Part ${index + 1}`}`, "");

    if (part.description?.trim()) {
      sections.push(part.description.trim(), "");
    }

    sections.push("```txt", part.code, "```", "");
  });

  return sections.join("\n").trimEnd();
}

function buildBridgeMarkdown(bridge: BridgeItem) {
  const sections: string[] = [
    bridge.name,
    "",
    `Type: ${bridge.bridgeType}`,
    `Endpoint: ${bridge.endpoint}`,
    `Environment: ${bridge.environment}`,
    `Private/internal: ${bridge.isPrivateInternal ? "true" : "false"}`,
    `Created at: ${bridge.createdAt}`,
  ];

  if (bridge.method) {
    sections.push(`Method: ${bridge.method}`);
  }

  if (bridge.serviceName) {
    sections.push(`Service name: ${bridge.serviceName}`);
  }

  if (bridge.secret) {
    sections.push("Secret configured: yes");
  }

  if (bridge.requiredFields?.length) {
    sections.push("", "## Required fields", "", formatKeyValueList(bridge.requiredFields));
  }

  const requestSection = formatBridgeRequest(bridge);
  if (requestSection) {
    sections.push("", requestSection);
  }

  const notesSection = formatBridgeNotes(bridge);
  if (notesSection) {
    sections.push("", notesSection);
  }

  return sections.join("\n").trimEnd();
}

function buildIndexMarkdown(
  componentFiles: Array<{ fileName: string }>,
  bridgeFiles: Array<{ fileName: string }>,
) {
  const lines = ["components:"];

  if (componentFiles.length) {
    lines.push(...componentFiles.map((file) => `-> ${file.fileName}`));
  } else {
    lines.push("-> none");
  }

  lines.push("", "bridge:");

  if (bridgeFiles.length) {
    lines.push(...bridgeFiles.map((file) => `-> ${file.fileName}`));
  } else {
    lines.push("-> none");
  }

  return lines.join("\n");
}

export function PublishExport() {
  const [ready, setReady] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState>({});
  const [bridges, setBridges] = useState<BridgeItem[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);

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
    setComponents(loadComponents());
    setReady(true);
  }, []);

  const zipEntries = useMemo(() => {
    const componentFiles = components.map((component, index) => {
      const baseName = formatFileName(component.name, `component_${index + 1}`);
      return {
        fileName: `${baseName}.md`,
        zipPath: `.docs/components/${baseName}.md`,
        content: buildComponentMarkdown(component),
      };
    });

    const bridgeFiles = bridges.map((bridge, index) => {
      const baseName = formatFileName(bridge.name, `bridge_${index + 1}`);
      return {
        fileName: `${baseName}.md`,
        zipPath: `.docs/brdge/${baseName}.md`,
        content: buildBridgeMarkdown(bridge),
      };
    });

    const indexContent = buildIndexMarkdown(componentFiles, bridgeFiles);

    return [
      ...componentFiles.map(({ zipPath, content }) => ({ name: zipPath, content })),
      ...bridgeFiles.map(({ zipPath, content }) => ({ name: zipPath, content })),
      { name: ".docs/index.md", content: indexContent },
    ];
  }, [bridges, components]);

  function downloadMarkdown() {
    const zipBytes = buildZip(zipEntries);
    const blob = new Blob([zipBytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neup-code-export.zip";
    anchor.click();
    URL.revokeObjectURL(url);
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
            Generate a Markdown export from the data saved in this browser, including onboarding
            state, bridge configuration, and notes.
          </p>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={downloadMarkdown}
          disabled={!ready}
          className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          Export Markdown
        </button>
      </div>
    </section>
  );
}
