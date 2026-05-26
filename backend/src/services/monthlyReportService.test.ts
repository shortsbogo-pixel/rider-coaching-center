import assert from "node:assert/strict";
import test from "node:test";
import type { MonthlyOperationReportSummary } from "../../../src/utils/monthlyOperationReport";
import { getDefaultMonthlyOperationReport } from "./monthlyReportService";

const summary: MonthlyOperationReportSummary = {
  monthKey: "2026-05",
  coachingGeneratedCount: 12,
  highRiskCoachingCount: 3,
  cautionCoachingCount: 4,
  stableCoachingCount: 5,
  actionCompletionRate: 62,
  managementNeededRiderCount: 7,
  topCoachedRiders: [],
  topDeclinedRiders: [],
  operationMemo: "야간 이탈 대상자 확인"
};

test("monthly report service fallback returns template operation summary", () => {
  const result = getDefaultMonthlyOperationReport(summary);

  assert.equal(result.monthKey, "2026-05");
  assert.equal(result.isTemplate, true);
  assert.equal(result.source, "template");
  assert.equal(result.nextMonthActions.length, 3);
  assert.match(result.operationSummary, /12건/);
});
