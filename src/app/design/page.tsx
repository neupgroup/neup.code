import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design",
  description: "Design section",
};

export default function DesignPage() {
  return (
    <section className="rounded-[1.1rem] border border-border bg-card p-6">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Design
      </p>
      <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">Design</h1>
      <p className="mt-2 text-[0.9rem] text-muted-foreground">
        This route is ready for design resources, tokens, and references.
      </p>
    </section>
  );
}
