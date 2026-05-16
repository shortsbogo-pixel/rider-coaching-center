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
    analysisCacheWeeks: Array<{ weekKey: string; generatedAt: string }>;
    deletionCandidates: string[];
  };
  settings: AppSettings;
}

export const dataManagementRepository = {
  getSummary: () => apiGet<DataManagementSummary>("/api/data-management/summary"),
  exportData: (type = "all") => apiGet<unknown>(`/api/data-management/export?type=${encodeURIComponent(type)}`),
  regenerateCaches: () => apiPost<{ summary: DataManagementSummary }>("/api/data-management/regenerate-caches")
};
