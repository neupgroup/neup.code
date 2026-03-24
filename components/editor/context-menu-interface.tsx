import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, MutableRefObject } from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  sectionTitle?: string;
  tone?: "default" | "danger";
  interaction?: "click" | "mousedown";
};

type ContextMenuInterfaceProps = {
  items: ContextMenuItem[];
  activeItemId?: string | null;
  itemRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  className?: string;
  maxVisibleItems?: number;
  style?: CSSProperties;
  onSelectItem?: (item: ContextMenuItem, event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
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
  }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);
    const menuListMaxHeight =
      maxVisibleItems > 0
        ? maxVisibleItems * 64 + Math.max(0, maxVisibleItems - 1) * 4
        : undefined;

    useImperativeHandle(ref, () => containerRef.current, []);

    useEffect(() => {
      function updateScrollState() {
        const element = containerRef.current;
        if (!element) return;

        setCanScrollUp(element.scrollTop > 4);
        setCanScrollDown(
          element.scrollTop + element.clientHeight < element.scrollHeight - 4,
        );
      }

      updateScrollState();
      const element = containerRef.current;
      if (!element) return;

      element.addEventListener("scroll", updateScrollState);
      window.addEventListener("resize", updateScrollState);

      return () => {
        element.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }, [items.length, maxVisibleItems]);

    function scrollMenu(direction: "up" | "down") {
      const element = containerRef.current;
      if (!element) return;

      element.scrollBy({
        top: direction === "down" ? 68 : -68,
        behavior: "smooth",
      });
    }

    return (
      <div
        className={`grid gap-1 rounded-xl border border-border bg-background p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${className}`.trim()}
        style={style}
      >
        {canScrollUp ? (
          <button
            type="button"
            aria-label="Scroll menu up"
            onClick={() => scrollMenu("up")}
            className="flex h-8 items-center justify-center rounded-lg text-foreground/55 transition hover:bg-muted hover:text-foreground"
          >
            <MenuArrow direction="up" />
          </button>
        ) : null}

        <div
          ref={containerRef}
          className="grid gap-1 overflow-y-auto pr-1"
          style={{ maxHeight: menuListMaxHeight }}
        >
          {items.map((item, index) => {
            const previousSectionTitle =
              index > 0 ? items[index - 1]?.sectionTitle : undefined;
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
                      itemRefs.current[index] = element;
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
                    activeItemId === item.id ? "bg-muted" : "hover:bg-muted"
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

        {canScrollDown ? (
          <button
            type="button"
            aria-label="Scroll menu down"
            onClick={() => scrollMenu("down")}
            className="flex h-8 items-center justify-center rounded-lg text-foreground/55 transition hover:bg-muted hover:text-foreground"
          >
            <MenuArrow direction="down" />
          </button>
        ) : null}
      </div>
    );
  },
);

function MenuArrow({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "up" ? <path d="M6 14l6-6 6 6" /> : <path d="M6 10l6 6 6-6" />}
    </svg>
  );
}
