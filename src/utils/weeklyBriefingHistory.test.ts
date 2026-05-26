import assert from "node:assert/strict";
import test from "node:test";
import type { LocalWeeklyAIBriefingEntry, WeeklyAIBriefingSummary } from "../types/aiCoaching";
import {
  createWeeklyAIBriefingEntry,
  getLatestWeeklyAIBriefing,
  getWeeklyAIBriefingHistory,
  readWeeklyAIBriefingEntries,
  saveWeeklyAIBriefingEntry
} from "./weeklyBriefingHistory";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class FailingStorage extends MemoryStorage {
  override setItem() {
    throw new Error("storage full");
  }
}

const summary: WeeklyAIBriefingSummary = {
  totalRiders: 3,
  highRiskCount: 1,
  cautionCount: 1,
  stableCount: 1,
  declinedCount: 1,
  recoveredCount: 1,
  averageChangeRate: -2.5,
  topDeclinedRiders: [],
  topRecoveredRiders: [],
  actionCompletionRate: 20,
  coachingGeneratedCount: 2
};

function createEntry(overrides: Partial<LocalWeeklyAIBriefingEntry> = {}) {
  return createWeeklyAIBriefingEntry({
    weekKey: overrides.weekKey ?? "5월3주차",
    summary: overrides.summary ?? summary,
    briefingTitle: overrides.briefingTitle ?? "이번 주 라이더 운영 브리핑",
    executiveSummary: overrides.executiveSummary ?? "요약",
    riskSummary: overrides.riskSummary ?? "위험 요약",
    priorityActions: overrides.priorityActions ?? ["액션1", "액션2", "액션3"],
    recommendedFocus: overrides.recommendedFocus ?? "집중 포인트",
    messageForManagers: overrides.messageForManagers ?? "관리자 메시지",
    isTemplate: overrides.isTemplate ?? false,
    source: overrides.source ?? "gemma4",
    createdAt: overrides.createdAt
  });
}

test("weekly AI briefing history accumulates repeated generations by week", () => {
  const storage = new MemoryStorage();
  const first = createEntry({ createdAt: "2026-05-26T01:00:00.000Z", executiveSummary: "첫 브리핑" });
  const second = createEntry({ createdAt: "2026-05-26T02:00:00.000Z", executiveSummary: "두 번째 브리핑" });

  assert.equal(saveWeeklyAIBriefingEntry(first, storage), true);
  assert.equal(saveWeeklyAIBriefingEntry(second, storage), true);

  const all = readWeeklyAIBriefingEntries(storage);
  const weekHistory = getWeeklyAIBriefingHistory("5월3주차", storage);

  assert.equal(all.length, 2);
  assert.equal(weekHistory.length, 2);
  assert.equal(weekHistory[0].executiveSummary, "두 번째 브리핑");
  assert.equal(getLatestWeeklyAIBriefing("5월3주차", storage)?.executiveSummary, "두 번째 브리핑");
});

test("weekly AI briefing history storage failures do not throw", () => {
  const storage = new FailingStorage();

  assert.doesNotThrow(() => saveWeeklyAIBriefingEntry(createEntry(), storage));
  assert.equal(saveWeeklyAIBriefingEntry(createEntry(), storage), false);
});
