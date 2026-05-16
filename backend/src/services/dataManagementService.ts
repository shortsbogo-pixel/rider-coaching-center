import { adminNoteRepository } from "../repositories/adminNoteRepository";
import { analysisRepository } from "../repositories/analysisRepository";
import { appSettingsRepository } from "../repositories/appSettingsRepository";
import { coachingMessageRepository } from "../repositories/coachingMessageRepository";
import { riderRepository } from "../repositories/riderRepository";
import { uploadRepository } from "../repositories/uploadRepository";
import { getAnalysisCache, regenerateAnalysisCache } from "./analysisService";
import { getUploadedWeeks, loadParsedOrders } from "./excelService";

function getBackupItemStatus(value: unknown) {
  if (value === undefined) return "missing";
  if (Array.isArray(value)) return value.length ? "included" : "empty";
  return value ? "included" : "empty";
}

function countBackupItem(value: unknown) {
  return Array.isArray(value) ? value.length : value === undefined ? 0 : 1;
}

function buildBackupChecks(snapshot: Record<string, unknown>) {
  const required = ["uploads", "orders", "riderProfiles", "adminNotes", "customCoachingMessages", "analysisCaches", "appSettings", "exportedAt", "version"];
  return required.map((key) => ({
    key,
    status: getBackupItemStatus(snapshot[key]),
    count: countBackupItem(snapshot[key])
  }));
}

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
  const latestUploadAt = uploads[0]?.uploadedAt;
  const analysisCacheWeeks = analysisCaches.map((cache) => {
    const isStale = latestUploadAt ? cache.generatedAt < latestUploadAt : false;
    return {
      weekKey: cache.weekKey,
      generatedAt: cache.generatedAt,
      status: isStale ? "regenerate_needed" : "latest",
      sourceOrderCount: orders.filter((order) => cache.weekKey === "all" || order.week === cache.weekKey).length,
      analyzedRiderCount: cache.totalRiders,
      totalCompleted: cache.totalCompleted
    };
  });
  const backupSnapshot = {
    exportedAt: new Date().toISOString(),
    version: 1,
    uploads,
    orders,
    riderProfiles: riders,
    adminNotes: notes,
    customCoachingMessages: messages,
    analysisCaches,
    appSettings: [settings]
  };

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
      analysisCacheWeeks,
      deletionCandidates: uploads.filter((upload) => upload.deletionCandidate).map((upload) => upload.weekKey)
    },
    backupChecks: buildBackupChecks(backupSnapshot),
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

  const backup = {
    exportedAt: new Date().toISOString(),
    version: 1,
    uploads: uploadHistory,
    orders: parsedOrders,
    riderProfiles: riderProfileCache,
    uploadHistory,
    parsedOrders,
    riderProfileCache,
    adminNotes,
    customCoachingMessages,
    analysisCaches,
    appSettings
  };
  await appSettingsRepository.markBackupCreated();
  return backup;
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
