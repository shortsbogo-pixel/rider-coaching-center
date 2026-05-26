import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyBriefingSummary } from "./weeklyBriefingSummary";

test("weekly briefing summary calculates risk, trend, action, and coaching counts from prepared rider data", () => {
  const summary = buildWeeklyBriefingSummary({
    weekKey: "5월3주차",
    riders: [
      { riderName: "김라이더", riskLevel: "고위험", previousWeekCompleted: 100, currentWeekCompleted: 70, changeRate: -30 },
      { riderName: "박라이더", riskLevel: "관리주의", previousWeekCompleted: 80, currentWeekCompleted: 92, changeRate: 15 },
      { riderName: "이라이더", riskLevel: "안정", previousWeekCompleted: 120, currentWeekCompleted: 120, changeRate: 0 },
      { riderName: "최라이더", riskLevel: "주의", previousWeekCompleted: 60, currentWeekCompleted: 30, changeRate: -50 }
    ],
    actionRecords: [
      { riderName: "김라이더", weekKey: "5월3주차", checkedItems: ["available-time", "send-message"], updatedAt: "2026-05-26T00:00:00.000Z" },
      { riderName: "박라이더", weekKey: "5월3주차", checkedItems: ["available-time"], updatedAt: "2026-05-26T00:00:00.000Z" },
      { riderName: "이전주", weekKey: "5월2주차", checkedItems: ["available-time", "send-message"], updatedAt: "2026-05-26T00:00:00.000Z" }
    ],
    coachingHistory: [
      {
        id: "1",
        riderName: "김라이더",
        weekKey: "5월3주차",
        riskLevel: "고위험",
        previousWeekCompleted: 100,
        currentWeekCompleted: 70,
        changeRate: -30,
        adminMessage: "admin",
        riderMessage: "rider",
        isTemplate: false,
        source: "gemma4",
        createdAt: "2026-05-26T00:00:00.000Z"
      },
      {
        id: "2",
        riderName: "김라이더",
        weekKey: "5월2주차",
        riskLevel: "고위험",
        previousWeekCompleted: 100,
        currentWeekCompleted: 70,
        changeRate: -30,
        adminMessage: "admin",
        riderMessage: "rider",
        isTemplate: false,
        source: "gemma4",
        createdAt: "2026-05-26T00:00:00.000Z"
      }
    ]
  });

  assert.equal(summary.totalRiders, 4);
  assert.equal(summary.highRiskCount, 1);
  assert.equal(summary.cautionCount, 2);
  assert.equal(summary.stableCount, 1);
  assert.equal(summary.declinedCount, 2);
  assert.equal(summary.recoveredCount, 1);
  assert.equal(summary.averageChangeRate, -16.3);
  assert.equal(summary.actionCompletionRate, 30);
  assert.equal(summary.coachingGeneratedCount, 1);
  assert.deepEqual(summary.topDeclinedRiders.map((rider) => rider.riderName), ["최라이더", "김라이더"]);
  assert.deepEqual(summary.topRecoveredRiders.map((rider) => rider.riderName), ["박라이더"]);
});

test("weekly briefing summary sanitizes empty and invalid numeric values", () => {
  const summary = buildWeeklyBriefingSummary({
    weekKey: "5월3주차",
    riders: [{ riderName: "김라이더", riskLevel: "안정", previousWeekCompleted: 0, currentWeekCompleted: Number.NaN, changeRate: Number.NaN }]
  });

  assert.equal(summary.averageChangeRate, 0);
  assert.equal(summary.topRecoveredRiders[0]?.currentWeekCompleted, undefined);
  assert.equal(summary.actionCompletionRate, 0);
});
