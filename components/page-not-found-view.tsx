"use client";

import Link from "next/link";

type PageNotFoundViewProps = {
  href?: string;
  ctaLabel?: string;
};

export function PageNotFoundView({
  href = "/home",
  ctaLabel = "Return to Home",
}: PageNotFoundViewProps) {
  return (
    <div className="mt-16 flex h-full flex-col items-center justify-center p-6 text-center sm:mt-32">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border/50 bg-muted/50 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-10 w-10 text-muted-foreground/60"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" strokeDasharray="2 2" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      </div>
      <h2 className="text-[1.8rem] font-bold tracking-tight text-foreground">Page Not Found</h2>
      <p className="mb-8 mt-3 max-w-sm text-[0.95rem] text-muted-foreground">
        We couldn&apos;t find the page you were looking for. The link may be broken, or the page may
        have been deleted.
      </p>
      <Link
        href={href}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-6 text-[0.9rem] font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
