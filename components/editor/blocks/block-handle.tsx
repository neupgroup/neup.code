type BlockHandleProps = {
  isDragged: boolean;
  isSelected: boolean;
  isReorderable: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
};

export function BlockHandle({
  isDragged,
  isSelected,
  isReorderable,
  onClick,
  onPointerDown,
}: BlockHandleProps) {
  return (
    <div className="flex shrink-0 items-start justify-start pt-3">
      <button
        type="button"
        aria-label="Block menu and drag handle"
        title={isReorderable ? "Block menu and drag handle" : "Block menu"}
        onClick={onClick}
        onPointerDown={onPointerDown}
        className={`flex size-7 items-center justify-center rounded-lg text-foreground/35 transition ${
          isDragged || isSelected
            ? "bg-muted text-foreground/70"
            : "hover:bg-muted/80 hover:text-foreground/70"
        } ${
          isReorderable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4"
          fill="currentColor"
        >
          <circle cx="5" cy="4" r="1.1" />
          <circle cx="11" cy="4" r="1.1" />
          <circle cx="5" cy="8" r="1.1" />
          <circle cx="11" cy="8" r="1.1" />
          <circle cx="5" cy="12" r="1.1" />
          <circle cx="11" cy="12" r="1.1" />
        </svg>
      </button>
    </div>
  );
}
