import { createJsonFileCollection } from "../utils/jsonFileStore";
import type {
  AIStatusCheckEntry,
  MessageCopyHistoryEntry,
  OperationBackupMetaEntry,
  OperationLogEntry,
  OperationStoredItem
} from "../types/operationData";

function newestFirst<T extends { createdAt?: string; updatedAt?: string; checkedAt?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const left = a.createdAt ?? a.updatedAt ?? a.checkedAt ?? "";
    const right = b.createdAt ?? b.updatedAt ?? b.checkedAt ?? "";
    return new Date(right).getTime() - new Date(left).getTime();
  });
}

export function createOperationStorageService(rootDir?: string) {
  const aiCoachingHistory = createJsonFileCollection<OperationStoredItem>("ai-coaching-history.json", rootDir);
  const managerActionChecklists = createJsonFileCollection<OperationStoredItem>("manager-action-checklists.json", rootDir);
  const weeklyBriefings = createJsonFileCollection<OperationStoredItem>("weekly-briefings.json", rootDir);
  const monthlyReports = createJsonFileCollection<OperationStoredItem>("monthly-reports.json", rootDir);
  const messageCopyHistory = createJsonFileCollection<MessageCopyHistoryEntry>("message-copy-history.json", rootDir);
  const messageQueue = createJsonFileCollection<OperationStoredItem>("message-queue.json", rootDir);
  const messageSendHistory = createJsonFileCollection<OperationStoredItem>("message-send-history.json", rootDir);
  const backupMeta = createJsonFileCollection<OperationBackupMetaEntry>("backup-meta.json", rootDir);
  const aiStatusChecks = createJsonFileCollection<AIStatusCheckEntry>("ai-status-checks.json", rootDir);
  const operationLogs = createJsonFileCollection<OperationLogEntry>("operation-logs.json", rootDir);

  return {
    aiCoachingHistory,
    managerActionChecklists,
    weeklyBriefings,
    monthlyReports,
    messageCopyHistory,
    messageQueue,
    messageSendHistory,
    backupMeta,
    aiStatusChecks,
    operationLogs: {
      ...operationLogs,
      async getLatest() {
        return newestFirst(await operationLogs.getAll());
      }
    }
  };
}

export const operationStorageService = createOperationStorageService();
