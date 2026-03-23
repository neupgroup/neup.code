import type { Metadata } from "next";
import { SyncStatView } from "./syncstat-view";

export const metadata: Metadata = {
  title: "Sync Status",
  description: "Inspect browser-stored workspace data and compare it with the current database snapshot.",
};

export default function SyncStatPage() {
  return <SyncStatView />;
}
