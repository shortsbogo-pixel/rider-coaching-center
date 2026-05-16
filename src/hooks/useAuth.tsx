import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthUser, LoginCredentials } from "../types/auth";
import { clearStoredUser, getStoredUser, loginWithMockUser } from "../utils/authStore";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => AuthUser;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login: (credentials) => {
        const nextUser = loginWithMockUser(credentials);
        setUser(nextUser);
        return nextUser;
      },
      logout: () => {
        clearStoredUser();
        setUser(null);
      }
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
