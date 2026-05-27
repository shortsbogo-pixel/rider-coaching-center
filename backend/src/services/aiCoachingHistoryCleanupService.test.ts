import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createOperationStorageService } from "./operationStorageService";
import {
  cleanupAICoachingHistory,
  getAICoachingHistoryCleanupSummary
} from "./aiCoachingHistoryCleanupService";

function historyEntry(id: string, riderName: string, weekKey = "5월3주차") {
  return {
    id,
    riderName,
    weekKey,
    riskLevel: "관리주의",
    previousWeekCompleted: 100,
    currentWeekCompleted: 90,
    changeRate: -10,
    adminMessage: "admin",
    riderMessage: "rider",
    isTemplate: true,
    source: "template",
    createdAt: "2026-05-28T00:00:00.000Z"
  };
}

test("AI coaching cleanup summary detects uploaded rider history", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-history-cleanup-"));
  try {
    const storage = createOperationStorageService(rootDir);
    await storage.aiCoachingHistory.saveMany([
      historyEntry("normal-1", "김라이더"),
      historyEntry("dirty-1", "uploaded-박종관"),
      historyEntry("dirty-2", "uploaded-박태우", "5월4주차")
    ]);

    const summary = await getAICoachingHistoryCleanupSummary(storage);

    assert.equal(summary.totalCount, 3);
    assert.equal(summary.uploadedCount, 2);
    assert.deepEqual(summary.uploadedExamples.map((entry) => entry.riderName), ["uploaded-박종관", "uploaded-박태우"]);
    assert.deepEqual(summary.weekKeys, ["5월3주차", "5월4주차"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("AI coaching cleanup removes uploaded history only and records an operation log", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-history-cleanup-"));
  try {
    const storage = createOperationStorageService(rootDir);
    await storage.aiCoachingHistory.saveMany([
      historyEntry("normal-1", "김라이더"),
      historyEntry("dirty-1", "uploaded-박종관"),
      historyEntry("dirty-2", "uploaded-박태우")
    ]);

    const result = await cleanupAICoachingHistory({ scope: "uploaded" }, storage);

    assert.equal(result.deletedCount, 2);
    assert.equal(result.remainingCount, 1);
    assert.deepEqual((await storage.aiCoachingHistory.getAll()).map((entry) => entry.id), ["normal-1"]);
    const logs = await storage.operationLogs.getAll();
    assert.equal(logs[0]?.actionType, "AI_COACHING_HISTORY_CLEANED");
    assert.match(logs[0]?.summary ?? "", /uploaded-\*/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("AI coaching cleanup can remove history by weekKey or riderName", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-history-cleanup-"));
  try {
    const storage = createOperationStorageService(rootDir);
    await storage.aiCoachingHistory.saveMany([
      historyEntry("normal-1", "김라이더", "5월3주차"),
      historyEntry("normal-2", "김라이더", "5월4주차"),
      historyEntry("normal-3", "박라이더", "5월4주차")
    ]);

    const weekResult = await cleanupAICoachingHistory({ scope: "week", weekKey: "5월3주차" }, storage);
    assert.equal(weekResult.deletedCount, 1);
    assert.deepEqual((await storage.aiCoachingHistory.getAll()).map((entry) => entry.id), ["normal-2", "normal-3"]);

    const riderResult = await cleanupAICoachingHistory({ scope: "rider", riderName: "김라이더" }, storage);
    assert.equal(riderResult.deletedCount, 1);
    assert.deepEqual((await storage.aiCoachingHistory.getAll()).map((entry) => entry.id), ["normal-3"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
