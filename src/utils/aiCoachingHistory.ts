import type { AICoachingSource, LocalAICoachingHistoryEntry } from "../types/aiCoaching";
import type { RiderRiskLevel } from "../types/rider";

const AI_COACHING_HISTORY_KEY = "rider-coaching-ai-history-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface CreateAICoachingHistoryEntryInput {
  riderName: string;
  weekKey: string;
  riskLevel: RiderRiskLevel;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
  adminMessage: string;
  riderMessage: string;
  isTemplate: boolean;
  source: AICoachingSource;
  createdAt?: string;
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function historyKey(riderName: string, weekKey: string) {
  return `${riderName.trim()}::${weekKey.trim()}`;
}

function isHistoryEntry(value: unknown): value is LocalAICoachingHistoryEntry {
  const entry = value as Partial<LocalAICoachingHistoryEntry>;
  return (
    typeof entry?.id === "string" &&
    typeof entry.riderName === "string" &&
    typeof entry.weekKey === "string" &&
    typeof entry.adminMessage === "string" &&
    typeof entry.riderMessage === "string" &&
    typeof entry.createdAt === "string"
  );
}

export function createAICoachingHistoryEntry(input: CreateAICoachingHistoryEntryInput): LocalAICoachingHistoryEntry {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: `${historyKey(input.riderName, input.weekKey)}::${createdAt}::${randomId}`,
    riderName: input.riderName,
    weekKey: input.weekKey,
    riskLevel: input.riskLevel,
    previousWeekCompleted: input.previousWeekCompleted,
    currentWeekCompleted: input.currentWeekCompleted,
    changeRate: input.changeRate,
    adminMessage: input.adminMessage,
    riderMessage: input.riderMessage,
    isTemplate: input.isTemplate,
    source: input.source,
    createdAt
  };
}

export function readAICoachingHistoryEntries(storage?: StorageLike): LocalAICoachingHistoryEntry[] {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return [];
    const raw = targetStorage.getItem(AI_COACHING_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
  } catch {
    return [];
  }
}

export function saveAICoachingHistoryEntry(entry: LocalAICoachingHistoryEntry, storage?: StorageLike): boolean {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return false;
    const entries = readAICoachingHistoryEntries(targetStorage);
    targetStorage.setItem(AI_COACHING_HISTORY_KEY, JSON.stringify([...entries, entry]));
    return true;
  } catch {
    return false;
  }
}

export function getAICoachingHistoryForRiderWeek(riderName: string, weekKey: string, storage?: StorageLike) {
  const key = historyKey(riderName, weekKey);
  return readAICoachingHistoryEntries(storage)
    .filter((entry) => historyKey(entry.riderName, entry.weekKey) === key)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLatestAICoachingHistoryForRiderWeek(riderName: string, weekKey: string, storage?: StorageLike) {
  return getAICoachingHistoryForRiderWeek(riderName, weekKey, storage)[0];
}
