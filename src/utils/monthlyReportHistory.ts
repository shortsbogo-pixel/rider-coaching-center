import type { MonthlyOperationReport } from "./monthlyOperationReport";

const MONTHLY_REPORT_HISTORY_KEY = "rider-coaching-monthly-operation-reports-v1";

export interface LocalMonthlyReportEntry extends MonthlyOperationReport {
  id: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function monthKey(value: string) {
  return value.trim();
}

function isMonthlyReportEntry(value: unknown): value is LocalMonthlyReportEntry {
  const entry = value as Partial<LocalMonthlyReportEntry>;
  return (
    typeof entry?.id === "string" &&
    typeof entry.monthKey === "string" &&
    typeof entry.operationSummary === "string" &&
    Array.isArray(entry.nextMonthActions) &&
    typeof entry.createdAt === "string"
  );
}

export function createMonthlyReportEntry(report: MonthlyOperationReport): LocalMonthlyReportEntry {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    ...report,
    id: `${monthKey(report.monthKey)}::${report.createdAt}::${randomId}`
  };
}

export function readMonthlyReportEntries(storage?: StorageLike): LocalMonthlyReportEntry[] {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return [];
    const raw = targetStorage.getItem(MONTHLY_REPORT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMonthlyReportEntry) : [];
  } catch {
    return [];
  }
}

export function saveMonthlyReportEntry(entry: LocalMonthlyReportEntry, storage?: StorageLike): boolean {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return false;
    const entries = readMonthlyReportEntries(targetStorage);
    targetStorage.setItem(MONTHLY_REPORT_HISTORY_KEY, JSON.stringify([...entries, entry]));
    return true;
  } catch {
    return false;
  }
}

export function getMonthlyReportHistory(month: string, storage?: StorageLike) {
  const key = monthKey(month);
  return readMonthlyReportEntries(storage)
    .filter((entry) => monthKey(entry.monthKey) === key)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLatestMonthlyReport(month: string, storage?: StorageLike) {
  return getMonthlyReportHistory(month, storage)[0];
}
