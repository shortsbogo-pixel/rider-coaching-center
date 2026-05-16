import { adminNoteRepository } from "../repositories/adminNoteRepository";
import { analysisRepository } from "../repositories/analysisRepository";
import { appSettingsRepository } from "../repositories/appSettingsRepository";
import { coachingMessageRepository } from "../repositories/coachingMessageRepository";
import { riderRepository } from "../repositories/riderRepository";
import { uploadRepository } from "../repositories/uploadRepository";
import { getAnalysisCache, regenerateAnalysisCache } from "./analysisService";
import { getUploadedWeeks, loadParsedOrders } from "./excelService";

export async function getDataManagementSummary() {
  const [uploads, orders, riders, notes, messages, analysisCaches, settings] = await Promise.all([
    getUploadedWeeks(),
    loadParsedOrders(),
    riderRepository.getAll(),
    adminNoteRepository.getAll(),
    coachingMessageRepository.getAll(),
    analysisRepository.getAll(),
    appSettingsRepository.getSettings()
  ]);
  const weekKeys = Array.from(new Set(orders.map((order) => order.week))).sort((a, b) => a.localeCompare(b, "ko"));

  return {
    uploads,
    weekKeys,
    counts: {
      uploadHistory: uploads.length,
      parsedOrders: orders.length,
      riderProfileCache: riders.length,
      adminNotes: notes.length,
      customCoachingMessages: messages.filter((message) => message.isCustom).length,
      analysisCaches: analysisCaches.length
    },
    cacheStatus: {
      riderProfileCacheUpdatedAt: riders[0]?.updatedAt ?? null,
      analysisCacheWeeks: analysisCaches.map((cache) => ({ weekKey: cache.weekKey, generatedAt: cache.generatedAt })),
      deletionCandidates: uploads.filter((upload) => upload.deletionCandidate).map((upload) => upload.weekKey)
    },
    settings
  };
}

export async function exportAllData() {
  const [uploadHistory, parsedOrders, riderProfileCache, adminNotes, customCoachingMessages, analysisCaches, appSettings] =
    await Promise.all([
      uploadRepository.exportData(),
      loadParsedOrders(),
      riderRepository.exportData(),
      adminNoteRepository.exportData(),
      coachingMessageRepository.exportData(),
      analysisRepository.exportData(),
      appSettingsRepository.exportData()
    ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    uploadHistory,
    parsedOrders,
    riderProfileCache,
    adminNotes,
    customCoachingMessages,
    analysisCaches,
    appSettings
  };
}

export async function exportDataSet(type: string) {
  if (type === "uploads") return uploadRepository.exportData();
  if (type === "admin-notes") return adminNoteRepository.exportData();
  if (type === "custom-coaching") return coachingMessageRepository.exportData();
  if (type === "analysis-cache") return analysisRepository.exportData();
  return exportAllData();
}

export async function regenerateCaches() {
  const analysis = await regenerateAnalysisCache("all");
  const summary = await getDataManagementSummary();
  return { analysis, summary };
}

export async function ensureAnalysisCache() {
  return getAnalysisCache("all");
}
