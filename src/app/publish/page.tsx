import type { Metadata } from "next";
import { PublishExport } from "./publish-export";

export const metadata: Metadata = {
  title: "Publish",
  description: "Export saved app data as Markdown.",
};

export default function PublishPage() {
  return <PublishExport />;
}
