import type { Metadata } from "next";
import Link from "next/link";
import { GitHubRepoFlow } from "./github-repo-flow";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Connect a GitHub repository and authorize access.",
};

export default function OnboardingPage() {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
      <div className="border-b border-border px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Onboarding
            </p>
            <h1 className="mt-2.5 max-w-4xl text-[clamp(1.55rem,2.2vw,2.35rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
              Connect your GitHub repository.
            </h1>
            <p className="mt-3 max-w-2xl text-[0.92rem] leading-[1.5] text-muted-foreground">
              Add your repository and authorize read/write access so we can start making
              changes in your codebase.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex w-fit items-center justify-center rounded-full border border-border bg-muted/50 px-4 py-2 text-[0.82rem] font-medium text-foreground transition hover:bg-muted"
          >
            Back to home
          </Link>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <GitHubRepoFlow />
      </div>
    </div>
  );
}
