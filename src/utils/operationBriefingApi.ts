import type { OperationApiResponse } from "../types/operation";
import type { LocalOperationBriefingEntry, OperationBriefingResult, OperationBriefingSummaryInput } from "../types/operationBriefing";
import { getAuthHeader } from "./authStore";
import { buildAICoachingApiUrl } from "./aiCoachingApi";
import { buildOperationApiUrl } from "./operationApi";

async function readPayload<T>(response: Response): Promise<OperationApiResponse<T>> {
  const payload = (await response.json()) as OperationApiResponse<T>;
  if (!payload || typeof payload.success !== "boolean") {
    throw new Error("invalid operation api response");
  }
  return payload;
}

async function requestOperationBriefingStorage<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildOperationApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {})
    }
  });
  const payload = await readPayload<T>(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "operation briefing api failed");
  }
  return payload.data;
}

export const operationBriefingApi = {
  getBriefings: () => requestOperationBriefingStorage<LocalOperationBriefingEntry[]>("/operation-briefings"),
  getBriefingsByWeek: (weekKey: string) =>
    requestOperationBriefingStorage<LocalOperationBriefingEntry[]>(`/operation-briefings/week/${encodeURIComponent(weekKey)}`),
  saveBriefing: (entry: LocalOperationBriefingEntry) =>
    requestOperationBriefingStorage<LocalOperationBriefingEntry>("/operation-briefings", {
      method: "POST",
      body: JSON.stringify(entry)
    })
};

export async function generateOperationBriefing(summary: OperationBriefingSummaryInput): Promise<OperationBriefingResult> {
  const response = await fetch(buildAICoachingApiUrl("/operation-briefing"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify(summary)
  });

  if (!response.ok) {
    throw new Error("operation briefing generation failed");
  }

  return (await response.json()) as OperationBriefingResult;
}
