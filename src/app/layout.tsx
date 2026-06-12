import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";

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
        <AuthProvider>
          {/* Client-side navigation & auth header */}
          <Header />

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-border/60 bg-background/50 py-6 text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} RackMaster Organizer. Powered by Antigravity AI.</p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
