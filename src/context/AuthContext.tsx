'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  username: string;
  email: string;
  role: 'super_admin' | 'admin';
}

export interface Account {
  username: string;
  email: string;
  role: 'super_admin' | 'admin';
  password?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  updateProfile: (username: string, email: string, password?: string) => Promise<void>;
  accounts: Account[];
  createAccount: (username: string, email: string, role: 'super_admin' | 'admin', password?: string) => Promise<void>;
  updateAccount: (oldEmail: string, username: string, email: string, role: 'super_admin' | 'admin', password?: string) => Promise<void>;
  deleteAccount: (email: string) => Promise<void>;
}

const DEFAULT_ACCOUNTS = [
  { email: 'superadmin@rackmaster.com', password: 'superadmin123', username: 'Super Admin', role: 'super_admin' },
  { email: 'admin@rackmaster.com', password: 'admin123', username: 'Rack Admin', role: 'admin' }
];

const getAccounts = () => {
  if (typeof window === 'undefined') return DEFAULT_ACCOUNTS;
  const saved = localStorage.getItem('ptm_accounts');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse accounts list', e);
    }
  }
  localStorage.setItem('ptm_accounts', JSON.stringify(DEFAULT_ACCOUNTS));
  return DEFAULT_ACCOUNTS;
};

// Pure Helper Functions for User CRUD Management (highly testable)
export function createAccountHelper(
  currentAccounts: Account[],
  username: string,
  email: string,
  role: 'super_admin' | 'admin',
  password?: string
): Account[] {
  const cleanEmail = email.trim().toLowerCase();
  const exists = currentAccounts.some(
    (acc: any) => acc.email.toLowerCase() === cleanEmail
  );

  if (exists) {
    throw new Error('An account with this email address already exists');
  }

  const newAccount: Account = {
    username: username.trim(),
    email: cleanEmail,
    role,
    password: password || 'admin123'
  };

  return [...currentAccounts, newAccount];
}

export function updateAccountHelper(
  currentAccounts: Account[],
  oldEmail: string,
  username: string,
  email: string,
  role: 'super_admin' | 'admin',
  currentUserEmail: string,
  password?: string
): { updated: Account[]; updatedAccountObj: Account } {
  const cleanOldEmail = oldEmail.trim().toLowerCase();
  const cleanNewEmail = email.trim().toLowerCase();

  if (cleanOldEmail !== cleanNewEmail) {
    const exists = currentAccounts.some(
      (acc: any) => acc.email.toLowerCase() === cleanNewEmail
    );
    if (exists) {
      throw new Error('An account with this email address already exists');
    }
  }

  if (cleanOldEmail === currentUserEmail.toLowerCase() && role !== 'super_admin') {
    throw new Error('You cannot demote your own role from Super Admin');
  }

  let updatedAccountObj: any = null;

  const updated = currentAccounts.map((acc: any) => {
    if (acc.email.toLowerCase() === cleanOldEmail) {
      updatedAccountObj = {
        ...acc,
        username: username.trim(),
        email: cleanNewEmail,
        role,
        ...(password ? { password } : {})
      };
      return updatedAccountObj;
    }
    return acc;
  });

  if (!updatedAccountObj) {
    throw new Error('Account not found');
  }

  return { updated, updatedAccountObj };
}

export function deleteAccountHelper(
  currentAccounts: Account[],
  email: string,
  currentUserEmail: string
): Account[] {
  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail === currentUserEmail.toLowerCase()) {
    throw new Error('You cannot delete your own active Super Admin account');
  }

  const exists = currentAccounts.some(
    (acc: any) => acc.email.toLowerCase() === cleanEmail
  );

  if (!exists) {
    throw new Error('Account not found');
  }

  return currentAccounts.filter(
    (acc: any) => acc.email.toLowerCase() !== cleanEmail
  );
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    // Make sure accounts list is initialized in localStorage
    const currentAccounts = getAccounts();
    setAccounts(currentAccounts);
    
    const savedUser = localStorage.getItem('ptm_admin_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user', e);
        localStorage.removeItem('ptm_admin_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    const accountsList = getAccounts();
    const matched = accountsList.find(
      (acc: any) => acc.email.toLowerCase() === cleanEmail && acc.password === password
    );

    if (matched) {
      const loggedUser: User = {
        username: matched.username,
        email: matched.email,
        role: matched.role
      };
      setUser(loggedUser);
      localStorage.setItem('ptm_admin_user', JSON.stringify(loggedUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ptm_admin_user');
  };

  const updateProfile = async (username: string, email: string, password?: string): Promise<void> => {
    if (!user) throw new Error('Not logged in');

    const accountsList = getAccounts();
    const updatedAccounts = accountsList.map((acc: any) => {
      if (acc.email.toLowerCase() === user.email.toLowerCase()) {
        return {
          ...acc,
          username: username.trim(),
          email: email.trim().toLowerCase(),
          ...(password ? { password } : {})
        };
      }
      return acc;
    });

    localStorage.setItem('ptm_accounts', JSON.stringify(updatedAccounts));
    setAccounts(updatedAccounts);

    const updatedUser: User = {
      ...user,
      username: username.trim(),
      email: email.trim().toLowerCase()
    };
    setUser(updatedUser);
    localStorage.setItem('ptm_admin_user', JSON.stringify(updatedUser));
  };

  const createAccount = async (
    username: string,
    email: string,
    role: 'super_admin' | 'admin',
    password?: string
  ): Promise<void> => {
    if (!user || user.role !== 'super_admin') {
      throw new Error('Only Super Admins can manage users');
    }

    const currentAccounts = getAccounts();
    const updated = createAccountHelper(currentAccounts, username, email, role, password);
    localStorage.setItem('ptm_accounts', JSON.stringify(updated));
    setAccounts(updated);
  };

  const updateAccount = async (
    oldEmail: string,
    username: string,
    email: string,
    role: 'super_admin' | 'admin',
    password?: string
  ): Promise<void> => {
    if (!user || user.role !== 'super_admin') {
      throw new Error('Only Super Admins can manage users');
    }

    const currentAccounts = getAccounts();
    const { updated, updatedAccountObj } = updateAccountHelper(
      currentAccounts,
      oldEmail,
      username,
      email,
      role,
      user.email,
      password
    );

    localStorage.setItem('ptm_accounts', JSON.stringify(updated));
    setAccounts(updated);

    if (oldEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      const updatedUser: User = {
        username: updatedAccountObj.username,
        email: updatedAccountObj.email,
        role: updatedAccountObj.role
      };
      setUser(updatedUser);
      localStorage.setItem('ptm_admin_user', JSON.stringify(updatedUser));
    }
  };

  const deleteAccount = async (email: string): Promise<void> => {
    if (!user || user.role !== 'super_admin') {
      throw new Error('Only Super Admins can manage users');
    }

    const currentAccounts = getAccounts();
    const updated = deleteAccountHelper(currentAccounts, email, user.email);
    localStorage.setItem('ptm_accounts', JSON.stringify(updated));
    setAccounts(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        updateProfile,
        accounts,
        createAccount,
        updateAccount,
        deleteAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
