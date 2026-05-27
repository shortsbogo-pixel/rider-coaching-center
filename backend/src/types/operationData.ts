export type OperationActorRole = "admin" | "rider";

export type OperationActionType =
  | "AI_COACHING_GENERATED"
  | "AI_COACHING_REGENERATED"
  | "MESSAGE_COPIED"
  | "CHECKLIST_UPDATED"
  | "WEEKLY_BRIEFING_GENERATED"
  | "OPERATION_BRIEFING_GENERATED"
  | "OPERATION_BRIEFING_REGENERATED"
  | "EXECUTIVE_REPORT_COPIED"
  | "MANAGER_SHARE_COPIED"
  | "PRIORITY_ACTION_VIEWED"
  | "MONTHLY_REPORT_GENERATED"
  | "BACKUP_DOWNLOADED"
  | "DATA_RESTORED"
  | "CSV_EXPORTED"
  | "AI_STATUS_CHECKED"
  | "LOCAL_DATA_MIGRATED"
  | "PARSED_DATA_RESET"
  | "ANALYSIS_CACHE_RESET"
  | "AI_COACHING_HISTORY_CLEANED"
  | "MESSAGE_QUEUE_ADDED"
  | "MESSAGE_QUEUE_KAKAO_COPIED"
  | "MESSAGE_QUEUE_SMS_COPIED"
  | "MESSAGE_SEND_COMPLETED"
  | "MESSAGE_QUEUE_HELD"
  | "MESSAGE_QUEUE_DELETED"
  | "MESSAGE_QUEUE_MEMO_UPDATED";

export interface OperationLogEntry {
  id: string;
  actionType: OperationActionType;
  actorRole: OperationActorRole;
  actorName: string;
  riderName?: string;
  weekKey?: string;
  monthKey?: string;
  summary: string;
  createdAt: string;
}

export interface OperationStoredItem {
  id: string;
  [key: string]: unknown;
}

export interface MessageCopyHistoryEntry extends OperationStoredItem {
  riderName?: string;
  weekKey?: string;
  copyType?: "kakao" | "sms" | "original";
  text?: string;
  createdAt?: string;
}

export interface OperationBackupMetaEntry extends OperationStoredItem {
  action?: string;
  fileName?: string;
  createdAt?: string;
  summary?: string;
}

export interface AIStatusCheckEntry extends OperationStoredItem {
  ollamaConnected?: boolean;
  model?: string;
  gemmaResponding?: boolean;
  checkedAt?: string;
  fallbackUsed?: boolean;
  message?: string;
}
