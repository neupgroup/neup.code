"use client";

type ChipOption = {
  label: string;
  value: string;
};

type BaseChipGroupProps = {
  label?: string;
  options: ChipOption[];
  className?: string;
};

type SelectionChipGroupProps = BaseChipGroupProps & {
  value: string;
  onChange: (value: string) => void;
};

type MultiSelectionChipGroupProps = BaseChipGroupProps & {
  values: string[];
  onChange: (values: string[]) => void;
};

function chipClassName(selected: boolean) {
  return [
    "inline-flex rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold transition",
    selected
      ? "border-border bg-muted text-muted-foreground"
      : "border-border bg-background text-foreground hover:bg-muted",
  ].join(" ");
}

export function SelectionChipGroup({
  label,
  options,
  value,
  onChange,
  className = "",
}: SelectionChipGroupProps) {
  return (
    <div className={`grid gap-2 ${className}`.trim()}>
      {label ? (
        <p className="text-[0.78rem] font-semibold text-muted-foreground">
          {label}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={chipClassName(value === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MultiSelectionChipGroup({
  label,
  options,
  values,
  onChange,
  className = "",
}: MultiSelectionChipGroupProps) {
  function toggleValue(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }

    onChange([...values, value]);
  }

  return (
    <div className={`grid gap-2 ${className}`.trim()}>
      {label ? (
        <p className="text-[0.78rem] font-semibold text-muted-foreground">
          {label}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleValue(option.value)}
              className={chipClassName(selected)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
