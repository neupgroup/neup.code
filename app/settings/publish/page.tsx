import type { Metadata } from "next";
import { PublishExport } from "./publish-export";

export const metadata: Metadata = {
  title: "Publish",
  description: "Export saved workspace data and docs as Markdown.",
};

export default function PublishPage() {
  return <PublishExport />;
}
