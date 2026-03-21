import type { Metadata } from "next";
import { BridgeList } from "./bridge-list";

export const metadata: Metadata = {
  title: "Bridge",
  description: "Bridge page",
};

export default function BridgePage() {
  return <BridgeList />;
}
