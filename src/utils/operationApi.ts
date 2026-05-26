import type { LocalAICoachingHistoryEntry, LocalWeeklyAIBriefingEntry } from "../types/aiCoaching";
import type { OperationActionType, OperationApiResponse, OperationLogEntry } from "../types/operation";
import type { ManagerActionChecklistRecord } from "./managerActionChecklist";
import type { LocalMonthlyReportEntry } from "./monthlyReportHistory";
import { getAuthHeader, getStoredUser } from "./authStore";
import { operationStorageKeys, safeReadOperationArray, safeWriteOperationArray } from "./operationBackup";

type OperationApiEnv = {
  readonly VITE_API_BASE_URL?: string;
};

function getOperationApiBaseUrl() {
  return ((import.meta as ImportMeta & { env?: OperationApiEnv }).env?.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function buildOperationApiUrl(path: string, baseUrl = getOperationApiBaseUrl()) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  return `${normalizedBaseUrl}/api/operation${normalizedPath}`;
}

async function readOperationPayload<T>(response: Response): Promise<OperationApiResponse<T>> {
  try {
    const payload = (await response.json()) as OperationApiResponse<T>;
    if (!payload || typeof payload.success !== "boolean") {
      throw new Error("invalid operation api response");
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message === "invalid operation api response") {
      throw error;
    }
    throw new Error(`operation api response parse failed (${response.status})`);
  }
}

async function requestOperation<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildOperationApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {})
    }
  });
  const payload = await readOperationPayload<T>(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "operation api failed");
  }
  return payload.data;
}

function postItem<T>(path: string, item: T) {
  return requestOperation<T>(path, {
    method: "POST",
    body: JSON.stringify(item)
  });
}

function postItems<T>(path: string, items: T[]) {
  return requestOperation<T[]>(path, {
    method: "POST",
    body: JSON.stringify({ items })
  });
}

export const operationApi = {
  getAICoachingHistory: () => requestOperation<LocalAICoachingHistoryEntry[]>("/ai-coaching-history"),
  saveAICoachingHistory: (entry: LocalAICoachingHistoryEntry) => postItem("/ai-coaching-history", entry),
  migrateAICoachingHistory: (items: LocalAICoachingHistoryEntry[]) => postItems("/ai-coaching-history", items),

  getActionChecklists: () => requestOperation<ManagerActionChecklistRecord[]>("/action-checklists"),
  saveActionChecklist: (entry: ManagerActionChecklistRecord) => postItem("/action-checklists", entry),
  migrateActionChecklists: (items: ManagerActionChecklistRecord[]) => postItems("/action-checklists", items),

  getWeeklyBriefings: () => requestOperation<LocalWeeklyAIBriefingEntry[]>("/weekly-briefings"),
  saveWeeklyBriefing: (entry: LocalWeeklyAIBriefingEntry) => postItem("/weekly-briefings", entry),
  migrateWeeklyBriefings: (items: LocalWeeklyAIBriefingEntry[]) => postItems("/weekly-briefings", items),

  getMonthlyReports: () => requestOperation<LocalMonthlyReportEntry[]>("/monthly-reports"),
  saveMonthlyReport: (entry: LocalMonthlyReportEntry) => postItem("/monthly-reports", entry),
  migrateMonthlyReports: (items: LocalMonthlyReportEntry[]) => postItems("/monthly-reports", items),

  saveMessageCopy: (entry: Record<string, unknown>) => postItem("/message-copy-history", entry),
  saveBackupMeta: (entry: Record<string, unknown>) => postItem("/backup-meta", entry),
  saveAIStatusResult: (entry: Record<string, unknown>) => postItem("/ai-status-results", entry),

  getLogs: () => requestOperation<OperationLogEntry[]>("/logs"),
  saveLog: (entry: OperationLogEntry) => postItem("/logs", entry)
};

export function createOperationLog(input: {
  actionType: OperationActionType;
  summary: string;
  riderName?: string;
  weekKey?: string;
  monthKey?: string;
}): OperationLogEntry {
  const user = getStoredUser();
  const createdAt = new Date().toISOString();
  return {
    id: `${input.actionType}::${createdAt}::${Math.random().toString(36).slice(2)}`,
    actionType: input.actionType,
    actorRole: user?.role ?? "admin",
    actorName: user?.displayName ?? "관리자",
    riderName: input.riderName,
    weekKey: input.weekKey,
    monthKey: input.monthKey,
    summary: input.summary,
    createdAt
  };
}

export async function writeOperationLog(input: Parameters<typeof createOperationLog>[0]) {
  const log = createOperationLog(input);
  try {
    await operationApi.saveLog(log);
    return true;
  } catch {
    const current = safeReadOperationArray(operationStorageKeys.operationLogs);
    safeWriteOperationArray(operationStorageKeys.operationLogs, [log, ...current].slice(0, 100));
    return false;
  }
}
