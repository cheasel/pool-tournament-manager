'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  email: string;
  role: 'super_admin' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    const cleanEmail = email.trim();
    if (cleanEmail === 'superadmin@rackmaster.com' && password === 'superadmin123') {
      const loggedUser: User = { email: cleanEmail, role: 'super_admin' };
      setUser(loggedUser);
      localStorage.setItem('ptm_admin_user', JSON.stringify(loggedUser));
      return true;
    }
    if (cleanEmail === 'admin@rackmaster.com' && password === 'admin123') {
      const loggedUser: User = { email: cleanEmail, role: 'admin' };
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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
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
