import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RackMaster - Pool Tournament Organizer",
  description: "A professional tourney manager for 8-ball, 9-ball, and 10-ball with automated handicap calculations and hybrid double-elimination formats.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary selection:text-background antialiased">
        {/* Premium Header */}
        <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <Link href="/" className="flex items-center gap-2 group">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-background shadow-[0_0_15px_rgba(16,185,129,0.5)] group-hover:scale-105 transition-transform duration-200">
                    {/* Billiard Ball Icon */}
                    <span className="text-sm font-extrabold tracking-tighter">8</span>
                  </span>
                  <span className="text-xl font-bold tracking-tight text-white group-hover:text-primary transition-colors duration-200">
                    Rack<span className="text-primary">Master</span>
                  </span>
                </Link>
              </div>

              {/* Navigation Links */}
              <nav className="flex items-center gap-6">
                <Link
                  href="/"
                  className="text-sm font-medium text-muted-foreground hover:text-white transition-colors duration-200"
                >
                  Dashboard
                </Link>
                <Link
                  href="/players"
                  className="text-sm font-medium text-muted-foreground hover:text-white transition-colors duration-200"
                >
                  Players
                </Link>
                <Link
                  href="/earnings"
                  className="text-sm font-medium text-muted-foreground hover:text-white transition-colors duration-200"
                >
                  Earnings
                </Link>
                <Link
                  href="/tournaments/create"
                  className="inline-flex items-center justify-center rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-background transition-all duration-200 shadow-sm border border-primary/20 hover:border-transparent hover:shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                >
                  New Tournament
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60 bg-background/50 py-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} RackMaster Organizer. Powered by Antigravity AI.</p>
        </footer>
      </body>
    </html>
  );
}
