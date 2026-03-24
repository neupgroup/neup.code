import type { MutableRefObject, ReactNode } from "react";
import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";

type BlockRowShellProps = {
  anchorId: string;
  block: WorkspacePageBlock;
  children: ReactNode;
  isDragged: boolean;
  isSelected: boolean;
  setItemRef: (blockId: string, element: HTMLDivElement | null) => void;
  suppressClickRef: MutableRefObject<boolean>;
  translationY: number;
  onModifierSelect: (blockId: string) => void;
  onBeforeModifierSelect?: () => void;
};

export function BlockRowShell({
  anchorId,
  block,
  children,
  isDragged,
  isSelected,
  setItemRef,
  suppressClickRef,
  translationY,
  onModifierSelect,
  onBeforeModifierSelect,
}: BlockRowShellProps) {
  return (
    <div
      id={anchorId}
      ref={(element) => {
        setItemRef(block.id, element);
      }}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (!isModifierSelection(event)) return;

        event.preventDefault();
        event.stopPropagation();
        onBeforeModifierSelect?.();
        onModifierSelect(block.id);
      }}
      className={`group relative scroll-mt-24 transition-[transform,box-shadow,opacity] duration-200 ease-out ${
        isDragged ? "z-30 cursor-grabbing" : isSelected ? "z-10" : "z-0"
      }`}
      style={{
        transform: `translateY(${translationY}px) scale(${isDragged ? 1.015 : 1})`,
      }}
    >
      {children}
    </div>
  );
}

function isModifierSelection(event: { ctrlKey: boolean; metaKey: boolean }) {
  return event.ctrlKey || event.metaKey;
}

type BlockSurfaceProps = {
  children: ReactNode;
  className?: string;
  isDragged: boolean;
  isSelected: boolean;
};

export function BlockSurface({
  children,
  className = "",
  isDragged,
  isSelected,
}: BlockSurfaceProps) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 transition-[box-shadow,border-color,background-color] hover:border-foreground/15 hover:bg-muted/25 ${
        isDragged
          ? "border-foreground/20 ring-1 ring-foreground/10 shadow-[0_28px_70px_rgba(15,23,42,0.22)]"
          : isSelected
            ? "border-sky-400 ring-2 ring-sky-200"
            : "border-border"
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}
