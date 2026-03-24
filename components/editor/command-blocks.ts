import type { BridgeItem } from "../../app/bridge/bridge-storage";
import type {
  WorkspacePageBlockKind,
  WorkspacePageKey,
} from "../../app/page-blocks-storage";
import type { SlashCommand } from "./inline-note-block";

export type PageMeta = {
  eyebrow: string;
  title: string;
  description: string;
  commands: SlashCommand[];
};

export const TEXT_BLOCK_KINDS: WorkspacePageBlockKind[] = [
  "note",
  "heading1",
  "heading2",
  "heading3",
];

const PAGE_META: Record<WorkspacePageKey, PageMeta> = {
  bridge: {
    eyebrow: "Bridge",
    title: "Bridge",
    description:
      "Capture APIs, webhooks, sections, and notes in one shared document editor.",
    commands: [
      {
        id: "p",
        label: "Paragraph",
        description: "Standard text block",
        keywords: ["p", "paragraph", "text"],
      },
      {
        id: "chapter",
        label: "Page",
        description: "Create a nested page block",
        keywords: ["page", "chapter", "section"],
      },
      {
        id: "h1",
        label: "Heading 1",
        description: "Large section heading",
        keywords: ["h1", "#", "heading"],
      },
      {
        id: "h2",
        label: "Heading 2",
        description: "Medium section heading",
        keywords: ["h2", "##", "heading"],
      },
      {
        id: "h3",
        label: "Heading 3",
        description: "Small section heading",
        keywords: ["h3", "###", "heading"],
      },
      {
        id: "api",
        label: "API block",
        description: "Insert an API bridge block",
        keywords: ["api", "http", "request"],
      },
      {
        id: "webhook",
        label: "Webhook block",
        description: "Insert a webhook bridge block",
        keywords: ["webhook", "hook"],
      },
      {
        id: "grpc",
        label: "gRPC block",
        description: "Insert a gRPC bridge block",
        keywords: ["grpc", "rpc"],
      },
    ],
  },
};

export function isTextBlockKind(kind: WorkspacePageBlockKind) {
  return TEXT_BLOCK_KINDS.includes(kind);
}

export function slashCommandToKind(
  pageKey: WorkspacePageKey,
  command: string,
) {
  if (command === "/p") return "note";
  if (command === "/h1" || command === "#") return "heading1";
  if (command === "/h2" || command === "##") return "heading2";
  if (command === "/h3" || command === "###") return "heading3";

  if (pageKey === "bridge") {
    if (command === "/chapter") return "chapter";
    if (command === "/api") return "api";
    if (command === "/webhook") return "webhook";
    if (command === "/grpc") return "grpc";
  }

  return null;
}

export function commandIdToKind(
  pageKey: WorkspacePageKey,
  commandId: string,
) {
  if (commandId === "p") return "note";
  if (commandId === "h1") return "heading1";
  if (commandId === "h2") return "heading2";
  if (commandId === "h3") return "heading3";

  if (
    pageKey === "bridge" &&
    (commandId === "chapter" ||
      commandId === "api" ||
      commandId === "webhook" ||
      commandId === "grpc")
  ) {
    return commandId;
  }

  return null;
}

export function headingEditorClassName(kind: WorkspacePageBlockKind) {
  if (kind === "heading1") {
    return "text-[1.55rem] font-semibold tracking-[-0.02em] leading-[1.2]";
  }

  if (kind === "heading2") {
    return "text-[1.25rem] font-semibold tracking-[-0.018em] leading-[1.3]";
  }

  if (kind === "heading3") {
    return "text-[1.06rem] font-semibold tracking-[-0.012em] leading-[1.4]";
  }

  return "";
}

export function blockPlaceholder(kind: WorkspacePageBlockKind) {
  if (kind === "heading1") return "Heading 1";
  if (kind === "heading2") return "Heading 2";
  if (kind === "heading3") return "Heading 3";
  return "Continue typing, or type / for commands";
}

export function getContextMenuAddLabel(command: SlashCommand) {
  if (command.id === "p") return "P block";
  if (command.id === "h1") return "H1 block";
  if (command.id === "h2") return "H2 block";
  if (command.id === "h3") return "H3 block";
  return command.label.toLowerCase().includes("block")
    ? command.label
    : `${command.label} block`;
}

export function getAddActionDefinitions(pageKey: WorkspacePageKey) {
  const baseActions: Array<
    Pick<SlashCommand, "id" | "description" | "keywords"> & {
      label: string;
    }
  > = [
    {
      id: "p",
      label: "P block",
      description: "Standard text block",
      keywords: ["p", "paragraph", "text"],
    },
    {
      id: "h1",
      label: "H1 block",
      description: "Large section heading",
      keywords: ["h1", "#", "heading"],
    },
    {
      id: "h2",
      label: "H2 block",
      description: "Medium section heading",
      keywords: ["h2", "##", "heading"],
    },
    {
      id: "h3",
      label: "H3 block",
      description: "Small section heading",
      keywords: ["h3", "###", "heading"],
    },
  ];

  if (pageKey === "bridge") {
    baseActions.splice(1, 0, {
      id: "chapter",
      label: getContextMenuAddLabel({ id: "chapter", label: "Page" }),
      description: "Create a nested page block",
      keywords: ["page", "chapter", "section"],
    });
    baseActions.push(
      {
        id: "api",
        label: "API block",
        description: "Insert an API bridge block",
        keywords: ["api", "http", "request"],
      },
      {
        id: "webhook",
        label: "Webhook block",
        description: "Insert a webhook bridge block",
        keywords: ["webhook", "hook"],
      },
      {
        id: "grpc",
        label: "gRPC block",
        description: "Insert a gRPC bridge block",
        keywords: ["grpc", "rpc"],
      },
    );
  }

  return baseActions.map((action) => ({
    ...action,
    sectionTitle: "Add",
  }));
}

export function getPageMeta(
  pageKey: WorkspacePageKey,
  chapterBridge: BridgeItem | null,
): PageMeta {
  if (!chapterBridge) {
    return PAGE_META[pageKey];
  }

  return {
    ...PAGE_META.bridge,
    title: chapterBridge.name || "Untitled page",
    description:
      "Capture APIs, webhooks, sections, and notes in one shared document editor.",
  };
}

