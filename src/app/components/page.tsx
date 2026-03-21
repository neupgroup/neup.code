import type { Metadata } from "next";
import { ComponentsList } from "./components-list";

export const metadata: Metadata = {
  title: "Components",
  description: "Components section",
};

export default function ComponentsPage() {
  return <ComponentsList />;
}
