'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LogIn, LogOut, Shield } from 'lucide-react';

export default function Header() {
  const { isAuthenticated, logout, loading, user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-background shadow-[0_0_15px_rgba(16,185,129,0.5)] group-hover:scale-105 transition-transform duration-200">
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

            {/* Auth Buttons */}
            {!loading && (
              <div className="flex items-center gap-4 border-l border-border pl-6">
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 hover:opacity-90 group transition-all duration-200"
                    >
                      <span className="text-xs text-slate-300 font-bold group-hover:text-primary transition-colors">
                        {user?.username}
                      </span>
                      {user?.role === 'super_admin' ? (
                        <span className="flex items-center gap-1.5 text-[10px] bg-billiard-orange/10 text-billiard-orange border border-billiard-orange/30 px-2.5 py-0.5 rounded-full font-bold shadow-[0_0_10px_rgba(249,115,22,0.1)] animate-fade-in">
                          <Shield className="h-3 w-3" />
                          Super Admin
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[10px] bg-primary/10 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)] animate-fade-in">
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                    </Link>
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-billiard-red transition-colors duration-200 cursor-pointer animate-fade-in"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200 animate-fade-in"
                  >
                    <LogIn className="h-4 w-4" />
                    Admin Login
                  </Link>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
