import Link from "next/link";
import type { MouseEvent, MutableRefObject, ReactNode } from "react";
import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";
import { BlockRowShell, BlockSurface } from "./row-shell";

type StaticBlockBaseProps = {
  anchorId: string;
  badge: string;
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
  onActivate?: () => void;
  onBeforeModifierSelect: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onModifierSelect: (blockId: string) => void;
};

export function StaticBlockBase({
  anchorId,
  badge,
  block,
  description,
  href,
  isDragged,
  isSelected,
  renderBlockHandle,
  setItemRef,
  suppressClickRef,
  title,
  translationY,
  onActivate,
  onBeforeModifierSelect,
  onContextMenu,
  onModifierSelect,
}: StaticBlockBaseProps) {
  const content = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[1rem] font-semibold text-foreground">{title}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {badge}
        </span>
      </div>
      <p className="mt-1 text-[0.84rem] text-muted-foreground">{description}</p>
    </div>
  );

  return (
    <BlockRowShell
      anchorId={anchorId}
      block={block}
      isDragged={isDragged}
      isSelected={isSelected}
      setItemRef={setItemRef}
      suppressClickRef={suppressClickRef}
      translationY={translationY}
      onBeforeModifierSelect={onBeforeModifierSelect}
      onModifierSelect={onModifierSelect}
    >
      <div className="flex items-start gap-0.5">
        {renderBlockHandle}
        {href ? (
          <Link href={href} onContextMenu={onContextMenu} className="min-w-0 flex-1">
            <BlockSurface isDragged={isDragged} isSelected={isSelected}>
              {content}
            </BlockSurface>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            onContextMenu={onContextMenu}
            className="min-w-0 w-full flex-1 text-left"
          >
            <BlockSurface isDragged={isDragged} isSelected={isSelected}>
              {content}
            </BlockSurface>
          </button>
        )}
      </div>
    </BlockRowShell>
  );
}
