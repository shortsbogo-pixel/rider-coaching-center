import type { AICoachingSource, AIProviderName, LocalAICoachingHistoryEntry } from "../types/aiCoaching";
import type { RiderRiskLevel } from "../types/rider";

const AI_COACHING_HISTORY_KEY = "rider-coaching-ai-history-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type AICoachingHistoryCleanupCriteria =
  | { scope: "uploaded" }
  | { scope: "week"; weekKey: string }
  | { scope: "rider"; riderName: string }
  | { scope: "all" };

export interface AICoachingHistoryCleanupResult {
  deletedCount: number;
  remainingCount: number;
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
  fallbackUsed?: boolean;
  fallbackReason?: LocalAICoachingHistoryEntry["fallbackReason"];
  provider?: AIProviderName;
  aiMode?: LocalAICoachingHistoryEntry["aiMode"];
  templateKey?: string;
  templateVersion?: string;
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

export function isUploadedAICoachingHistoryEntry(entry: Pick<LocalAICoachingHistoryEntry, "riderName">) {
  return entry.riderName.trim().toLowerCase().startsWith("uploaded-");
}

function matchesCleanupCriteria(entry: LocalAICoachingHistoryEntry, criteria: AICoachingHistoryCleanupCriteria) {
  if (criteria.scope === "all") return true;
  if (criteria.scope === "uploaded") return isUploadedAICoachingHistoryEntry(entry);
  if (criteria.scope === "week") return entry.weekKey.trim() === criteria.weekKey.trim();
  return entry.riderName.trim() === criteria.riderName.trim();
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
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason,
    provider: input.provider,
    aiMode: input.aiMode,
    templateKey: input.templateKey,
    templateVersion: input.templateVersion,
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

export function removeAICoachingHistoryEntries(criteria: AICoachingHistoryCleanupCriteria, storage?: StorageLike): AICoachingHistoryCleanupResult {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return { deletedCount: 0, remainingCount: 0 };
    const entries = readAICoachingHistoryEntries(targetStorage);
    const next = entries.filter((entry) => !matchesCleanupCriteria(entry, criteria));
    targetStorage.setItem(AI_COACHING_HISTORY_KEY, JSON.stringify(next));
    return {
      deletedCount: entries.length - next.length,
      remainingCount: next.length
    };
  } catch {
    return {
      deletedCount: 0,
      remainingCount: readAICoachingHistoryEntries(storage).length
    };
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
