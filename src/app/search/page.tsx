export default function SearchPage() {
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-bold tracking-tight">Search</h1>
      <p className="mt-2 text-muted-foreground">Find pages, templates, and content across your workspaces.</p>
      
      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-20">
        <svg viewBox="0 0 24 24" className="mb-4 h-10 w-10 text-muted-foreground/30" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <p className="text-sm font-medium text-foreground/75">Search coming soon</p>
      </div>
    </div>
  );
}
