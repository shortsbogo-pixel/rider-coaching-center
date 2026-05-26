import type { RiderMetrics, RiderRiskLevel } from "../types/rider";
import { sortWeekKeys } from "./weekSelector";

export type RiderTrendLabel = "급락" | "하락세" | "회복세" | "안정" | "신규" | "복귀" | "데이터 부족" | "확인 필요";
export type DataQualityWarningSeverity = "info" | "warning" | "danger";

export interface DataQualityWarning {
  id: string;
  scope: "global" | "rider";
  severity: DataQualityWarningSeverity;
  message: string;
  riderName?: string;
  weekKey?: string;
}

export interface WeeklyCompletionTrendPoint {
  weekKey: string;
  completed: number | null;
  missing: boolean;
}

export interface RiderTrendAnalysis {
  riderName: string;
  weekKey: string;
  currentWeekCompleted: number;
  previousWeekCompleted: number | null;
  twoWeeksAgoCompleted: number | null;
  fourWeekAverageCompleted: number | null;
  changeRateFromPreviousWeek: number | null;
  changeRateFromTwoWeeksAgo: number | null;
  changeRateFromFourWeekAverage: number | null;
  declineStreakWeeks: number;
  recoveryStreakWeeks: number;
  isNewRider: boolean;
  isDormantRider: boolean;
  isReturningRider: boolean;
  trendLabel: RiderTrendLabel;
  analysisReasons: string[];
  riskReasons: string[];
  dataWarnings: DataQualityWarning[];
  recentFourWeekTrend: WeeklyCompletionTrendPoint[];
  fourWeekTrendSummary: string;
  recommendedManagerActions: string[];
}

export interface AICoachingAnalysisContext {
  trendLabel: RiderTrendLabel;
  riskReasons: string[];
  dataWarnings: string[];
  fourWeekTrendSummary: string;
  recommendedManagerActions: string[];
}

export interface RiderTrendAnalysisInput {
  riderName: string;
  weekKey: string;
  weeklyCompleted: Record<string, unknown>;
  orderedWeekKeys: string[];
  riskLevel: RiderRiskLevel | "주의" | string;
  currentWeekCompleted?: number;
}

export interface DataQualityWarningInput {
  metrics: RiderMetrics[];
  selectedWeekKey: string;
  orderedWeekKeys: string[];
}

const ABNORMAL_COMPLETED_THRESHOLD = 1000;

function formatRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "비교 불가";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCompleted(value: number | null) {
  return value === null ? "데이터 없음" : `${value}건`;
}

