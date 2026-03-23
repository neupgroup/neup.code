import type { Metadata } from "next";
import { NewBridgeForm } from "../new/new-bridge-form";

export const metadata: Metadata = {
  title: "Add Bridge",
  description: "Create a new bridge, chapter, or note",
};

type AddBridgePageProps = {
  searchParams: Promise<{ chapter?: string }>;
};

export default async function AddBridgePage({ searchParams }: AddBridgePageProps) {
  const { chapter } = await searchParams;
  return <NewBridgeForm chapterQuery={chapter ?? null} />;
}
