export type UserRole = "admin" | "rider";

export interface AuthUser {
  id: string;
  role: UserRole;
  displayName: string;
  riderId?: string;
}

export interface LoginCredentials {
  id: string;
  password: string;
}

export interface TestUser extends AuthUser {
  password: string;
}
