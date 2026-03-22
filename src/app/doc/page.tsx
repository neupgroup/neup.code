import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageBlocksEditor } from "../page-blocks-editor";
import type { WorkspacePageKey } from "../page-blocks-storage";

export const metadata: Metadata = {
  title: "Doc",
  description: "Documentation workspace",
};

type DocPageProps = {
  searchParams: Promise<{ type?: string; id?: string; block?: string }>;
};

export default async function DocPage({ searchParams }: DocPageProps) {
  const { type, block } = await searchParams;
  const pageKey = getDocPageKey(type, block);

  if (!pageKey) {
    redirect("/doc?type=bridge");
  }

  return <PageBlocksEditor key={pageKey} pageKey={pageKey} />;
}

function getDocPageKey(type?: string, block?: string): WorkspacePageKey | null {
  if (block === "chapter") return "bridge";
  if (type === "bridge") return "bridge";
  if (type === "design") return "design";
  if (type === "component") return "components";
  return null;
}
