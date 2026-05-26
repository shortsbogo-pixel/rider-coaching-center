import type { LocalWeeklyAIBriefingEntry, WeeklyAIBriefingResult, WeeklyAIBriefingSummary } from "../types/aiCoaching";

const WEEKLY_AI_BRIEFING_HISTORY_KEY = "rider-coaching-weekly-ai-briefings-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface CreateWeeklyAIBriefingEntryInput extends Omit<WeeklyAIBriefingResult, "createdAt"> {
  summary: WeeklyAIBriefingSummary;
  createdAt?: string;
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function weekKey(value: string) {
  return value.trim();
}

function isBriefingEntry(value: unknown): value is LocalWeeklyAIBriefingEntry {
  const entry = value as Partial<LocalWeeklyAIBriefingEntry>;
  return (
    typeof entry?.id === "string" &&
    typeof entry.weekKey === "string" &&
    typeof entry.briefingTitle === "string" &&
    typeof entry.executiveSummary === "string" &&
    typeof entry.riskSummary === "string" &&
    Array.isArray(entry.priorityActions) &&
    typeof entry.recommendedFocus === "string" &&
    typeof entry.messageForManagers === "string" &&
    typeof entry.createdAt === "string"
  );
}

export function createWeeklyAIBriefingEntry(input: CreateWeeklyAIBriefingEntryInput): LocalWeeklyAIBriefingEntry {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    ...input,
    id: `${weekKey(input.weekKey)}::${createdAt}::${randomId}`,
    createdAt
  };
}

export function readWeeklyAIBriefingEntries(storage?: StorageLike): LocalWeeklyAIBriefingEntry[] {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return [];
    const raw = targetStorage.getItem(WEEKLY_AI_BRIEFING_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isBriefingEntry) : [];
  } catch {
    return [];
  }
}

export function saveWeeklyAIBriefingEntry(entry: LocalWeeklyAIBriefingEntry, storage?: StorageLike): boolean {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return false;
    const entries = readWeeklyAIBriefingEntries(targetStorage);
    targetStorage.setItem(WEEKLY_AI_BRIEFING_HISTORY_KEY, JSON.stringify([...entries, entry]));
    return true;
  } catch {
    return false;
  }
}

export function getWeeklyAIBriefingHistory(week: string, storage?: StorageLike) {
  const key = weekKey(week);
  return readWeeklyAIBriefingEntries(storage)
    .filter((entry) => weekKey(entry.weekKey) === key)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLatestWeeklyAIBriefing(week: string, storage?: StorageLike) {
  return getWeeklyAIBriefingHistory(week, storage)[0];
}
