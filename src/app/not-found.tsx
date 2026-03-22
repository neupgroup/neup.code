import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col h-full items-center justify-center text-center p-6 mt-16 sm:mt-32">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-6 border border-border/50 shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-muted-foreground/60">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" strokeDasharray="2 2" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      </div>
      <h2 className="text-[1.8rem] font-bold tracking-tight text-foreground">Page Not Found</h2>
      <p className="mt-3 mb-8 text-[0.95rem] text-muted-foreground max-w-sm">
        We couldn't find the page you were looking for. The link may be broken, or the page may have been deleted.
      </p>
      <Link 
        href="/home" 
        className="inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-6 text-[0.9rem] font-semibold text-background transition-colors hover:bg-foreground/90 shadow-sm"
      >
        Return to Home
      </Link>
    </div>
  );
}
