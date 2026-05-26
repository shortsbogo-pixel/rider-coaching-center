import assert from "node:assert/strict";
import test from "node:test";
import {
  createOperationBackup,
  restoreOperationBackup,
  validateOperationBackup,
  operationStorageKeys
} from "./operationBackup";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("creates a safe operation backup payload from local storage data", () => {
  const storage = new MemoryStorage();
  storage.setItem(operationStorageKeys.aiCoachingHistory, JSON.stringify([{ id: "ai-1", riderName: "김라이더", riderMessage: "안내" }]));
  storage.setItem(operationStorageKeys.managerActions, "not-json");
  storage.setItem(operationStorageKeys.weeklyBriefings, JSON.stringify([{ id: "week-1" }]));
  storage.setItem(operationStorageKeys.monthlyReports, JSON.stringify([{ id: "month-1" }]));

  const backup = createOperationBackup(storage);

  assert.equal(backup.appName, "rider-coaching-center");
  assert.ok(backup.exportedAt);
  assert.equal(backup.data.aiCoachingHistory.length, 1);
  assert.equal(backup.data.managerActions.length, 0);
  assert.equal(backup.data.weeklyBriefings.length, 1);
  assert.equal(backup.data.monthlyReports.length, 1);
  assert.equal(backup.data.messageCopySnapshots.length, 1);
  assert.equal(validateOperationBackup(backup).valid, true);
});

test("restores operation backup by overwrite or merge", () => {
  const storage = new MemoryStorage();
  storage.setItem(operationStorageKeys.aiCoachingHistory, JSON.stringify([{ id: "old", riderName: "기존" }]));

  const backup = {
    exportedAt: "2026-05-26T00:00:00.000Z",
    appName: "rider-coaching-center",
    version: "1",
    data: {
      aiCoachingHistory: [{ id: "new", riderName: "신규" }],
      managerActions: [],
      weeklyBriefings: [],
      monthlyReports: [],
      messageCopySnapshots: []
    }
  };

  const merged = restoreOperationBackup(backup, "merge", storage);
  assert.equal(merged.ok, true);
  assert.deepEqual(JSON.parse(storage.getItem(operationStorageKeys.aiCoachingHistory) ?? "[]").map((item: { id: string }) => item.id), ["old", "new"]);

  const overwritten = restoreOperationBackup(backup, "overwrite", storage);
  assert.equal(overwritten.ok, true);
  assert.deepEqual(JSON.parse(storage.getItem(operationStorageKeys.aiCoachingHistory) ?? "[]").map((item: { id: string }) => item.id), ["new"]);
});

test("rejects invalid backup files without throwing", () => {
  assert.equal(validateOperationBackup(null).valid, false);
  assert.equal(validateOperationBackup({ appName: "wrong", data: {} }).valid, false);
});
