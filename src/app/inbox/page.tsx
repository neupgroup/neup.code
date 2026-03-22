export default function InboxPage() {
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
      <p className="mt-2 text-muted-foreground">View your notifications, recent updates, and tasks.</p>
      
      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-20">
        <svg viewBox="0 0 24 24" className="mb-4 h-10 w-10 text-muted-foreground/30" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
        <p className="text-sm font-medium text-foreground/75">You're all caught up!</p>
      </div>
    </div>
  );
}
