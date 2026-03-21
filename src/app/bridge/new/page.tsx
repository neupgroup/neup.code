import type { Metadata } from "next";
import { NewBridgeForm } from "./new-bridge-form";

export const metadata: Metadata = {
  title: "New Bridge",
  description: "Create a new bridge",
};

export default function NewBridgePage() {
  return <NewBridgeForm />;
}
