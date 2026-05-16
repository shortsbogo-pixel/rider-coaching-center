import type { AuthUser } from "../types/auth";

const AUTH_STORAGE_KEY = "rider-coaching-auth";

export const authSessionRepository = {
  get(): AuthUser | null {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  },
  save(user: AuthUser) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  },
  clear() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
};
