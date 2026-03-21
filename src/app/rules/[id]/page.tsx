import type { Metadata } from "next";
import { RuleDetail } from "./rule-detail";

export const metadata: Metadata = {
  title: "Rule",
  description: "View and edit a saved rule.",
};

type RuleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RuleDetailPage({ params }: RuleDetailPageProps) {
  const { id } = await params;
  return <RuleDetail id={id} />;
}
