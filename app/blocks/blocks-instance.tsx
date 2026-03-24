import { PageBlocksEditor } from "../page-blocks-editor";
import type { WorkspacePageKey } from "../page-blocks-storage";

type BlocksInstanceProps = {
  id?: string;
};

export function BlocksInstance({ id }: BlocksInstanceProps) {
  if (!id || id === "bridge") {
    return <PageBlocksEditor key="bridge" pageKey="bridge" />;
  }

  const pageKey = getBlocksPageKey(id);
  if (!pageKey) {
    return <PageBlocksEditor key={`page-${id}`} pageKey="bridge" chapterId={id} />;
  }

  return <PageBlocksEditor key={pageKey} pageKey={pageKey} />;
}

export function getBlocksPageKey(id?: string): WorkspacePageKey | null {
  if (id === "bridge") return "bridge";
  return null;
}
