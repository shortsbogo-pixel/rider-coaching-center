import type { LocalAICoachingHistoryEntry } from "../types/aiCoaching";
import { managerActionChecklistItems, type ManagerActionChecklistRecord } from "./managerActionChecklist";

export interface MonthlyOperationRiderInput {
  riderName: string;
  riskLevel: string;
  currentWeekCompleted: number;
  changeRate: number;
}

export interface MonthlyOperationReportInput {
  monthKey: string;
  coachingHistory: LocalAICoachingHistoryEntry[];
  actionRecords: ManagerActionChecklistRecord[];
  riders: MonthlyOperationRiderInput[];
  operationMemo: string;
}

export interface MonthlyOperationReportSummary {
  monthKey: string;
  coachingGeneratedCount: number;
  highRiskCoachingCount: number;
  cautionCoachingCount: number;
  stableCoachingCount: number;
  actionCompletionRate: number;
  managementNeededRiderCount: number;
  topCoachedRiders: Array<{ riderName: string; count: number }>;
  topDeclinedRiders: MonthlyOperationRiderInput[];
  operationMemo: string;
}

export interface MonthlyOperationReport extends MonthlyOperationReportSummary {
  operationSummary: string;
  nextMonthActions: string[];
  isTemplate: boolean;
  source: "gemma4" | "template";
  createdAt: string;
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function roundOne(value: number) {
  return (Math.sign(value) || 1) * (Math.round(Math.abs(value) * 10) / 10);
}

function isSameMonth(dateValue: string, monthKey: string) {
  return dateValue.startsWith(monthKey);
}

function isCautionRisk(riskLevel: string) {
  return riskLevel === "관리주의" || riskLevel === "주의";
}

function buildTopCoachedRiders(history: LocalAICoachingHistoryEntry[]) {
  const counts = history.reduce<Record<string, number>>((acc, entry) => {
    const name = entry.riderName.trim();
    if (!name) return acc;
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([riderName, count]) => ({ riderName, count }))
    .sort((a, b) => b.count - a.count || a.riderName.localeCompare(b.riderName, "ko"))
    .slice(0, 5);
}

function getActionCompletionRate(monthKey: string, actionRecords: ManagerActionChecklistRecord[]) {
  const monthlyRecords = actionRecords.filter((record) => isSameMonth(record.updatedAt, monthKey));
  if (!monthlyRecords.length) return 0;

  const validIds = new Set(managerActionChecklistItems.map((item) => item.id));
  const checkedCount = monthlyRecords.reduce((sum, record) => {
    const checkedIds = new Set(record.checkedItems.filter((item) => validIds.has(item)));
    return sum + checkedIds.size;
  }, 0);
  const totalCount = monthlyRecords.length * managerActionChecklistItems.length;
  return totalCount ? roundOne((checkedCount / totalCount) * 100) : 0;
}

export function buildMonthlyOperationReportSummary(input: MonthlyOperationReportInput): MonthlyOperationReportSummary {
  const monthlyHistory = input.coachingHistory.filter((entry) => isSameMonth(entry.createdAt, input.monthKey));
  const riders = input.riders.map((rider) => ({
    ...rider,
    currentWeekCompleted: safeNumber(rider.currentWeekCompleted),
    changeRate: safeNumber(rider.changeRate)
  }));

  return {
    monthKey: input.monthKey,
    coachingGeneratedCount: monthlyHistory.length,
    highRiskCoachingCount: monthlyHistory.filter((entry) => entry.riskLevel === "고위험").length,
    cautionCoachingCount: monthlyHistory.filter((entry) => isCautionRisk(entry.riskLevel)).length,
    stableCoachingCount: monthlyHistory.filter((entry) => entry.riskLevel === "안정" || entry.riskLevel === "에이스" || entry.riskLevel === "허용").length,
    actionCompletionRate: getActionCompletionRate(input.monthKey, input.actionRecords),
    managementNeededRiderCount: riders.filter((rider) => rider.riskLevel === "고위험" || isCautionRisk(rider.riskLevel)).length,
    topCoachedRiders: buildTopCoachedRiders(monthlyHistory),
    topDeclinedRiders: riders
      .filter((rider) => rider.changeRate < 0)
      .sort((a, b) => a.changeRate - b.changeRate)
      .slice(0, 5),
    operationMemo: input.operationMemo.trim()
  };
}

export function createTemplateMonthlyOperationReport(summary: MonthlyOperationReportSummary): MonthlyOperationReport {
  return {
    ...summary,
    operationSummary: `${summary.monthKey} 기준으로 AI 코칭 ${summary.coachingGeneratedCount}건이 생성되었고, 고위험 ${summary.highRiskCoachingCount}건과 관리주의/주의 ${summary.cautionCoachingCount}건을 우선 관리해야 합니다.`,
    nextMonthActions: [
      "고위험 라이더의 활동 가능 시간과 회복 구간을 우선 확인",
      "관리 액션 체크리스트 미완료 대상자를 주간 단위로 재점검",
      "하락폭이 큰 라이더 TOP 5를 중심으로 개별 코칭 문구 발송"
    ],
    isTemplate: true,
    source: "template",
    createdAt: new Date().toISOString()
  };
}

function formatRate(value: number) {
  const safeValue = safeNumber(value);
  const sign = safeValue > 0 ? "+" : "";
  return `${sign}${safeValue.toFixed(1)}%`;
}

export function formatMonthlyOperationReportText(report: MonthlyOperationReport) {
  const coachedLines = report.topCoachedRiders.length
    ? report.topCoachedRiders.map((rider, index) => `${index + 1}. ${rider.riderName}: ${rider.count}건`)
    : ["- 없음"];
  const declinedLines = report.topDeclinedRiders.length
    ? report.topDeclinedRiders.map(
        (rider, index) => `${index + 1}. ${rider.riderName}: ${formatRate(rider.changeRate)} / ${safeNumber(rider.currentWeekCompleted)}건`
      )
    : ["- 없음"];

  return [
    `[월간 운영 리포트] ${report.monthKey}`,
    `월간 AI 코칭 생성 ${report.coachingGeneratedCount}건`,
    `고위험 코칭 ${report.highRiskCoachingCount}건`,
    `관리주의/주의 코칭 ${report.cautionCoachingCount}건`,
    `안정 라이더 코칭 ${report.stableCoachingCount}건`,
    `관리 액션 완료율 ${formatRate(report.actionCompletionRate)}`,
    `관리 필요 라이더 ${report.managementNeededRiderCount}명`,
    "",
    "가장 많이 코칭된 라이더 TOP 5",
    ...coachedLines,
    "",
    "하락폭이 컸던 라이더 TOP 5",
    ...declinedLines,
    "",
    `이번 달 운영 요약: ${report.operationSummary}`,
    "다음 달 관리 제안",
    ...report.nextMonthActions.slice(0, 3).map((action, index) => `${index + 1}. ${action}`),
    "",
    `운영 메모: ${report.operationMemo || "없음"}`
  ].join("\n");
}
