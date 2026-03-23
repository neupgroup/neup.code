"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type OnboardingPath = "github" | "cloud";

const OPTIONS: Record<
  OnboardingPath,
  {
    eyebrow: string;
    title: string;
    description: string;
    details: string[];
    accent: string;
    surface: string;
    buttonLabel: string;
  }
> = {
  github: {
    eyebrow: "Git-native setup",
    title: "Use GitHub",
    description:
      "Connect your repository-first workflow and move through onboarding with code already at the center.",
    details: [
      "Best when your project source lives in GitHub",
      "Ideal for teams collaborating through commits and pull requests",
      "Great fit for technical onboarding flows",
    ],
    accent: "bg-amber-400",
    surface: "bg-[linear-gradient(135deg,_rgba(255,248,234,0.95),_rgba(255,255,255,0.92))]",
    buttonLabel: "Continue with GitHub",
  },
  cloud: {
    eyebrow: "Managed workspace",
    title: "Use Cloud Version",
    description:
      "Start from a hosted experience with less setup overhead and a faster path into the product.",
    details: [
      "Best when you want a ready-to-go environment",
      "Useful for non-technical or mixed teams",
      "Good option when speed matters more than repo setup",
    ],
    accent: "bg-sky-400",
    surface: "bg-[linear-gradient(135deg,_rgba(234,248,255,0.96),_rgba(255,255,255,0.92))]",
    buttonLabel: "Continue with Cloud",
  },
};

type ChoicePanelProps = {
  initialSelection: OnboardingPath;
};

export function ChoicePanel({ initialSelection }: ChoicePanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedPath, setSelectedPath] = useState<OnboardingPath>(initialSelection);
  const selected = OPTIONS[selectedPath];

  function updateSelection(path: OnboardingPath) {
    setSelectedPath(path);
    router.replace(`${pathname}?path=${path}`, { scroll: false });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_20rem] xl:items-start">
      <div className="grid gap-4">
        {(Object.entries(OPTIONS) as [OnboardingPath, (typeof OPTIONS)[OnboardingPath]][]).map(
          ([key, option]) => {
            const isSelected = selectedPath === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => updateSelection(key)}
                aria-pressed={isSelected}
                className={`group relative overflow-hidden rounded-[1.25rem] border px-5 py-5 text-left shadow-[0_12px_26px_rgba(16,32,51,0.06)] transition duration-200 sm:px-5 sm:py-5 ${
                  isSelected
                    ? "border-slate-950/20 bg-white shadow-[0_14px_34px_rgba(16,32,51,0.09)]"
                    : "border-slate-950/10 bg-white/75 hover:border-slate-950/20 hover:bg-white"
                }`}
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 ${option.accent}`} />
                <div className={`absolute inset-0 opacity-80 ${option.surface}`} />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2.5">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {option.eyebrow}
                    </p>
                    <div className="space-y-1.5">
                      <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-slate-950 sm:text-[1.55rem]">
                        {option.title}
                      </h2>
                      <p className="max-w-2xl text-[0.88rem] leading-[1.45] text-slate-700 sm:text-[0.9rem]">
                        {option.description}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${
                      isSelected
                        ? "border-slate-950/15 bg-slate-950 text-white"
                        : "border-slate-950/10 bg-white/80 text-slate-500"
                    }`}
                  >
                    {isSelected ? "Selected" : "Choose"}
                  </span>
                </div>

                <div className="relative mt-4 flex flex-wrap gap-2">
                  {option.details.map((detail) => (
                    <span
                      key={detail}
                      className="rounded-full border border-slate-950/10 bg-white/90 px-3 py-1.5 text-[0.74rem] leading-[1.3] text-slate-700"
                    >
                      {detail}
                    </span>
                  ))}
                </div>
              </button>
            );
          },
        )}
      </div>

      <aside className="xl:sticky xl:top-8">
        <div className="rounded-[1.25rem] border border-slate-950/10 bg-slate-950 p-5 text-slate-100 shadow-[0_16px_36px_rgba(16,32,51,0.16)] sm:p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-amber-300/80">
            Current choice
          </p>
          <h3 className="mt-2.5 text-[1.45rem] font-semibold tracking-[-0.02em] text-white sm:text-[1.6rem]">
            {selected.title}
          </h3>
          <p className="mt-2.5 text-[0.86rem] leading-[1.45] text-slate-300">
            {selected.description}
          </p>

          <div className="mt-5 rounded-[1rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/55">
              Why this path
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[0.82rem] leading-[1.35] text-slate-200">
              {selected.details.map((detail) => (
                <li key={detail} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[0.88rem] font-medium text-white">{selected.buttonLabel}</p>
            <p className="mt-2 text-[0.82rem] leading-[1.4] text-slate-400">
              The selected path is reflected in the URL so it survives refresh and can feed
              the next onboarding step.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`?path=${selectedPath}`}
                className="inline-flex rounded-full bg-white px-4 py-2 text-[0.78rem] font-medium text-slate-950 transition hover:bg-slate-100"
              >
                {selectedPath === "github" ? "GitHub selected" : "Cloud selected"}
              </Link>
              <button
                type="button"
                onClick={() => updateSelection(selectedPath === "github" ? "cloud" : "github")}
                className="inline-flex rounded-full border border-white/10 px-4 py-2 text-[0.78rem] font-medium text-white transition hover:bg-white/10"
              >
                Compare both
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
