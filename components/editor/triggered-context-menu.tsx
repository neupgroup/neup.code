import { forwardRef } from "react";
import type { MouseEvent, MutableRefObject } from "react";
import {
  ContextMenuInterface,
  type ContextMenuItem,
} from "./context-menu-interface";

export type ContextMenuTriggerKind = "slash" | "right-click" | "selection";

type TriggeredContextMenuProps = {
  trigger: ContextMenuTriggerKind;
  items: ContextMenuItem[];
  activeItemId?: string | null;
  itemRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  className?: string;
  maxVisibleItems?: number;
  position?: { left: number; top: number } | null;
  onDismiss?: () => void;
  onSelectItem?: (item: ContextMenuItem, event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

export const TriggeredContextMenu = forwardRef<HTMLDivElement, TriggeredContextMenuProps>(
  function TriggeredContextMenu({
    trigger,
    items,
    activeItemId = null,
    itemRefs,
    className = "",
    maxVisibleItems = 4,
    position,
    onDismiss,
    onSelectItem,
  }, ref) {
    const triggerClassName = trigger === "slash" ? "absolute z-40" : "fixed z-50";

    return (
      <div
        ref={ref}
        className={`${triggerClassName} ${className}`.trim()}
        style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <ContextMenuInterface
          items={items}
          activeItemId={activeItemId}
          itemRefs={itemRefs}
          maxVisibleItems={maxVisibleItems}
          onDismiss={trigger === "selection" ? undefined : onDismiss}
          onSelectItem={onSelectItem}
        />
      </div>
    );
  },
);
