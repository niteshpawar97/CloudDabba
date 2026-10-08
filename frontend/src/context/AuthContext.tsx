import { createContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginPayload, SignupPayload } from '../types/auth';
import * as authApi from '../api/auth';
import { ImpersonationBanner } from '../components/ImpersonationBanner';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  signup: (data: SignupPayload) => Promise<{ pendingApproval: boolean }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  signup: async () => ({ pendingApproval: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authApi.getMe()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (data: LoginPayload) => {
    const result = await authApi.login(data);
    localStorage.setItem('token', result.token!);
    setToken(result.token);
    setUser(result.user);
  };

  const signup = async (data: SignupPayload) => {
    const result = await authApi.signup(data);
    if (result.pendingApproval || !result.token) return { pendingApproval: true };
    localStorage.setItem('token', result.token);
    setToken(result.token);
    setUser(result.user);
    return { pendingApproval: false };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
      <ImpersonationBanner />
    </AuthContext.Provider>
  );
}
