import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthlyOperationReportSummary,
  createTemplateMonthlyOperationReport,
  formatMonthlyOperationReportText
} from "./monthlyOperationReport";

test("builds a monthly operation report from history, checklist records, and visible riders", () => {
  const summary = buildMonthlyOperationReportSummary({
    monthKey: "2026-05",
    operationMemo: "월간 이탈 위험 대상자 우선 확인",
    coachingHistory: [
      {
        id: "1",
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
        createdAt: "2026-05-10T00:00:00.000Z"
      },
      {
        id: "2",
        riderName: "김라이더",
        weekKey: "5월3주차",
        riskLevel: "관리주의",
        previousWeekCompleted: 70,
        currentWeekCompleted: 60,
        changeRate: -14.3,
        adminMessage: "admin",
        riderMessage: "rider",
        isTemplate: true,
        source: "template",
        createdAt: "2026-05-11T00:00:00.000Z"
      },
      {
        id: "3",
        riderName: "박라이더",
        weekKey: "4월4주차",
        riskLevel: "고위험",
        previousWeekCompleted: 80,
        currentWeekCompleted: 40,
        changeRate: -50,
        adminMessage: "admin",
        riderMessage: "rider",
        isTemplate: false,
        source: "gemma4",
        createdAt: "2026-04-30T00:00:00.000Z"
      }
    ],
    actionRecords: [
      { riderName: "김라이더", weekKey: "5월2주차", checkedItems: ["available-time", "send-message"], updatedAt: "2026-05-12T00:00:00.000Z" },
      { riderName: "박라이더", weekKey: "5월2주차", checkedItems: ["available-time"], updatedAt: "2026-05-13T00:00:00.000Z" }
    ],
    riders: [
      { riderName: "최라이더", riskLevel: "관리주의", currentWeekCompleted: 20, changeRate: -45 },
      { riderName: "김라이더", riskLevel: "고위험", currentWeekCompleted: 60, changeRate: -14.3 }
    ]
  });

  assert.equal(summary.monthKey, "2026-05");
  assert.equal(summary.coachingGeneratedCount, 2);
  assert.equal(summary.highRiskCoachingCount, 1);
  assert.equal(summary.cautionCoachingCount, 1);
  assert.equal(summary.stableCoachingCount, 0);
  assert.equal(summary.actionCompletionRate, 30);
  assert.equal(summary.managementNeededRiderCount, 2);
  assert.deepEqual(summary.topCoachedRiders, [{ riderName: "김라이더", count: 2 }]);
  assert.deepEqual(summary.topDeclinedRiders.map((rider) => rider.riderName), ["최라이더", "김라이더"]);
  assert.equal(summary.operationMemo, "월간 이탈 위험 대상자 우선 확인");
});

test("creates and formats a copyable Korean monthly operation report", () => {
  const summary = buildMonthlyOperationReportSummary({
    monthKey: "2026-05",
    coachingHistory: [],
    actionRecords: [],
    riders: [],
    operationMemo: ""
  });
  const report = createTemplateMonthlyOperationReport(summary);

  const text = formatMonthlyOperationReportText(report);

  assert.equal(report.isTemplate, true);
  assert.equal(report.source, "template");
  assert.equal(report.nextMonthActions.length, 3);
  assert.match(text, /\[월간 운영 리포트\] 2026-05/);
  assert.match(text, /월간 AI 코칭 생성 0건/);
  assert.match(text, /다음 달 관리 제안/);
  assert.doesNotMatch(text, /undefined|null|NaN/);
});
