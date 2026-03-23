import type { Metadata } from "next";
import { BridgeDetail } from "./bridge-detail";

export const metadata: Metadata = {
  title: "Bridge Detail",
  description: "Bridge detail page",
};

type BridgeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BridgeDetailPage({ params }: BridgeDetailPageProps) {
  const { id } = await params;
  return <BridgeDetail id={id} />;
}

