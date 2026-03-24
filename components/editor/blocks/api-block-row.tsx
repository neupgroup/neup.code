import type { MouseEvent, MutableRefObject, ReactNode } from "react";
import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";
import { StaticBlockBase } from "./static-block-base";

type ApiBlockRowProps = {
  anchorId: string;
  block: WorkspacePageBlock;
  description: string;
  href?: string | null;
  isDragged: boolean;
  isSelected: boolean;
  renderBlockHandle: ReactNode;
  setItemRef: (blockId: string, element: HTMLDivElement | null) => void;
  suppressClickRef: MutableRefObject<boolean>;
  title: string;
  translationY: number;
  onActivate: () => void;
  onBeforeModifierSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onModifierSelect: (blockId: string) => void;
};

export function ApiBlockRow(props: ApiBlockRowProps) {
  return <StaticBlockBase {...props} badge="API" />;
}
