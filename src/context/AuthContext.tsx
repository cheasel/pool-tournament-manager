'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  username: string;
  email: string;
  role: 'super_admin' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  updateProfile: (username: string, email: string, password?: string) => Promise<void>;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Make sure accounts list is initialized in localStorage
    getAccounts();
    
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
    const accounts = getAccounts();
    const matched = accounts.find(
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

    const accounts = getAccounts();
    const updatedAccounts = accounts.map((acc: any) => {
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

    const updatedUser: User = {
      ...user,
      username: username.trim(),
      email: email.trim().toLowerCase()
    };
    setUser(updatedUser);
    localStorage.setItem('ptm_admin_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, updateProfile }}>
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
