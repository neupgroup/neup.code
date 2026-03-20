export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-20">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">neup.code</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Tailwind is now active in this Next.js app
        </h1>
        <p className="max-w-2xl text-slate-300">
          This project now uses the official Next.js Tailwind setup. You can build all
          your upcoming interfaces using utility classes in app router pages.
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm text-amber-200">
            Next.js 16
          </span>
          <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-200">
            Tailwind
          </span>
          <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-200">
            App Router
          </span>
        </div>
      </section>
    </main>
  );
}
