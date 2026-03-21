import type { Metadata } from "next";
import { ComponentDetail } from "./component-detail";

export const metadata: Metadata = {
  title: "Component Detail",
  description: "Manage a saved component and its parts.",
};

type ComponentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ComponentDetailPage({ params }: ComponentDetailPageProps) {
  const { id } = await params;
  return <ComponentDetail id={id} />;
}
