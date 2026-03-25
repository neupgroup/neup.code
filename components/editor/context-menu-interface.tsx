import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CSSProperties, MouseEvent, MutableRefObject } from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  compactLabel?: string;
  description?: string;
  disabled?: boolean;
  active?: boolean;
  sectionTitle?: string;
  tone?: "default" | "danger";
  interaction?: "click" | "mousedown";
  menuLayout?: "list" | "grid";
};

type ContextMenuInterfaceProps = {
  items: ContextMenuItem[];
  activeItemId?: string | null;
  itemRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  className?: string;
  maxVisibleItems?: number;
  style?: CSSProperties;
  onSelectItem?: (item: ContextMenuItem, event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  onDismiss?: () => void;
};

export const ContextMenuInterface = forwardRef<HTMLDivElement, ContextMenuInterfaceProps>(
  function ContextMenuInterface({
    items,
    activeItemId = null,
    itemRefs,
    className = "",
    maxVisibleItems = 4,
    style,
    onSelectItem,
    onDismiss,
  }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const toolbarItems = items.filter((item) => item.menuLayout === "grid");
    const listItems = items.filter((item) => item.menuLayout !== "grid");
    const menuListMaxHeight =
      maxVisibleItems > 0
        ? maxVisibleItems * 64 + Math.max(0, maxVisibleItems - 1) * 4
        : undefined;

    useImperativeHandle(ref, () => rootRef.current, []);

    useEffect(() => {
      if (!onDismiss) return;

      function handlePointerDown(event: PointerEvent) {
        const element = rootRef.current;
        const target = event.target;
        if (!element || !(target instanceof Node) || element.contains(target)) return;
        onDismiss();
      }

      function handleFocusIn(event: FocusEvent) {
        const element = rootRef.current;
        const target = event.target;
        if (!element || !(target instanceof Node) || element.contains(target)) return;
        onDismiss();
      }

      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("focusin", handleFocusIn);

      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
        document.removeEventListener("focusin", handleFocusIn);
      };
    }, [onDismiss]);

    return (
      <div
        ref={rootRef}
        className={`grid gap-1 rounded-xl border border-border bg-background p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${className}`.trim()}
        style={style}
      >
        {toolbarItems.length ? (
          <div className="grid gap-1 border-b border-border/80 pb-2">
            <div className="grid grid-cols-4 gap-1">
              {toolbarItems.map((item, index) => (
                <button
                  key={item.id}
                  ref={(element) => {
                    if (itemRefs) {
                      itemRefs.current[index] = element;
                    }
                  }}
                  type="button"
                  disabled={item.disabled}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    void onSelectItem?.(item, event);
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                  className={`flex h-11 items-center justify-center rounded-lg border text-[1rem] transition ${
                    item.active || activeItemId === item.id
                      ? "border-foreground/20 bg-muted"
                      : "border-transparent hover:border-foreground/10 hover:bg-muted"
                  } ${
                    item.tone === "danger"
                      ? "text-rose-600 hover:bg-rose-50"
                      : "text-foreground"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  title={item.label}
                >
                  <span className={gridItemLabelClassName(item.id)}>
                    {item.compactLabel ?? item.label.slice(0, 1)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className="grid gap-1 overflow-y-auto overscroll-contain pr-1"
          style={{ maxHeight: menuListMaxHeight }}
        >
          {listItems.map((item, index) => {
            const previousSectionTitle =
              index > 0 ? listItems[index - 1]?.sectionTitle : undefined;
            const showSectionTitle =
              item.sectionTitle && item.sectionTitle !== previousSectionTitle;

            return (
              <div key={item.id} className="grid gap-1">
                {showSectionTitle ? (
                  <div className="px-3 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {item.sectionTitle}
                  </div>
                ) : null}
                <button
                  ref={(element) => {
                    if (itemRefs) {
                      itemRefs.current[toolbarItems.length + index] = element;
                    }
                  }}
                  type="button"
                  disabled={item.disabled}
                  onMouseDown={(event) => {
                    if (item.interaction !== "mousedown") return;
                    event.preventDefault();
                    void onSelectItem?.(item, event);
                  }}
                  onClick={(event) => {
                    if (item.interaction === "mousedown") return;
                    void onSelectItem?.(item, event);
                  }}
                  className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-[0.84rem] transition ${
                    item.active || activeItemId === item.id ? "bg-muted" : "hover:bg-muted"
                  } ${
                    item.tone === "danger"
                      ? "text-rose-600 hover:bg-rose-50"
                      : "text-foreground"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="mt-0.5 text-[0.76rem] text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

function gridItemLabelClassName(itemId: string) {
  if (itemId === "bold") return "text-[1.15rem] font-semibold";
  if (itemId === "italic") return "text-[1.15rem] italic";
  if (itemId === "underline") return "text-[1.15rem] underline underline-offset-4";
  return "text-[1rem] font-medium";
}
