import type { LocalAICoachingHistoryEntry, LocalWeeklyAIBriefingEntry } from "../types/aiCoaching";
import type { OperationActionType, OperationApiResponse, OperationLogEntry } from "../types/operation";
import type { ManagerActionChecklistRecord } from "./managerActionChecklist";
import type { LocalMonthlyReportEntry } from "./monthlyReportHistory";
import { getAuthHeader, getStoredUser } from "./authStore";

async function requestOperation<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/operation${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json()) as OperationApiResponse<T>;
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
  try {
    await operationApi.saveLog(createOperationLog(input));
  } catch {
    // Operation logging must never block the admin workflow.
  }
}
