import { createContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginPayload, SignupPayload } from '../types/auth';
import * as authApi from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  signup: (data: SignupPayload) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
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
    localStorage.setItem('token', result.token);
    setToken(result.token);
    setUser(result.user);
  };

  const signup = async (data: SignupPayload) => {
    const result = await authApi.signup(data);
    localStorage.setItem('token', result.token);
    setToken(result.token);
    setUser(result.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
