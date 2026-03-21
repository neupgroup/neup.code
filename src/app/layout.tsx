import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Neup.Code",
    template: "%s | Neup.Code",
  },
  description: "Dashboard-style workspace shell for onboarding and infra workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${dmSans.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground">
        <div className="min-h-screen">
          <header className="sticky top-0 z-40 bg-background shadow-[0_8px_22px_rgba(15,23,42,0.12)]">
            <div className="content-container flex h-[68px] items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-[0.7rem] font-semibold">
                  N
                </span>
                <span className="text-[1.2rem] font-semibold tracking-[-0.01em]">Neup.Code</span>
              </Link>

              <div className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-[10px] font-semibold">
                NK
              </div>
            </div>
          </header>

          <div className="content-container">
            <div className="grid min-w-[980px] grid-cols-[242px_minmax(0,1fr)]">
              <aside className="sticky top-[68px] h-[calc(100vh-68px)] self-start overflow-y-auto border-r border-border bg-background px-4 py-6">
                <SidebarNav />
              </aside>

              <main className="bg-background px-6 py-7 lg:px-9 lg:py-8">
                {children}
              </main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}