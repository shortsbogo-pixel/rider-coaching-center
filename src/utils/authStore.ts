import type { AuthUser, LoginCredentials, TestUser } from "../types/auth";

const AUTH_STORAGE_KEY = "rider-coaching-auth";

// MVP 테스트 계정입니다. 실제 배포 전에는 서버 인증, 안전한 비밀번호 저장, 세션 만료 정책으로 교체해야 합니다.
export const testUsers: TestUser[] = [
  {
    id: "admin",
    password: "admin1234",
    role: "admin",
    displayName: "관리자"
  },
  {
    id: "rider1",
    password: "rider1234",
    role: "rider",
    riderId: "uploaded-박종관",
    displayName: "박종관"
  }
];

export function getStoredUser(): AuthUser | null {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function loginWithMockUser(credentials: LoginCredentials): AuthUser {
  const found = testUsers.find((user) => user.id === credentials.id && user.password === credentials.password);
  if (!found) {
    throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
  const user: AuthUser = {
    id: found.id,
    role: found.role,
    displayName: found.displayName,
    riderId: found.riderId
  };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function clearStoredUser() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const user = getStoredUser();
  return user
    ? { "x-user-role": user.role, "x-user-id": user.id, "x-rider-id": user.riderId ? encodeURIComponent(user.riderId) : "" }
    : {};
}
