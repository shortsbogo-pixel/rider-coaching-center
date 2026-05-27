import type { OperationStoredItem } from "../types/operationData";
import { createOperationStorageService, operationStorageService } from "./operationStorageService";

type OperationStorage = ReturnType<typeof createOperationStorageService>;

export type AICoachingHistoryCleanupCriteria =
  | { scope: "uploaded" }
  | { scope: "week"; weekKey: string }
  | { scope: "rider"; riderName: string }
  | { scope: "all" };

export interface AICoachingHistoryCleanupSummary {
  totalCount: number;
  uploadedCount: number;
  uploadedExamples: Array<Pick<OperationStoredItem, "id"> & { riderName: string; weekKey: string }>;
  weekKeys: string[];
  riderNames: string[];
}

function textField(entry: OperationStoredItem, key: string) {
  const value = entry[key];
  return typeof value === "string" ? value.trim() : "";
}

function isUploadedName(value: string) {
  return value.trim().toLowerCase().startsWith("uploaded-");
}

export function isUploadedAICoachingHistory(entry: OperationStoredItem) {
  return isUploadedName(textField(entry, "riderName")) || isUploadedName(textField(entry, "riderId"));
}

function matchesCleanupCriteria(entry: OperationStoredItem, criteria: AICoachingHistoryCleanupCriteria) {
  if (criteria.scope === "all") return true;
  if (criteria.scope === "uploaded") return isUploadedAICoachingHistory(entry);
  if (criteria.scope === "week") return textField(entry, "weekKey") === criteria.weekKey.trim();
  return textField(entry, "riderName") === criteria.riderName.trim();
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function summaryForCriteria(criteria: AICoachingHistoryCleanupCriteria, deletedCount: number) {
  if (criteria.scope === "uploaded") return `AI 코칭 이력 정리: uploaded-* 이력 ${deletedCount}건 삭제`;
  if (criteria.scope === "week") return `AI 코칭 이력 정리: ${criteria.weekKey} 주차 이력 ${deletedCount}건 삭제`;
  if (criteria.scope === "rider") return `AI 코칭 이력 정리: ${criteria.riderName} 이력 ${deletedCount}건 삭제`;
  return `AI 코칭 이력 정리: 전체 이력 ${deletedCount}건 삭제`;
}

export async function getAICoachingHistoryCleanupSummary(storage: OperationStorage = operationStorageService): Promise<AICoachingHistoryCleanupSummary> {
  const items = await storage.aiCoachingHistory.getAll();
  const uploadedItems = items.filter(isUploadedAICoachingHistory);
  return {
    totalCount: items.length,
    uploadedCount: uploadedItems.length,
    uploadedExamples: uploadedItems.slice(0, 30).map((entry) => ({
      id: entry.id,
      riderName: textField(entry, "riderName") || textField(entry, "riderId"),
      weekKey: textField(entry, "weekKey")
    })),
    weekKeys: uniqueSorted(items.map((entry) => textField(entry, "weekKey"))),
    riderNames: uniqueSorted(items.map((entry) => textField(entry, "riderName"))).slice(0, 200)
  };
}

export async function cleanupAICoachingHistory(criteria: AICoachingHistoryCleanupCriteria, storage: OperationStorage = operationStorageService) {
  const items = await storage.aiCoachingHistory.getAll();
  const targets = items.filter((entry) => matchesCleanupCriteria(entry, criteria));
  for (const entry of targets) {
    await storage.aiCoachingHistory.delete(entry.id);
  }

  const createdAt = new Date().toISOString();
  await storage.operationLogs.save({
    id: `ai-coaching-history-cleaned::${createdAt}::${Math.random().toString(36).slice(2)}`,
    actionType: "AI_COACHING_HISTORY_CLEANED",
    actorRole: "admin",
    actorName: "admin",
    weekKey: criteria.scope === "week" ? criteria.weekKey.trim() : undefined,
    riderName: criteria.scope === "rider" ? criteria.riderName.trim() : undefined,
    summary: summaryForCriteria(criteria, targets.length),
    createdAt
  });

  return {
    scope: criteria.scope,
    deletedCount: targets.length,
    remainingCount: items.length - targets.length
  };
}
