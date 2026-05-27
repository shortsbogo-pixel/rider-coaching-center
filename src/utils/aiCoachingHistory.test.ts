import assert from "node:assert/strict";
import test from "node:test";
import type { LocalAICoachingHistoryEntry } from "../types/aiCoaching";
import {
  createAICoachingHistoryEntry,
  getAICoachingHistoryForRiderWeek,
  readAICoachingHistoryEntries,
  removeAICoachingHistoryEntries,
  saveAICoachingHistoryEntry
} from "./aiCoachingHistory";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class FailingStorage extends MemoryStorage {
  override setItem() {
    throw new Error("storage full");
  }
}

function createEntry(overrides: Partial<LocalAICoachingHistoryEntry> = {}) {
  return createAICoachingHistoryEntry({
    riderName: overrides.riderName ?? "김라이더",
    weekKey: overrides.weekKey ?? "5월3주차",
    riskLevel: overrides.riskLevel ?? "관리주의",
    previousWeekCompleted: overrides.previousWeekCompleted ?? 100,
    currentWeekCompleted: overrides.currentWeekCompleted ?? 80,
    changeRate: overrides.changeRate ?? -20,
    adminMessage: overrides.adminMessage ?? "관리자 메시지",
    riderMessage: overrides.riderMessage ?? "라이더 메시지",
    isTemplate: overrides.isTemplate ?? false,
    source: overrides.source ?? "gemma4",
    createdAt: overrides.createdAt
  });
}

test("AI coaching history accumulates repeated rider-week generations", () => {
  const storage = new MemoryStorage();
  const first = createEntry({ createdAt: "2026-05-26T01:00:00.000Z", adminMessage: "첫 메시지" });
  const second = createEntry({ createdAt: "2026-05-26T02:00:00.000Z", adminMessage: "두번째 메시지" });

  assert.equal(saveAICoachingHistoryEntry(first, storage), true);
  assert.equal(saveAICoachingHistoryEntry(second, storage), true);

  const all = readAICoachingHistoryEntries(storage);
  const riderWeekHistory = getAICoachingHistoryForRiderWeek("김라이더", "5월3주차", storage);

  assert.equal(all.length, 2);
  assert.equal(riderWeekHistory.length, 2);
  assert.equal(riderWeekHistory[0].adminMessage, "두번째 메시지");
  assert.equal(riderWeekHistory[1].adminMessage, "첫 메시지");
});

test("AI coaching history storage failures do not throw", () => {
  const storage = new FailingStorage();

  assert.doesNotThrow(() => saveAICoachingHistoryEntry(createEntry(), storage));
  assert.equal(saveAICoachingHistoryEntry(createEntry(), storage), false);
});

test("AI coaching history cleanup removes only matching local entries", () => {
  const storage = new MemoryStorage();
  const normal = createEntry({ riderName: "김라이더", weekKey: "5월3주차", createdAt: "2026-05-26T01:00:00.000Z" });
  const uploaded = createEntry({ riderName: "uploaded-박종관", weekKey: "5월3주차", createdAt: "2026-05-26T02:00:00.000Z" });
  const otherWeek = createEntry({ riderName: "박라이더", weekKey: "5월4주차", createdAt: "2026-05-26T03:00:00.000Z" });

  saveAICoachingHistoryEntry(normal, storage);
  saveAICoachingHistoryEntry(uploaded, storage);
  saveAICoachingHistoryEntry(otherWeek, storage);

  assert.equal(removeAICoachingHistoryEntries({ scope: "uploaded" }, storage).deletedCount, 1);
  assert.deepEqual(readAICoachingHistoryEntries(storage).map((entry) => entry.riderName), ["김라이더", "박라이더"]);

  assert.equal(removeAICoachingHistoryEntries({ scope: "week", weekKey: "5월4주차" }, storage).deletedCount, 1);
  assert.deepEqual(readAICoachingHistoryEntries(storage).map((entry) => entry.riderName), ["김라이더"]);
});
