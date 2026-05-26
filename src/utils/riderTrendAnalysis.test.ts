import assert from "node:assert/strict";
import test from "node:test";
import type { RiderMetrics } from "../types/rider";
import {
  buildDataQualityWarnings,
  buildRiderTrendAnalysis,
  buildRiderTrendAnalysisMap
} from "./riderTrendAnalysis";

const weeks = ["5월4주차", "5월3주차", "5월2주차", "5월1주차"];

function analysis(overrides: Partial<Parameters<typeof buildRiderTrendAnalysis>[0]> = {}) {
  return buildRiderTrendAnalysis({
    riderName: "김라이더",
    weekKey: "5월4주차",
    orderedWeekKeys: weeks,
    weeklyCompleted: {
      "5월4주차": 60,
      "5월3주차": 100,
      "5월2주차": 110,
      "5월1주차": 120
    },
    riskLevel: "고위험",
    ...overrides
  });
}

test("marks a high-risk rider with sharp week-over-week decline", () => {
  const result = analysis();

  assert.equal(result.currentWeekCompleted, 60);
  assert.equal(result.previousWeekCompleted, 100);
  assert.equal(result.trendLabel, "급락");
  assert.equal(result.declineStreakWeeks, 3);
  assert.match(result.riskReasons.join("\n"), /전주 대비 완료건수 40\.0% 감소/);
});

test("marks a rider recovering for two consecutive weeks", () => {
  const result = analysis({
    weeklyCompleted: {
      "5월4주차": 120,
      "5월3주차": 100,
      "5월2주차": 80,
      "5월1주차": 60
    },
    riskLevel: "안정"
  });

  assert.equal(result.trendLabel, "회복세");
  assert.equal(result.recoveryStreakWeeks, 3);
  assert.match(result.recommendedManagerActions.join("\n"), /회복 흐름/);
});

test("marks stable riders without forcing risk escalation", () => {
  const result = analysis({
    weeklyCompleted: {
      "5월4주차": 102,
      "5월3주차": 100,
      "5월2주차": 101,
      "5월1주차": 99
    },
    riskLevel: "안정"
  });

  assert.equal(result.trendLabel, "안정");
  assert.deepEqual(result.dataWarnings, []);
});

test("marks new riders when prior weeks have no activity", () => {
  const result = analysis({
    weeklyCompleted: {
      "5월4주차": 40,
      "5월3주차": 0,
      "5월2주차": 0,
      "5월1주차": 0
    },
    riskLevel: "허용"
  });

  assert.equal(result.trendLabel, "신규");
  assert.equal(result.isNewRider, true);
  assert.match(result.riskReasons.join("\n"), /신규 라이더라 비교 기준 부족/);
});

test("does not force high risk when previous week data is missing", () => {
  const result = analysis({
    orderedWeekKeys: ["5월4주차", "5월2주차", "5월1주차"],
    weeklyCompleted: {
      "5월4주차": 50,
      "5월2주차": 60,
      "5월1주차": 70
    },
    riskLevel: "허용"
  });

  assert.equal(result.trendLabel, "데이터 부족");
  assert.equal(result.changeRateFromPreviousWeek, null);
  assert.match(result.dataWarnings.map((warning) => warning.message).join("\n"), /전주 데이터가 없습니다/);
});

test("marks two-week consecutive declines", () => {
  const result = analysis({
    weeklyCompleted: {
      "5월4주차": 80,
      "5월3주차": 90,
      "5월2주차": 100,
      "5월1주차": 100
    },
    riskLevel: "관리주의"
  });

  assert.equal(result.trendLabel, "하락세");
  assert.equal(result.declineStreakWeeks, 2);
});

test("marks a sharp drop compared with the four-week average", () => {
  const result = analysis({
    weeklyCompleted: {
      "5월4주차": 40,
      "5월3주차": 120,
      "5월2주차": 120,
      "5월1주차": 120
    },
    riskLevel: "관리주의"
  });

  assert.equal(result.trendLabel, "급락");
  assert.match(result.riskReasons.join("\n"), /4주 평균 대비/);
});

test("builds rider analysis map and data quality warnings", () => {
  const metrics = [
    {
      riderId: "r1",
      displayName: "중복라이더",
      riderName: "중복라이더",
      baseName: "중복라이더",
      weeklyCompleted: { "5월4주차": 1200, "5월3주차": 0 },
      riskLevel: "허용",
      totalCompleted: 1200
    },
    {
      riderId: "r2",
      displayName: "중복라이더",
      riderName: "중복라이더",
      baseName: "중복라이더",
      weeklyCompleted: { "5월4주차": Number.NaN },
      riskLevel: "허용",
      totalCompleted: 0
    }
  ] as unknown as RiderMetrics[];

  const map = buildRiderTrendAnalysisMap(metrics, "5월4주차", weeks);
  const warnings = buildDataQualityWarnings({ metrics, selectedWeekKey: "5월4주차", orderedWeekKeys: weeks });

  assert.equal(map.get("r1")?.dataWarnings.some((warning) => warning.message.includes("비정상적으로 큰")), true);
  assert.equal(warnings.some((warning) => warning.message.includes("중복")), true);
  assert.equal(warnings.some((warning) => warning.message.includes("NaN")), true);
});
