'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Shield, Mail, User, Lock, ShieldCheck, ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, updateProfile } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load active user details into input state
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
    }
  }, [user]);

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }

    if (password) {
      if (password.length < 6) {
        setError('New password must be at least 6 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setSubmitting(true);
    try {
      await updateProfile(
        username.trim(),
        email.trim(),
        password || undefined
      );
      setSuccess('Profile details saved successfully!');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update profile details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
        <span className="text-sm text-muted-foreground font-semibold">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in py-8 px-4">
      {/* Back to dashboard */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Profile <span className="text-primary">Settings</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your administrator username, credentials, and access configuration.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Card: Account Card */}
        <div className="md:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-border/50 text-center space-y-4">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary shadow-[0_0_15px_rgba(16,185,129,0.15)] text-xl font-bold uppercase">
              {user.username.charAt(0)}{user.username.split(' ')[1]?.charAt(0) || ''}
            </div>
            
            <div className="space-y-1">
              <h2 className="font-extrabold text-white text-base truncate">{user.username}</h2>
              <p className="text-xs text-muted-foreground truncate font-medium">{user.email}</p>
            </div>

            <div className="pt-2">
              {user.role === 'super_admin' ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] bg-billiard-orange/10 text-billiard-orange border border-billiard-orange/30 px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                  <Shield className="h-3 w-3" />
                  Super Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                  <Shield className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Form: Editable Settings */}
        <div className="md:col-span-2">
          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username field */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Username (Display Name)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. Rack Master"
                    className="w-full rounded-lg bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                    required
                  />
                </div>
              </div>

              {/* Email address field */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email Address
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

              <div className="border-t border-border/30 pt-4 mt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                  Change Password (Optional)
                </p>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      New Password
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
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-billiard-red/10 border border-billiard-red/20 p-3 flex gap-2 text-xs text-billiard-red font-semibold animate-pulse">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex gap-2 text-xs text-primary font-semibold">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? 'Saving changes...' : 'Save Profile Details'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
