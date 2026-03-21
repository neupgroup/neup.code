import type { Metadata } from "next";
import { RulesList } from "./rules-list";

export const metadata: Metadata = {
  title: "Rules",
  description: "Create and manage reusable codebase rules.",
};

export default function RulesPage() {
  return <RulesList />;
}
