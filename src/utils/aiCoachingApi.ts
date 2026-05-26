import { getAuthHeader } from "./authStore";
import type { AIFallbackReason, AIProviderName } from "../types/aiCoaching";

export interface AIStatusResult {
  ollamaConnected: boolean;
  model: string;
  gemmaResponding: boolean;
  checkedAt: string;
  fallbackUsed: boolean;
  fallbackReason?: AIFallbackReason;
  provider?: AIProviderName;
  aiProvider?: AIProviderName;
  aiMode?: "auto" | "gemma" | "template";
  fallbackEnabled?: boolean;
  message: string;
}

type AICoachingApiEnv = {
  readonly VITE_API_BASE_URL?: string;
};

function getAICoachingApiBaseUrl() {
  return ((import.meta as ImportMeta & { env?: AICoachingApiEnv }).env?.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function buildAICoachingApiUrl(path: string, baseUrl = getAICoachingApiBaseUrl()) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  return `${normalizedBaseUrl}/api/ai-coaching${normalizedPath}`;
}

export function buildAICoachingApiHeaders(authHeader: Record<string, string> = getAuthHeader()) {
  return {
    ...authHeader
  };
}

export async function fetchAIStatus(): Promise<AIStatusResult> {
  const response = await fetch(buildAICoachingApiUrl("/status"), {
    headers: buildAICoachingApiHeaders()
  });

  if (!response.ok) {
    let message = "AI status API request failed";
    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message || message;
    } catch {
      // Keep the default message when the error payload is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as AIStatusResult;
}
