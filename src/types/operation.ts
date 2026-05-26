export type OperationSaveStatus = "server" | "local" | "failed";

export type OperationActionType =
  | "AI_COACHING_GENERATED"
  | "AI_COACHING_REGENERATED"
  | "MESSAGE_COPIED"
  | "CHECKLIST_UPDATED"
  | "WEEKLY_BRIEFING_GENERATED"
  | "MONTHLY_REPORT_GENERATED"
  | "BACKUP_DOWNLOADED"
  | "DATA_RESTORED"
  | "CSV_EXPORTED"
  | "AI_STATUS_CHECKED"
  | "LOCAL_DATA_MIGRATED";

export type OperationLogFilter = "all" | "ai-coaching" | "checklist" | "briefing" | "report" | "backup";

export interface OperationLogEntry {
  id: string;
  actionType: OperationActionType;
  actorRole: "admin" | "rider";
  actorName: string;
  riderName?: string;
  weekKey?: string;
  monthKey?: string;
  summary: string;
  createdAt: string;
}

export interface OperationApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface MigrationResult {
  successCount: number;
  failedCount: number;
  skippedCount: number;
}
