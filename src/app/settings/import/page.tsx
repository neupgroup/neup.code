import type { Metadata } from "next";
import { ImportWorkspace } from "./import-workspace";

export const metadata: Metadata = {
  title: "Import",
  description: "Import saved app data into this browser.",
};

export default function ImportPage() {
  return <ImportWorkspace />;
}
