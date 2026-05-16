import type { AppSettings } from "../types/appSettings";
import type { UploadHistory } from "../types/upload";
import { apiGet, apiPost } from "./storageClient";

export interface DataManagementSummary {
  uploads: Array<
    {
      week: string;
      weekKey: string;
      fileName: string;
      uploadedAt: string;
      orderCount: number;
      completedTotal: number;
      issueCount: number;
      status: string;
      analysisScope?: "active" | "archive_candidate";
    } & Pick<UploadHistory, "deletionCandidate">
  >;
  weekKeys: string[];
  counts: {
    uploadHistory: number;
    parsedOrders: number;
    riderProfileCache: number;
    adminNotes: number;
    customCoachingMessages: number;
    analysisCaches: number;
  };
  cacheStatus: {
    riderProfileCacheUpdatedAt: string | null;
    analysisCacheWeeks: Array<{
      weekKey: string;
      generatedAt: string;
      status: "latest" | "regenerate_needed" | "missing" | "error";
      sourceOrderCount: number;
      analyzedRiderCount: number;
      totalCompleted: number;
    }>;
    deletionCandidates: string[];
  };
  backupChecks: Array<{ key: string; status: "included" | "empty" | "missing"; count: number }>;
  settings: AppSettings;
}

export const dataManagementRepository = {
  getSummary: () => apiGet<DataManagementSummary>("/api/data-management/summary"),
  exportData: (type = "all") => apiGet<unknown>(`/api/data-management/export?type=${encodeURIComponent(type)}`),
  regenerateCaches: () => apiPost<{ summary: DataManagementSummary }>("/api/data-management/regenerate-caches")
};
