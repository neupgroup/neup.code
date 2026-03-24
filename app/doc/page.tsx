import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageBlocksEditor } from "../../components/editor/page-blocks-editor";
import type { WorkspacePageKey } from "../page-blocks-storage";

export const metadata: Metadata = {
  title: "Doc",
  description: "Documentation workspace",
};

type DocPageProps = {
  searchParams: Promise<{ type?: string; id?: string; block?: string }>;
};

export default async function DocPage({ searchParams }: DocPageProps) {
  const { type, id, block } = await searchParams;

  if (block === "chapter" && id) {
    redirect(`/doc?id=${id}`);
  }

  if (type === "bridge") {
    return redirect("/doc");
  }

  if (id === "bridge") {
    redirect("/doc");
  }

  if (!id || id === "bridge") {
    return <PageBlocksEditor key="bridge" pageKey="bridge" />;
  }

  const pageKey = getDocPageKey(id);
  if (!pageKey) {
    return <PageBlocksEditor key={`page-${id}`} pageKey="bridge" chapterId={id} />;
  }

  return <PageBlocksEditor key={pageKey} pageKey={pageKey} />;
}

function getDocPageKey(id?: string): WorkspacePageKey | null {
  if (id === "bridge") return "bridge";
  return null;
}
