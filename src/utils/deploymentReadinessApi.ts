import { getAuthHeader } from "./authStore";

type ApiEnv = {
  readonly VITE_API_BASE_URL?: string;
};

export type DeploymentHealthStatus = "ok" | "warning" | "fail";

export interface DeploymentHealthReport {
  success: boolean;
  status: DeploymentHealthStatus;
  uptime: number;
  timestamp: string;
  version: string;
  server: {
    status: DeploymentHealthStatus;
    message: string;
  };
  dataDirectory: {
    path: string;
    accessible: boolean;
    writable: boolean;
    status: DeploymentHealthStatus;
    message: string;
  };
  operationDataFiles: Array<{
    fileName: string;
    exists: boolean;
    readable: boolean;
    jsonArray: boolean;
    status: DeploymentHealthStatus;
    message: string;
  }>;
  ollama: {
    connected: boolean;
    gemmaResponding: boolean;
    model: string;
    checkedAt: string;
    fallbackAvailable: boolean;
    fallbackUsed: boolean;
    status: DeploymentHealthStatus;
    message: string;
  };
  gitIgnore: {
    envIgnored: boolean;
    backendDataIgnored: boolean;
    status: DeploymentHealthStatus;
    message: string;
  };
  checks: Array<{
    id: string;
    label: string;
    status: DeploymentHealthStatus;
    message: string;
  }>;
}

export function getApiBaseUrl() {
  return ((import.meta as ImportMeta & { env?: ApiEnv }).env?.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function buildApiUrl(path: string, baseUrl = getApiBaseUrl()) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  return `${normalizedBaseUrl}/api${normalizedPath}`;
}

export async function fetchFullHealthReport() {
  const response = await fetch(buildApiUrl("/health/full"), {
    headers: getAuthHeader()
  });
  const payload = (await response.json()) as DeploymentHealthReport | { message?: string };
  if (!response.ok || !("success" in payload) || !payload.success) {
    throw new Error("message" in payload && payload.message ? payload.message : "health check failed");
  }
  return payload;
}
