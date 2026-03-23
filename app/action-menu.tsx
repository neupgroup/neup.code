import { forwardRef } from "react";
import type { CSSProperties, MouseEvent, MutableRefObject } from "react";

export type ActionMenuItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  sectionTitle?: string;
  tone?: "default" | "danger";
  interaction?: "click" | "mousedown";
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  activeItemId?: string | null;
  itemRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  className?: string;
  style?: CSSProperties;
  onSelectItem?: (item: ActionMenuItem, event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

export const ActionMenu = forwardRef<HTMLDivElement, ActionMenuProps>(function ActionMenu({
  items,
  activeItemId = null,
  itemRefs,
  className = "",
  style,
  onSelectItem,
}, ref) {
  return (
    <div
      ref={ref}
      className={`grid gap-1 rounded-xl border border-border bg-background p-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)] ${className}`.trim()}
      style={style}
    >
      {items.map((item, index) => {
        const previousSectionTitle = index > 0 ? items[index - 1]?.sectionTitle : undefined;
        const showSectionTitle = item.sectionTitle && item.sectionTitle !== previousSectionTitle;

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
                item.tone === "danger" ? "text-rose-600 hover:bg-rose-50" : "text-foreground"
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
  );
});
