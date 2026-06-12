'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const success = await login(email, password);
      if (success) {
        router.push('/');
      } else {
        setError('Invalid admin credentials. Please try again.');
        setSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
        <span className="text-sm text-muted-foreground font-semibold">Loading admin console...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            Admin <span className="text-primary">Console</span>
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Sign in to create tournaments, score matches, and log payments.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="rounded-lg bg-billiard-blue/10 border border-billiard-blue/20 p-3 flex flex-col gap-2 text-xs text-muted-foreground leading-relaxed">
            <div className="flex gap-2.5">
              <ShieldCheck className="h-4 w-4 text-billiard-blue shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white mb-1.5">Predefined Admin Credentials:</p>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-white/80 font-bold text-[10px] uppercase tracking-wider mb-0.5">Super Admin:</p>
                    <p>Username: <span className="text-white font-bold">Super Admin</span></p>
                    <p>Email: <span className="text-white font-mono">superadmin@rackmaster.com</span></p>
                    <p>Password: <span className="text-white font-mono">superadmin123</span></p>
                  </div>
                  
                  <div className="border-t border-border/30 pt-1.5">
                    <p className="text-white/80 font-bold text-[10px] uppercase tracking-wider mb-0.5">Admin:</p>
                    <p>Username: <span className="text-white font-bold">Rack Admin</span></p>
                    <p>Email: <span className="text-white font-mono">admin@rackmaster.com</span></p>
                    <p>Password: <span className="text-white font-mono">admin123</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@rackmaster.com"
                  className="w-full rounded-lg bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-billiard-red/10 border border-billiard-red/20 p-3 flex gap-2 text-xs text-billiard-red font-semibold animate-pulse">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
