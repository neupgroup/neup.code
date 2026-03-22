import { PageBlocksEditor } from "../page-blocks-editor";
import type { WorkspacePageKey } from "../page-blocks-storage";

type DocInstanceProps = {
  id?: string;
};

export function DocInstance({ id }: DocInstanceProps) {
  if (!id || id === "bridge") {
    return <PageBlocksEditor key="bridge" pageKey="bridge" />;
  }

  const pageKey = getDocPageKey(id);
  if (!pageKey) {
    return <PageBlocksEditor key={`page-${id}`} pageKey="bridge" chapterId={id} />;
  }

  return <PageBlocksEditor key={pageKey} pageKey={pageKey} />;
}

export function getDocPageKey(id?: string): WorkspacePageKey | null {
  if (id === "bridge") return "bridge";
  return null;
}
