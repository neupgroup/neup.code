import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Components",
  description: "Components section",
};

export default function ComponentsPage() {
  return (
    <section>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Components
      </p>
      <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">Components</h1>
      <p className="mt-2 text-[0.9rem] text-muted-foreground">
        This route is ready for component documentation and previews.
      </p>
    </section>
  );
}
