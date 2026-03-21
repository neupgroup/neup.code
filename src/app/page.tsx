import Link from "next/link";

const statusCards = [
  { label: "Servers Online", value: "3", helper: "2 production, 1 staging" },
  { label: "CPU Avg", value: "28%", helper: "Past 30 minutes" },
  { label: "Memory Avg", value: "61%", helper: "Across selected servers" },
  { label: "Deployments", value: "14", helper: "This week" },
];

const activity = [
  { title: "api-gateway deployed", meta: "2 minutes ago", state: "success" },
  { title: "postgres backup completed", meta: "19 minutes ago", state: "success" },
  { title: "nginx config changed", meta: "44 minutes ago", state: "info" },
  { title: "new domain added", meta: "1 hour ago", state: "info" },
];

export default function Home() {
  return (
    <div className="space-y-7">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Home</p>
        <h1 className="mt-2 text-[clamp(1.65rem,2.6vw,2.45rem)] font-semibold leading-[1.08] tracking-[-0.02em]">
          Infrastructure overview for your workspace
        </h1>
        <p className="mt-3 max-w-3xl text-[0.95rem] leading-[1.45] text-muted-foreground">
          This shell follows a clean dashboard layout pattern and can be used for
          servers, applications, network, and deployment workflows.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90"
          >
            Open onboarding
          </Link>
          <Link
            href="#"
            className="rounded-full border border-border bg-card px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] transition hover:bg-muted"
          >
            View deployments
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <article
            key={card.label}
            className="min-h-[122px] rounded-[1.1rem] border border-border bg-card px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          >
            <p className="text-[0.9rem] font-medium tracking-[0]">{card.label}</p>
            <p className="mt-2 text-[clamp(1.45rem,1.9vw,2.05rem)] font-semibold leading-none tracking-[-0.015em]">
              {card.value}
            </p>
            <p className="mt-2 text-[0.82rem] font-medium text-muted-foreground">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
        <article className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.18rem] font-semibold leading-[1.2] tracking-[-0.01em]">
              Recent activity
            </h2>
            <button
              type="button"
              className="rounded-full border border-border px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          <ul className="mt-4 space-y-2.5">
            {activity.map((item) => (
              <li
                key={item.title}
                className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/35 px-3.5 py-3"
              >
                <div>
                  <p className="text-[0.88rem] font-semibold">{item.title}</p>
                  <p className="text-[0.76rem] text-muted-foreground">{item.meta}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${
                    item.state === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {item.state}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="border-t border-border pt-4">
          <h2 className="text-[1.18rem] font-semibold leading-[1.2] tracking-[-0.01em]">
            Quick links
          </h2>
          <p className="mt-2 text-[0.86rem] text-muted-foreground">
            Jump to common actions during setup and daily operations.
          </p>

          <div className="mt-4 grid gap-2">
            {[
              "Add a server",
              "Configure domains",
              "Run commands",
              "Check firewall",
              "Open system settings",
            ].map((label) => (
              <Link
                href="#"
                key={label}
                className="rounded-lg border border-border bg-muted/35 px-3.5 py-2.5 text-[0.84rem] font-medium transition hover:bg-muted"
              >
                {label}
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