function safeCompleted(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasOwnValue(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function warningId(parts: Array<string | number | undefined>) {
  return parts.filter((part) => part !== undefined && String(part).trim()).join("::");
}

function parseKoreanWeekKey(weekKey: string) {
  const month = Number(weekKey.match(/(\d+)월/)?.[1] ?? 0);
  const weekNo = Number(weekKey.match(/(\d+)주차/)?.[1] ?? 0);
  if (!month || !weekNo) return null;
  return { month, weekNo };
}

function subtractWeekKey(weekKey: string, offset: number) {
  const parsed = parseKoreanWeekKey(weekKey);
  if (!parsed) return "";
  let month = parsed.month;
  let weekNo = parsed.weekNo - offset;
  while (weekNo <= 0 && month > 1) {
    month -= 1;
    weekNo += 4;
  }
  return weekNo > 0 ? `${month}월${weekNo}주차` : "";
}

function expectedRecentWeeks(weekKey: string, orderedWeekKeys: string[]) {
  const expected = [0, 1, 2, 3].map((offset) => subtractWeekKey(weekKey, offset)).filter(Boolean);
  if (expected.length) return expected;
  const sorted = sortWeekKeys(orderedWeekKeys.filter(Boolean));
  const index = sorted.indexOf(weekKey);
  return index >= 0 ? sorted.slice(index, index + 4) : sorted.slice(0, 4);
}

function percentChange(current: number | null, baseline: number | null) {
  if (current === null || baseline === null || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function countStreak(points: WeeklyCompletionTrendPoint[], direction: "decline" | "recovery") {
  let count = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index].completed;
    const previous = points[index + 1].completed;
    if (current === null || previous === null) break;
    const matches = direction === "decline" ? current < previous : current > previous;
    if (!matches) break;
    count += 1;
  }
  return count;
}

function buildTrendWarnings(input: RiderTrendAnalysisInput, points: WeeklyCompletionTrendPoint[]) {
  const warnings: DataQualityWarning[] = [];
  const riderName = input.riderName.trim();
  const expectedPreviousWeek = subtractWeekKey(input.weekKey, 1);

  if (!input.weekKey.trim()) {
    warnings.push({
      id: warningId(["rider", riderName, "empty-week"]),
      scope: "rider",
      severity: "warning",
      riderName,
      message: "weekKey가 비어 있습니다."
    });
  }

  if (!riderName) {
    warnings.push({
      id: warningId(["rider", input.weekKey, "empty-name"]),
      scope: "rider",
      severity: "warning",
      weekKey: input.weekKey,
      message: "라이더명이 누락됐습니다."
    });
  }

  if (expectedPreviousWeek && !hasOwnValue(input.weeklyCompleted, expectedPreviousWeek)) {
    warnings.push({
      id: warningId(["rider", riderName, expectedPreviousWeek, "missing-previous"]),
      scope: "rider",
      severity: "warning",
      riderName,
      weekKey: expectedPreviousWeek,
      message: `${expectedPreviousWeek} 전주 데이터가 없습니다.`
    });
  }

  for (const point of points) {
    const raw = input.weeklyCompleted[point.weekKey];
    if (point.missing) continue;
    if (typeof raw !== "number" || Number.isNaN(raw)) {
      warnings.push({
        id: warningId(["rider", riderName, point.weekKey, "invalid-number"]),
        scope: "rider",
        severity: "warning",
        riderName,
        weekKey: point.weekKey,
        message: `${point.weekKey} 완료건수 숫자 필드가 ${Number.isNaN(raw) ? "NaN" : typeof raw} 값입니다.`
      });
      continue;
    }
    if (raw === 0) {
      warnings.push({
        id: warningId(["rider", riderName, point.weekKey, "zero-completed"]),
        scope: "rider",
        severity: "info",
        riderName,
        weekKey: point.weekKey,
        message: `${point.weekKey} 완료건수가 0건입니다. 실제 미운행인지 데이터 누락인지 확인이 필요합니다.`
      });
    }
    if (raw > ABNORMAL_COMPLETED_THRESHOLD) {
      warnings.push({
        id: warningId(["rider", riderName, point.weekKey, "large-completed"]),
        scope: "rider",
        severity: "danger",
        riderName,
        weekKey: point.weekKey,
        message: `${point.weekKey} 완료건수가 ${raw}건으로 비정상적으로 큰 값입니다.`
      });
    }
  }

  if (input.weekKey && !input.orderedWeekKeys.includes(input.weekKey)) {
    warnings.push({
      id: warningId(["rider", riderName, input.weekKey, "week-mismatch"]),
      scope: "rider",
      severity: "warning",
      riderName,
      weekKey: input.weekKey,
      message: "최근 주차와 비교 주차 목록이 맞지 않습니다."
    });
  }

  return warnings;
}

function buildTrendLabel(input: {
  current: number;
  previous: number | null;
  previousMissing: boolean;
  changeRateFromPreviousWeek: number | null;
  changeRateFromFourWeekAverage: number | null;
  declineStreakWeeks: number;
  recoveryStreakWeeks: number;
  isNewRider: boolean;
  isDormantRider: boolean;
  isReturningRider: boolean;
}): RiderTrendLabel {
  if (input.isNewRider) return "신규";
  if (input.isReturningRider) return "복귀";
  if (input.isDormantRider || input.current === 0) return "확인 필요";
  if (input.previousMissing) return "데이터 부족";
  if ((input.changeRateFromPreviousWeek ?? 0) <= -30 || (input.changeRateFromFourWeekAverage ?? 0) <= -25) return "급락";
  if (input.declineStreakWeeks >= 2 || (input.changeRateFromPreviousWeek ?? 0) <= -10) return "하락세";
  if (input.recoveryStreakWeeks >= 2 || (input.changeRateFromPreviousWeek ?? 0) >= 10) return "회복세";
  if (
    Math.abs(input.changeRateFromPreviousWeek ?? 0) <= 10 &&
    Math.abs(input.changeRateFromFourWeekAverage ?? 0) <= 15
  ) {
    return "안정";
  }
  return "확인 필요";
}

function buildReasons(input: {
  riskLevel: string;
  trendLabel: RiderTrendLabel;
  current: number;
  previous: number | null;
  fourWeekAverage: number | null;
  changeRateFromPreviousWeek: number | null;
  changeRateFromFourWeekAverage: number | null;
  declineStreakWeeks: number;
  recoveryStreakWeeks: number;
  isNewRider: boolean;
  isReturningRider: boolean;
  previousMissing: boolean;
}) {
  const reasons: string[] = [`기존 위험도는 ${input.riskLevel}입니다. 기존 riskLevel 값은 변경하지 않았습니다.`];

  if (input.previousMissing) {
    reasons.push("전주 데이터 없음으로 확인 필요");
  } else if (input.changeRateFromPreviousWeek !== null) {
    const direction = input.changeRateFromPreviousWeek < 0 ? "감소" : input.changeRateFromPreviousWeek > 0 ? "증가" : "변동 없음";
    reasons.push(`전주 대비 완료건수 ${Math.abs(input.changeRateFromPreviousWeek).toFixed(1)}% ${direction}`);
  }

  if (input.declineStreakWeeks >= 2) {
    reasons.push(`최근 ${input.declineStreakWeeks}주 연속 하락`);
  }
  if (input.recoveryStreakWeeks >= 2) {
    reasons.push(`최근 ${input.recoveryStreakWeeks}주 연속 회복`);
  }
  if (input.changeRateFromFourWeekAverage !== null) {
    const direction = input.changeRateFromFourWeekAverage < 0 ? "낮음" : "높음";
    reasons.push(`4주 평균 대비 ${Math.abs(input.changeRateFromFourWeekAverage).toFixed(1)}% ${direction}`);
  }
  if (input.isNewRider) {
    reasons.push("신규 라이더라 비교 기준 부족");
  }
  if (input.isReturningRider) {
    reasons.push("휴면 이후 복귀 흐름으로 이전 활동 패턴 확인 필요");
  }
  if (input.fourWeekAverage !== null) {
    reasons.push(`최근 4주 평균 완료건수 ${input.fourWeekAverage.toFixed(1)}건`);
  }

  return reasons;
}

function buildRecommendedActions(analysis: Pick<RiderTrendAnalysis, "trendLabel" | "dataWarnings" | "declineStreakWeeks" | "recoveryStreakWeeks">) {
  if (analysis.dataWarnings.some((warning) => warning.severity === "danger" || warning.severity === "warning")) {
    return ["데이터 검수 경고를 먼저 확인", "업로드 주차와 라이더명 중복 여부 확인", "검수 후 코칭 메시지 발송"];
  }
  if (analysis.trendLabel === "급락" || analysis.trendLabel === "하락세") {
    return ["전주 대비 하락 원인 확인", "기존 활동 시간대 회복 안내", "필요 시 센터에서 활동 패턴 재점검"];
  }
  if (analysis.trendLabel === "회복세") {
    return ["회복 흐름을 유지하도록 격려", "잘 나오던 시간대 유지 안내", "다음 주 재하락 여부 모니터링"];
  }
  if (analysis.trendLabel === "신규" || analysis.trendLabel === "복귀") {
    return ["비교 기준이 부족하므로 1주 더 관찰", "초기 활동 가능 시간대 확인", "무리한 위험 분류 없이 안내"];
  }
  return ["현재 흐름 유지 안내", "완료건수와 활동 시간대 변화 모니터링", "체크리스트 미완료 항목 확인"];
}

export function buildRiderTrendAnalysis(input: RiderTrendAnalysisInput): RiderTrendAnalysis {
  const recentWeeks = expectedRecentWeeks(input.weekKey, input.orderedWeekKeys);
  const recentFourWeekTrend = recentWeeks.map((weekKey) => {
    const missing = !hasOwnValue(input.weeklyCompleted, weekKey);
    return {
      weekKey,
      completed: missing ? null : safeCompleted(input.weeklyCompleted[weekKey]),
      missing
    };
  });
  const currentPoint = recentFourWeekTrend[0];
  const previousPoint = recentFourWeekTrend[1];
  const twoWeeksAgoPoint = recentFourWeekTrend[2];
  const currentWeekCompleted = currentPoint?.completed ?? input.currentWeekCompleted ?? 0;
  const previousWeekCompleted = previousPoint?.completed ?? null;
  const twoWeeksAgoCompleted = twoWeeksAgoPoint?.completed ?? null;
  const fourWeekAverageCompleted = average(recentFourWeekTrend.map((point) => point.completed));
  const changeRateFromPreviousWeek = percentChange(currentWeekCompleted, previousWeekCompleted);
  const changeRateFromTwoWeeksAgo = percentChange(currentWeekCompleted, twoWeeksAgoCompleted);
  const changeRateFromFourWeekAverage = percentChange(currentWeekCompleted, fourWeekAverageCompleted);
  const declineStreakWeeks = countStreak(recentFourWeekTrend, "decline");
  const recoveryStreakWeeks = countStreak(recentFourWeekTrend, "recovery");
  const olderValues = recentFourWeekTrend.slice(1).map((point) => point.completed);
  const previousMissing = Boolean(previousPoint?.missing || !previousPoint);
  const isNewRider = currentWeekCompleted > 0 && olderValues.every((value) => value === 0 || value === null);
  const isReturningRider = currentWeekCompleted > 0 && previousWeekCompleted === 0 && olderValues.slice(1).some((value) => (value ?? 0) > 0);
  const isDormantRider = currentWeekCompleted === 0 && olderValues.some((value) => (value ?? 0) > 0);
  const dataWarnings = buildTrendWarnings(input, recentFourWeekTrend);
  const trendLabel = buildTrendLabel({
    current: currentWeekCompleted,
    previous: previousWeekCompleted,
    previousMissing,
    changeRateFromPreviousWeek,
    changeRateFromFourWeekAverage,
    declineStreakWeeks,
    recoveryStreakWeeks,
    isNewRider,
    isDormantRider,
    isReturningRider
  });
  const analysisReasons = [
    `최근 4주 흐름: ${recentFourWeekTrend.map((point) => `${point.weekKey} ${formatCompleted(point.completed)}`).join(" → ")}`,
    `전주 대비 변화율: ${formatRate(changeRateFromPreviousWeek)}`,
    `4주 평균 대비 변화율: ${formatRate(changeRateFromFourWeekAverage)}`
  ];
  const riskReasons = buildReasons({
    riskLevel: input.riskLevel,
    trendLabel,
    current: currentWeekCompleted,
    previous: previousWeekCompleted,
    fourWeekAverage: fourWeekAverageCompleted,
    changeRateFromPreviousWeek,
    changeRateFromFourWeekAverage,
    declineStreakWeeks,
    recoveryStreakWeeks,
    isNewRider,
    isReturningRider,
    previousMissing
  });
  const partialAnalysis: Pick<RiderTrendAnalysis, "trendLabel" | "dataWarnings" | "declineStreakWeeks" | "recoveryStreakWeeks"> = {
    trendLabel,
    dataWarnings,
    declineStreakWeeks,
    recoveryStreakWeeks
  };
  const recommendedManagerActions = buildRecommendedActions(partialAnalysis);

  return {
    riderName: input.riderName,
    weekKey: input.weekKey,
    currentWeekCompleted,
    previousWeekCompleted,
    twoWeeksAgoCompleted,
    fourWeekAverageCompleted,
    changeRateFromPreviousWeek,
    changeRateFromTwoWeeksAgo,
    changeRateFromFourWeekAverage,
    declineStreakWeeks,
    recoveryStreakWeeks,
    isNewRider,
    isDormantRider,
    isReturningRider,
    trendLabel,
    analysisReasons,
    riskReasons,
    dataWarnings,
    recentFourWeekTrend,
    fourWeekTrendSummary: analysisReasons[0],
    recommendedManagerActions
  };
}

export function buildRiderTrendAnalysisMap(metrics: RiderMetrics[], selectedWeekKey: string, orderedWeekKeys: string[]) {
  const sortedWeeks = sortWeekKeys(orderedWeekKeys.filter(Boolean));
  return new Map(
    metrics.map((metric) => [
      metric.riderId,
      buildRiderTrendAnalysis({
        riderName: metric.displayName || metric.riderName,
        weekKey: selectedWeekKey,
        orderedWeekKeys: sortedWeeks,
        weeklyCompleted: metric.weeklyCompleted,
        riskLevel: metric.riskLevel,
        currentWeekCompleted: metric.totalCompleted
      })
    ])
  );
}

export function buildDataQualityWarnings({ metrics, selectedWeekKey, orderedWeekKeys }: DataQualityWarningInput) {
  const warnings: DataQualityWarning[] = [];
  const sortedWeeks = sortWeekKeys(orderedWeekKeys.filter(Boolean));

  if (!selectedWeekKey.trim()) {
    warnings.push({
      id: "global::empty-selected-week",
      scope: "global",
      severity: "warning",
      message: "선택된 weekKey가 비어 있습니다."
    });
  }

  if (!sortedWeeks.length) {
    warnings.push({
      id: "global::no-week-data",
      scope: "global",
      severity: "warning",
      message: "주차 데이터가 없습니다."
    });
  }

  if (selectedWeekKey && !sortedWeeks.includes(selectedWeekKey)) {
    warnings.push({
      id: warningId(["global", selectedWeekKey, "week-mismatch"]),
      scope: "global",
      severity: "warning",
      weekKey: selectedWeekKey,
      message: "최근 주차와 비교 주차가 맞지 않습니다."
    });
  }

  const expectedPreviousWeek = subtractWeekKey(selectedWeekKey, 1);
  if (expectedPreviousWeek && !sortedWeeks.includes(expectedPreviousWeek)) {
    warnings.push({
      id: warningId(["global", expectedPreviousWeek, "missing-previous"]),
      scope: "global",
      severity: "warning",
      weekKey: expectedPreviousWeek,
      message: "전주 데이터가 없습니다."
    });
  }

  if (!metrics.length) {
    warnings.push({
      id: "global::empty-riders",
      scope: "global",
      severity: "warning",
      weekKey: selectedWeekKey,
      message: "선택 주차 라이더 데이터가 없습니다."
    });
  }

  const nameCounts = new Map<string, number>();
  metrics.forEach((metric) => {
    const nameKey = (metric.baseName || metric.displayName || metric.riderName || "").trim();
    if (!nameKey) return;
    nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
  });

  for (const [name, count] of nameCounts.entries()) {
    if (count > 1) {
      warnings.push({
        id: warningId(["global", name, "duplicate"]),
        scope: "global",
        severity: "warning",
        riderName: name,
        message: `같은 라이더가 중복으로 잡혔을 수 있습니다: ${name} (${count}건)`
      });
    }
  }

  for (const metric of metrics) {
    const riderName = (metric.displayName || metric.riderName || "").trim();
    if (!riderName) {
      warnings.push({
        id: warningId(["global", metric.riderId, "empty-rider-name"]),
        scope: "rider",
        severity: "warning",
        weekKey: selectedWeekKey,
        message: "라이더명이 누락됐습니다."
      });
    }

    for (const [weekKey, value] of Object.entries(metric.weeklyCompleted ?? {})) {
      if (!weekKey.trim()) {
        warnings.push({
          id: warningId(["global", metric.riderId, "empty-week-key"]),
          scope: "rider",
          severity: "warning",
          riderName,
          message: "weekKey가 비어 있습니다."
        });
      }
      if (typeof value !== "number" || Number.isNaN(value)) {
        warnings.push({
          id: warningId(["global", metric.riderId, weekKey, "invalid-number"]),
          scope: "rider",
          severity: "warning",
          riderName,
          weekKey,
          message: `${weekKey || "빈 주차"} 완료건수 숫자 필드가 ${Number.isNaN(value) ? "NaN" : typeof value} 값입니다.`
        });
      } else if (value > ABNORMAL_COMPLETED_THRESHOLD) {
        warnings.push({
          id: warningId(["global", metric.riderId, weekKey, "large-completed"]),
          scope: "rider",
          severity: "danger",
          riderName,
          weekKey,
          message: `${weekKey} 완료건수가 ${value}건으로 비정상적으로 큰 값입니다.`
        });
      }
    }
  }

  return warnings;
}

export function buildAICoachingAnalysisContext(analysis: RiderTrendAnalysis): AICoachingAnalysisContext {
  return {
    trendLabel: analysis.trendLabel,
    riskReasons: analysis.riskReasons,
    dataWarnings: analysis.dataWarnings.map((warning) => warning.message),
    fourWeekTrendSummary: analysis.fourWeekTrendSummary,
    recommendedManagerActions: analysis.recommendedManagerActions
  };
}
