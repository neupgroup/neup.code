import type { MouseEvent, MutableRefObject, ReactNode } from "react";
import type { WorkspacePageBlock } from "../../../app/page-blocks-storage";
import { InlineNoteBlock, type InlineNoteBlockHandle, type InlineNoteSplit, type SlashCommand } from "../inline-note-block";
import type { TextFormatState } from "../block-action-context";
import { BlockRowShell, BlockSurface } from "./row-shell";

type FocusTarget = {
  id: string;
  position: "start" | "end";
} | null;

type TextBlockRowProps = {
  anchorId: string;
  block: WorkspacePageBlock;
  commands: SlashCommand[];
  editorClassName: string;
  focusedTarget: FocusTarget;
  isDragged: boolean;
  isSelected: boolean;
  placeholder: string;
  renderBlockHandle: ReactNode;
  setItemRef: (blockId: string, element: HTMLDivElement | null) => void;
  setNoteBlockRef: (blockId: string, element: InlineNoteBlockHandle | null) => void;
  suppressClickRef: MutableRefObject<boolean>;
  translationY: number;
  onAutoFocusComplete: () => void;
  onBackspaceAtStart: () => void;
  onBeforeModifierSelect: () => void;
  onChange: (value: string) => void;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    details?: { hasSelection: boolean; hasContent: boolean; activeTextFormats: TextFormatState },
  ) => void;
  onModifierSelect: (blockId: string) => void;
  onNavigateNext: () => void;
  onNavigatePrevious: () => void;
  onSelectCommand: (commandId: string) => void;
  onSplit: (split: InlineNoteSplit) => void;
};

export function TextBlockRow({
  anchorId,
  block,
  commands,
  editorClassName,
  focusedTarget,
  isDragged,
  isSelected,
  placeholder,
  renderBlockHandle,
  setItemRef,
  setNoteBlockRef,
  suppressClickRef,
  translationY,
  onAutoFocusComplete,
  onBackspaceAtStart,
  onBeforeModifierSelect,
  onChange,
  onContextMenu,
  onModifierSelect,
  onNavigateNext,
  onNavigatePrevious,
  onSelectCommand,
  onSplit,
}: TextBlockRowProps) {
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
        <BlockSurface isDragged={isDragged} isSelected={isSelected}>
          <InlineNoteBlock
            ref={(element) => {
              setNoteBlockRef(block.id, element);
            }}
            value={block.content}
            onChange={onChange}
            placeholder={placeholder}
            autoFocus={focusedTarget?.id === block.id}
            autoFocusPosition={focusedTarget?.position ?? "end"}
            onAutoFocusComplete={onAutoFocusComplete}
            onSplit={onSplit}
            onBackspaceAtStart={onBackspaceAtStart}
            onNavigatePrevious={onNavigatePrevious}
            onNavigateNext={onNavigateNext}
            editorClassName={editorClassName}
            commands={commands}
            onSelectCommand={onSelectCommand}
            maxVisibleCommands={4}
            onContextMenu={(event, details) => onContextMenu(event, details)}
          />
        </BlockSurface>
      </div>
    </BlockRowShell>
  );
}
