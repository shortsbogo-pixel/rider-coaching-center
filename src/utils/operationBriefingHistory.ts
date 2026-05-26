import type { LocalOperationBriefingEntry } from "../types/operationBriefing";

const OPERATION_BRIEFING_STORAGE_KEY = "rider-coaching-operation-briefings-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function readJsonArray<T>(key: string, storage = getStorage()): T[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // localStorage cleanup must not block the admin workflow.
    }
    return [];
  }
}

function writeJsonArray<T>(key: string, items: T[], storage = getStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function readOperationBriefingEntries(storage?: StorageLike) {
  return readJsonArray<LocalOperationBriefingEntry>(OPERATION_BRIEFING_STORAGE_KEY, storage).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function saveOperationBriefingEntry(entry: LocalOperationBriefingEntry, storage?: StorageLike) {
  const current = readOperationBriefingEntries(storage);
  const next = [entry, ...current.filter((item) => item.id !== entry.id)];
  return writeJsonArray(OPERATION_BRIEFING_STORAGE_KEY, next, storage);
}
