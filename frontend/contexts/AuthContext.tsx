import React, { createContext, useContext, useEffect, useState } from 'react';
import { customAuth, type AuthUser } from '../services/customAuth';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refreshUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = () => {
    const authUser = customAuth.getUser();
    if (authUser) {
      setUser({ id: authUser.id, email: authUser.email });
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser();
    setLoading(false);

    // Sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'user') {
        refreshUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (email: string, password: string) => {
    const authUser = await customAuth.signIn(email, password);
    setUser({ id: authUser.id, email: authUser.email });
  };

  const signup = async (email: string, password: string) => {
    const authUser = await customAuth.signUp(email, password);
    setUser({ id: authUser.id, email: authUser.email });
  };

  const logout = async () => {
    await customAuth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
