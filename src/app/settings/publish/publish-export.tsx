"use client";

import { loadBridges, type BridgeItem } from "../../bridge/bridge-storage";
import {
  richTextHasContent,
  richTextToMarkdown,
  richTextToPlainText,
} from "../../bridge/rich-text";
import { loadComponents, type ComponentItem } from "../../components/component-storage";
import {
  loadWorkspacePageBlocks,
  type WorkspacePageBlock,
  type WorkspacePageKey,
} from "../../page-blocks-storage";
import { buildZip } from "./zip";

const ONBOARDING_STORAGE_KEY = "neup.code.onboarding.github-flow.v1";
const DOC_PAGE_KEYS: WorkspacePageKey[] = ["bridge", "design", "components"];

type OnboardingState = {
  repo?: string;
  target?: "repository" | "profile";
  isAuthorized?: boolean;
  started?: boolean;
};

type ExportManifest = {
  version: 2;
  generatedAt: string;
  onboarding: OnboardingState;
  bridges: BridgeItem[];
  components: ComponentItem[];
  workspacePageBlocks: WorkspacePageBlock[];
};

type ExportSnapshot = {
  onboarding: OnboardingState;
  bridges: BridgeItem[];
  components: ComponentItem[];
  workspacePageBlocks: WorkspacePageBlock[];
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

function loadOnboardingState() {
  try {
    const rawOnboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!rawOnboarding) return {};
    return JSON.parse(rawOnboarding) as OnboardingState;
  } catch {
    return {};
  }
}

function buildComponentMarkdown(component: ComponentItem) {
  const sections: string[] = [`# ${component.name}`, ""];

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
    `# ${bridge.name}`,
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
  pageFiles: Array<{ fileName: string }>,
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

  lines.push("", "pages:");

  if (pageFiles.length) {
    lines.push(...pageFiles.map((file) => `-> ${file.fileName}`));
  } else {
    lines.push("-> none");
  }

  return lines.join("\n");
}

function getPageTitle(pageKey: WorkspacePageKey) {
  if (pageKey === "bridge") return "Bridge";
  if (pageKey === "design") return "Design";
  return "Components";
}

function getLinkedBlockLabel(
  block: WorkspacePageBlock,
  bridges: BridgeItem[],
  components: ComponentItem[],
) {
  if (block.kind === "component") {
    const component = components.find((item) => item.id === block.content);
    if (component) {
      return `> Component block: ${component.name}`;
    }

    return block.content
      ? `> Component block: Missing component (${block.content})`
      : "> Component block: Unlinked";
  }

  if (block.kind === "chapter" || block.kind === "api" || block.kind === "webhook" || block.kind === "grpc") {
    const bridge = bridges.find((item) => item.id === block.content);
    const blockLabel =
      block.kind === "chapter"
        ? "Chapter"
        : block.kind === "api"
          ? "API"
          : block.kind === "webhook"
            ? "Webhook"
            : "gRPC";

    if (bridge) {
      return `> ${blockLabel} block: ${bridge.name}`;
    }

    return block.content
      ? `> ${blockLabel} block: Missing bridge (${block.content})`
      : `> ${blockLabel} block: Unlinked`;
  }

  return "";
}

function buildPageMarkdown(
  pageKey: WorkspacePageKey,
  blocks: WorkspacePageBlock[],
  bridges: BridgeItem[],
  components: ComponentItem[],
) {
  const sections: string[] = [`# ${getPageTitle(pageKey)}`, ""];
  const pageBlocks = blocks.filter((block) => block.pageKey === pageKey);

  pageBlocks.forEach((block) => {
    if (block.kind === "note") {
      const content = richTextToMarkdown(block.content);
      if (content) {
        sections.push(content, "");
      }
      return;
    }

    if (block.kind === "heading1" || block.kind === "heading2" || block.kind === "heading3") {
      const content = richTextToPlainText(block.content) || "Untitled heading";
      const marker = block.kind === "heading1" ? "#" : block.kind === "heading2" ? "##" : "###";
      sections.push(`${marker} ${content}`, "");
      return;
    }

    const linkedBlock = getLinkedBlockLabel(block, bridges, components);
    if (linkedBlock) {
      sections.push(linkedBlock, "");
    }
  });

  if (sections.length === 2) {
    sections.push("No doc blocks saved.");
  }

  return sections.join("\n").trimEnd();
}

function buildZipEntries(snapshot: ExportSnapshot) {
    const manifest: ExportManifest = {
      version: 2,
      generatedAt: new Date().toISOString(),
      onboarding: snapshot.onboarding,
      bridges: snapshot.bridges,
      components: snapshot.components,
      workspacePageBlocks: snapshot.workspacePageBlocks,
    };

    const componentFiles = snapshot.components.map((component, index) => {
      const baseName = formatFileName(component.name, `component_${index + 1}`);
      return {
        fileName: `${baseName}.md`,
        zipPath: `.docs/components/${baseName}.md`,
        content: buildComponentMarkdown(component),
      };
    });

    const bridgeFiles = snapshot.bridges.map((bridge, index) => {
      const baseName = formatFileName(bridge.name, `bridge_${index + 1}`);
      return {
        fileName: `${baseName}.md`,
        zipPath: `.docs/brdge/${baseName}.md`,
        content: buildBridgeMarkdown(bridge),
      };
    });

    const pageFiles = DOC_PAGE_KEYS.map((pageKey) => ({
      fileName: `${pageKey}.md`,
      zipPath: `.docs/pages/${pageKey}.md`,
      content: buildPageMarkdown(
        pageKey,
        snapshot.workspacePageBlocks,
        snapshot.bridges,
        snapshot.components,
      ),
    }));

    const indexContent = buildIndexMarkdown(componentFiles, bridgeFiles, pageFiles);

  return [
    ...componentFiles.map(({ zipPath, content }) => ({ name: zipPath, content })),
    ...bridgeFiles.map(({ zipPath, content }) => ({ name: zipPath, content })),
    ...pageFiles.map(({ zipPath, content }) => ({ name: zipPath, content })),
    { name: ".docs/index.md", content: indexContent },
    { name: ".docs/manifest.json", content: JSON.stringify(manifest, null, 2) },
  ];
}

export function PublishExport() {
  function loadExportSnapshot(): ExportSnapshot {
    return {
      onboarding: loadOnboardingState(),
      bridges: loadBridges(),
      components: loadComponents(),
      workspacePageBlocks: loadWorkspacePageBlocks(),
    };
  }

  function downloadMarkdown() {
    const snapshot = loadExportSnapshot();
    const zipEntries = buildZipEntries(snapshot);
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
            Generate a Markdown export from the latest data saved in this browser, including
            onboarding state, workspace docs, bridge configuration, and notes.
          </p>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={downloadMarkdown}
          className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          Export Markdown
        </button>
      </div>
    </section>
  );
}
