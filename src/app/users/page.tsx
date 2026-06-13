'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, Account } from '@/context/AuthContext';
import { 
  Shield, 
  Mail, 
  User as UserIcon, 
  Lock, 
  ShieldCheck, 
  ShieldAlert, 
  ArrowLeft, 
  Plus, 
  X, 
  Edit3, 
  Trash2, 
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

export default function UserManagementPage() {
  const router = useRouter();
  const { 
    user, 
    isAuthenticated, 
    loading: authLoading, 
    accounts, 
    createAccount, 
    updateAccount, 
    deleteAccount 
  } = useAuth();

  // State controls for form
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingEmail, setEditingEmail] = useState('');

  // Form input states
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState<'super_admin' | 'admin'>('admin');

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Deletion overlay state
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string | null>(null);

  // Route protection redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <span className="inline-block animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-3"></span>
        <span className="text-sm text-muted-foreground font-semibold">Checking authorization...</span>
      </div>
    );
  }

  // Access denied fallback screen
  if (!isAuthenticated || user?.role !== 'super_admin') {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 animate-fade-in">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-billiard-red/10 border border-billiard-red/20 text-billiard-red shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Access Denied</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This dashboard is restricted to Super Administrators. You do not have permission to manage users.
          </p>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border flex flex-col gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-full inline-flex items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all cursor-pointer font-extrabold"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setUsernameInput('');
    setEmailInput('');
    setPasswordInput('');
    setRoleInput('admin');
    setEditMode(false);
    setEditingEmail('');
    setErrorMsg('');
  };

  const handleEditClick = (acc: Account) => {
    setUsernameInput(acc.username);
    setEmailInput(acc.email);
    setPasswordInput('');
    setRoleInput(acc.role);
    setEditMode(true);
    setEditingEmail(acc.email);
    setShowForm(true);
    setErrorMsg('');
    
    // Smooth scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!usernameInput.trim()) {
      setErrorMsg('Username is required');
      return;
    }
    if (!emailInput.trim()) {
      setErrorMsg('Email address is required');
      return;
    }

    if (!editMode && !passwordInput) {
      setErrorMsg('Password is required for new accounts');
      return;
    }

    if (passwordInput && passwordInput.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      return;
    }

    setSubmitting(true);
    try {
      if (editMode) {
        await updateAccount(
          editingEmail,
          usernameInput.trim(),
          emailInput.trim(),
          roleInput,
          passwordInput || undefined
        );
        setSuccessMsg(`User "${usernameInput}" updated successfully!`);
      } else {
        await createAccount(
          usernameInput.trim(),
          emailInput.trim(),
          roleInput,
          passwordInput
        );
        setSuccessMsg(`User "${usernameInput}" created successfully!`);
      }

      resetForm();
      setShowForm(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit user settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmEmail) return;
    
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await deleteAccount(deleteConfirmEmail);
      setSuccessMsg('Account deleted successfully');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete account.');
    } finally {
      setDeleteConfirmEmail(null);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in py-8 px-4">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header and Add Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            User <span className="text-primary">Management</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage administrator accounts, roles, access privileges, and credentials.
          </p>
        </div>

        <div>
          {!showForm ? (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all duration-200 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              Create Admin
            </button>
          ) : (
            <button
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-background border border-border px-4 py-2.5 text-sm font-semibold text-white hover:bg-card hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
              Close Form
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Form Card */}
      {showForm && (
        <div className="glass-panel rounded-2xl p-6 border border-border/50 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h2 className="text-lg font-bold text-white">
              {editMode ? `Edit Administrator Details` : 'Register New Administrator'}
            </h2>
            <button 
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Username Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Username (Display Name)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    placeholder="e.g. Rack Admin"
                    className="w-full rounded-lg bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                    required
                  />
                </div>
              </div>

              {/* Email Address Input */}
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
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="e.g. admin@rackmaster.com"
                    className="w-full rounded-lg bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Password Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Password {editMode && <span className="text-muted-foreground font-normal lowercase">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder={editMode ? "••••••••" : "At least 6 characters"}
                    className="w-full rounded-lg bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                    required={!editMode}
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Privilege Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer select-none transition-all duration-200 ${
                    roleInput === 'admin' 
                      ? 'border-primary/50 bg-primary/5 text-white' 
                      : 'border-border bg-background hover:bg-card text-muted-foreground'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={roleInput === 'admin'}
                      onChange={() => setRoleInput('admin')}
                      className="sr-only"
                      disabled={editMode && editingEmail.toLowerCase() === user.email.toLowerCase()}
                    />
                    <Shield className="h-4 w-4 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Admin</p>
                      <p className="text-[9px] text-muted-foreground">Standard write access</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer select-none transition-all duration-200 ${
                    roleInput === 'super_admin' 
                      ? 'border-billiard-orange/50 bg-billiard-orange/5 text-white' 
                      : 'border-border bg-background hover:bg-card text-muted-foreground'
                  } ${editMode && editingEmail.toLowerCase() === user.email.toLowerCase() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="super_admin"
                      checked={roleInput === 'super_admin'}
                      onChange={() => setRoleInput('super_admin')}
                      className="sr-only"
                      disabled={editMode && editingEmail.toLowerCase() === user.email.toLowerCase()}
                    />
                    <Shield className="h-4 w-4 text-billiard-orange shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Super Admin</p>
                      <p className="text-[9px] text-muted-foreground">Full settings control</p>
                    </div>
                  </label>
                </div>
                {editMode && editingEmail.toLowerCase() === user.email.toLowerCase() && (
                  <p className="text-[9px] text-billiard-orange font-semibold mt-1">
                    You cannot change your own role to prevent locking yourself out of Super Admin.
                  </p>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-billiard-red/10 border border-billiard-red/20 p-3 flex gap-2 text-xs text-billiard-red font-semibold">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-border/30 pt-4 mt-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-background border border-border px-4 py-2 text-xs font-semibold text-white hover:bg-card cursor-pointer"
              >
                Reset Fields
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-background hover:bg-primary-hover shadow-md hover:shadow-primary/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Processing...' : editMode ? 'Save Details' : 'Register Administrator'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Alerts */}
      {successMsg && (
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 flex gap-2.5 text-sm text-primary font-semibold animate-fade-in">
          <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* User Accounts List Table */}
      <div className="glass-panel rounded-2xl border border-border/50 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 bg-card/30 flex justify-between items-center">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-primary" />
            Registered Administrators
          </h2>
          <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 font-semibold px-2.5 py-0.5 rounded-full">
            {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-border/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-card/10">
                <th scope="col" className="px-6 py-3.5">User Details</th>
                <th scope="col" className="px-6 py-3.5">Email Address</th>
                <th scope="col" className="px-6 py-3.5">Access Role</th>
                <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {accounts.map(acc => {
                const isSelf = acc.email.toLowerCase() === user.email.toLowerCase();
                return (
                  <tr key={acc.email} className={`hover:bg-card/20 transition-colors ${isSelf ? 'bg-primary/5' : ''}`}>
                    {/* User profile avatar / name */}
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                          acc.role === 'super_admin' 
                            ? 'bg-billiard-orange/10 text-billiard-orange border-billiard-orange/20 shadow-[0_0_10px_rgba(249,115,22,0.15)]' 
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {getInitials(acc.username)}
                        </div>
                        <div>
                          <div className="font-extrabold text-white flex items-center gap-1.5">
                            {acc.username}
                            {isSelf && (
                              <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-primary/20">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email address */}
                    <td className="px-6 py-4 text-xs font-semibold text-slate-400">
                      {acc.email}
                    </td>

                    {/* Access Role Badge */}
                    <td className="px-6 py-4">
                      {acc.role === 'super_admin' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-billiard-orange/10 text-billiard-orange border border-billiard-orange/30 px-2.5 py-0.5 rounded-full font-bold shadow-[0_0_8px_rgba(249,115,22,0.1)]">
                          <Shield className="h-3 w-3" />
                          Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                    </td>

                    {/* Actions buttons */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3.5">
                        <button
                          onClick={() => handleEditClick(acc)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        
                        <button
                          onClick={() => setDeleteConfirmEmail(acc.email)}
                          disabled={isSelf}
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            isSelf 
                              ? 'text-slate-600 cursor-not-allowed opacity-50' 
                              : 'text-billiard-red hover:text-billiard-red/80 transition-colors cursor-pointer'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Overlay Modal */}
      {deleteConfirmEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-border/80 shadow-2xl space-y-6 text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-billiard-red/10 border border-billiard-red/30 text-billiard-red shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">Delete Administrator Account</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you absolutely sure you want to delete the administrator account <span className="text-white font-semibold">{deleteConfirmEmail}</span>?
                This action is permanent, and they will immediately lose all access rights.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmEmail(null)}
                className="flex-1 rounded-lg bg-background border border-border py-2.5 text-xs font-semibold text-white hover:bg-card cursor-pointer"
              >
                No, Keep Account
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-lg bg-billiard-red py-2.5 text-xs font-bold text-white hover:bg-billiard-red/90 shadow-lg hover:shadow-billiard-red/20 transition-all cursor-pointer"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
