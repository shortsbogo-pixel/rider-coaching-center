import assert from "node:assert/strict";
import test from "node:test";
import type { MonthlyOperationReport } from "./monthlyOperationReport";
import {
  createMonthlyReportEntry,
  getLatestMonthlyReport,
  getMonthlyReportHistory,
  readMonthlyReportEntries,
  saveMonthlyReportEntry
} from "./monthlyReportHistory";

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

function report(overrides: Partial<MonthlyOperationReport> = {}): MonthlyOperationReport {
  return {
    monthKey: overrides.monthKey ?? "2026-05",
    coachingGeneratedCount: overrides.coachingGeneratedCount ?? 1,
    highRiskCoachingCount: overrides.highRiskCoachingCount ?? 1,
    cautionCoachingCount: overrides.cautionCoachingCount ?? 0,
    stableCoachingCount: overrides.stableCoachingCount ?? 0,
    actionCompletionRate: overrides.actionCompletionRate ?? 20,
    managementNeededRiderCount: overrides.managementNeededRiderCount ?? 1,
    topCoachedRiders: overrides.topCoachedRiders ?? [],
    topDeclinedRiders: overrides.topDeclinedRiders ?? [],
    operationMemo: overrides.operationMemo ?? "",
    operationSummary: overrides.operationSummary ?? "요약",
    nextMonthActions: overrides.nextMonthActions ?? ["액션1", "액션2", "액션3"],
    isTemplate: overrides.isTemplate ?? true,
    source: overrides.source ?? "template",
    createdAt: overrides.createdAt ?? "2026-05-26T00:00:00.000Z"
  };
}

test("monthly report history accumulates repeated generations by month", () => {
  const storage = new MemoryStorage();
  const first = createMonthlyReportEntry(report({ createdAt: "2026-05-26T01:00:00.000Z", operationSummary: "첫 리포트" }));
  const second = createMonthlyReportEntry(report({ createdAt: "2026-05-26T02:00:00.000Z", operationSummary: "두 번째 리포트" }));

  assert.equal(saveMonthlyReportEntry(first, storage), true);
  assert.equal(saveMonthlyReportEntry(second, storage), true);
  assert.equal(readMonthlyReportEntries(storage).length, 2);
  assert.equal(getMonthlyReportHistory("2026-05", storage)[0].operationSummary, "두 번째 리포트");
  assert.equal(getLatestMonthlyReport("2026-05", storage)?.operationSummary, "두 번째 리포트");
});

test("monthly report history storage failures do not throw", () => {
  const storage = new FailingStorage();

  assert.doesNotThrow(() => saveMonthlyReportEntry(createMonthlyReportEntry(report()), storage));
  assert.equal(saveMonthlyReportEntry(createMonthlyReportEntry(report()), storage), false);
});
