export const operationStorageKeys = {
  aiCoachingHistory: "rider-coaching-ai-history-v1",
  managerActions: "rider-coaching-manager-actions-v1",
  weeklyBriefings: "rider-coaching-weekly-ai-briefings-v1",
  monthlyReports: "rider-coaching-monthly-operation-reports-v1"
} as const;

export type OperationRestoreMode = "overwrite" | "merge";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MessageCopySnapshot {
  riderName: string;
  weekKey: string;
  riderMessage: string;
  adminMessage: string;
  createdAt: string;
}

export interface OperationBackupData {
  aiCoachingHistory: unknown[];
  managerActions: unknown[];
  weeklyBriefings: unknown[];
  monthlyReports: unknown[];
  messageCopySnapshots: MessageCopySnapshot[];
}

export interface OperationBackupFile {
  exportedAt: string;
  appName: "rider-coaching-center";
  version: string;
  data: OperationBackupData;
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function safeReadArray(key: string, storage?: StorageLike): unknown[] {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return [];
    const raw = targetStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteArray(key: string, value: unknown[], storage?: StorageLike) {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return false;
    targetStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function itemKey(value: unknown) {
  if (!isRecord(value)) return JSON.stringify(value);
  if (typeof value.id === "string" && value.id.trim()) return value.id;
  const riderName = typeof value.riderName === "string" ? value.riderName.trim() : "";
  const weekKey = typeof value.weekKey === "string" ? value.weekKey.trim() : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt.trim() : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt.trim() : "";
  return [riderName, weekKey, createdAt || updatedAt || JSON.stringify(value)].join("::");
}

function mergeArrays(current: unknown[], incoming: unknown[]) {
  const merged = new Map<string, unknown>();
  current.forEach((item) => merged.set(itemKey(item), item));
  incoming.forEach((item) => merged.set(itemKey(item), item));
  return Array.from(merged.values());
}

function buildMessageCopySnapshots(aiCoachingHistory: unknown[]): MessageCopySnapshot[] {
  return aiCoachingHistory
    .filter(isRecord)
    .map((entry) => ({
      riderName: typeof entry.riderName === "string" ? entry.riderName : "",
      weekKey: typeof entry.weekKey === "string" ? entry.weekKey : "",
      riderMessage: typeof entry.riderMessage === "string" ? entry.riderMessage : "",
      adminMessage: typeof entry.adminMessage === "string" ? entry.adminMessage : "",
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : typeof entry.generatedAt === "string" ? entry.generatedAt : ""
    }))
    .filter((entry) => entry.riderName || entry.riderMessage || entry.adminMessage);
}

export function createOperationBackup(storage?: StorageLike): OperationBackupFile {
  const aiCoachingHistory = safeReadArray(operationStorageKeys.aiCoachingHistory, storage);

  return {
    exportedAt: new Date().toISOString(),
    appName: "rider-coaching-center",
    version: "1",
    data: {
      aiCoachingHistory,
      managerActions: safeReadArray(operationStorageKeys.managerActions, storage),
      weeklyBriefings: safeReadArray(operationStorageKeys.weeklyBriefings, storage),
      monthlyReports: safeReadArray(operationStorageKeys.monthlyReports, storage),
      messageCopySnapshots: buildMessageCopySnapshots(aiCoachingHistory)
    }
  };
}

export function validateOperationBackup(value: unknown): { valid: true; backup: OperationBackupFile } | { valid: false; reason: string } {
  if (!isRecord(value)) return { valid: false, reason: "백업 파일 형식이 올바르지 않습니다." };
  if (value.appName !== "rider-coaching-center") return { valid: false, reason: "라이더 코칭센터 백업 파일이 아닙니다." };
  if (typeof value.exportedAt !== "string" || typeof value.version !== "string") {
    return { valid: false, reason: "백업 메타 정보가 올바르지 않습니다." };
  }
  if (!isRecord(value.data)) return { valid: false, reason: "백업 데이터가 없습니다." };

  const data = value.data;
  const requiredArrays = ["aiCoachingHistory", "managerActions", "weeklyBriefings", "monthlyReports", "messageCopySnapshots"];
  const invalidKey = requiredArrays.find((key) => !Array.isArray(data[key]));
  if (invalidKey) return { valid: false, reason: `${invalidKey} 데이터 형식이 올바르지 않습니다.` };

  return { valid: true, backup: value as unknown as OperationBackupFile };
}

export function restoreOperationBackup(value: unknown, mode: OperationRestoreMode, storage?: StorageLike) {
  const validation = validateOperationBackup(value);
  if (!validation.valid) return { ok: false, message: validation.reason };

  const backup = validation.backup;
  const pairs: Array<[string, unknown[]]> = [
    [operationStorageKeys.aiCoachingHistory, backup.data.aiCoachingHistory],
    [operationStorageKeys.managerActions, backup.data.managerActions],
    [operationStorageKeys.weeklyBriefings, backup.data.weeklyBriefings],
    [operationStorageKeys.monthlyReports, backup.data.monthlyReports]
  ];

  for (const [key, incoming] of pairs) {
    const next = mode === "merge" ? mergeArrays(safeReadArray(key, storage), incoming) : incoming;
    if (!safeWriteArray(key, next, storage)) {
      return { ok: false, message: "브라우저 저장소에 복원하지 못했습니다." };
    }
  }

  return { ok: true, message: mode === "merge" ? "운영 데이터 병합 복원 완료" : "운영 데이터 덮어쓰기 복원 완료" };
}

export function getDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
