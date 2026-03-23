export default function TrashPage() {
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
      <p className="mt-2 text-muted-foreground">Manage your deleted pages and workspaces.</p>
      
      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-20">
        <svg viewBox="0 0 24 24" className="mb-4 h-10 w-10 text-muted-foreground/30" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        <p className="text-sm font-medium text-foreground/75">Trash is empty</p>
      </div>
    </div>
  );
}
