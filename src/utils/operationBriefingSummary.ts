import type {
  BuildOperationBriefingSummaryInput,
  LocalOperationBriefingEntry,
  OperationBriefingResult,
  OperationBriefingSummaryInput
} from "../types/operationBriefing";
import { managerActionChecklistItems } from "./managerActionChecklist";

function sameWeek(value: string | undefined, weekKey: string) {
  return (value ?? "").trim() === weekKey.trim();
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function isHighRisk(riskLevel: string) {
  return riskLevel === "고위험";
}

function isCautionRisk(riskLevel: string) {
  return riskLevel === "관리주의" || riskLevel === "주의";
}

function isStableRisk(riskLevel: string) {
  return riskLevel === "안정" || riskLevel === "허용" || riskLevel === "에이스";
}

function isDecliningTrend(trendLabel?: string) {
  return trendLabel === "급락" || trendLabel === "하락세";
}

function isRecoveringTrend(trendLabel?: string) {
  return trendLabel === "회복세";
}

function isNewOrReturningTrend(trendLabel?: string) {
  return trendLabel === "신규" || trendLabel === "복귀";
}

function normalizeActions(actions: string[]) {
  const fallback = ["고위험 라이더 우선 확인", "미발송 대기 항목 처리", "데이터 검수 경고 확인"];
  const cleaned = actions.filter((item) => item.trim().length > 0).map((item) => item.trim());
  return [...cleaned, ...fallback].slice(0, 3);
}

function buildPriorityActionHints(input: {
  highRiskCount: number;
  unsentCount: number;
  dataWarningCount: number;
  incompleteChecklistItemCount: number;
}) {
  return normalizeActions([
    input.highRiskCount > 0 ? `고위험 라이더 ${formatNumber(input.highRiskCount)}명 우선 코칭` : "고위험 신규 대상 없음, 관리주의 흐름 확인",
    input.unsentCount > 0 ? `미발송 대기 ${formatNumber(input.unsentCount)}건 처리` : "발송 대기함 미발송 항목 없음",
    input.dataWarningCount > 0
      ? `데이터 검수 경고 ${formatNumber(input.dataWarningCount)}건 확인`
      : input.incompleteChecklistItemCount > 0
        ? `체크리스트 미완료 ${formatNumber(input.incompleteChecklistItemCount)}건 정리`
        : "체크리스트와 데이터 상태 유지"
  ]);
}

export function buildOperationBriefingSummary(input: BuildOperationBriefingSummaryInput): OperationBriefingSummaryInput {
  const weekKey = input.weekKey.trim();
  const riders = input.riders.map((rider) => ({
    ...rider,
    riskLevel: String(rider.riskLevel),
    currentWeekCompleted: safeNumber(rider.currentWeekCompleted),
    changeRate: safeNumber(rider.changeRate),
    riskReasons: rider.riskReasons ?? [],
    recommendedManagerActions: rider.recommendedManagerActions ?? []
  }));
  const weeklyQueue = input.messageQueue.filter((item) => sameWeek(item.weekKey, weekKey));
  const pendingQueue = weeklyQueue.filter((item) => item.sendStatus !== "발송완료");
  const weeklyActionRecords = input.actionRecords.filter((record) => sameWeek(record.weekKey, weekKey));
  const actionRecordMap = new Map(weeklyActionRecords.map((record) => [record.riderName.trim(), record]));
  const targetRiders = riders.filter((rider) => isHighRisk(rider.riskLevel) || isCautionRisk(rider.riskLevel));
  const totalChecklistItems = managerActionChecklistItems.length;
  const checklistGaps = targetRiders.map((rider) => {
    const record = actionRecordMap.get(rider.riderName.trim());
    const checkedCount = Math.min(record?.checkedItems.length ?? 0, totalChecklistItems);
    return {
      riderName: rider.riderName,
      incompleteCount: Math.max(0, totalChecklistItems - checkedCount)
    };
  });
  const incompleteChecklistItemCount = checklistGaps.reduce((sum, item) => sum + item.incompleteCount, 0);
  const dataWarnings = input.dataWarnings.map((warning) => warning.message).filter((message) => message.trim().length > 0);
  const riskRiderSummaries = riders
    .filter((rider) => isHighRisk(rider.riskLevel) || isCautionRisk(rider.riskLevel) || isDecliningTrend(String(rider.trendLabel ?? "")))
    .sort((a, b) => {
      const riskRank = Number(isHighRisk(b.riskLevel)) - Number(isHighRisk(a.riskLevel));
      if (riskRank) return riskRank;
      return a.changeRate - b.changeRate;
    })
    .slice(0, 5)
    .map((rider) => ({
      riderName: rider.riderName,
      riskLevel: rider.riskLevel,
      currentWeekCompleted: rider.currentWeekCompleted,
      changeRate: rider.changeRate,
      trendLabel: rider.trendLabel,
      riskReasons: rider.riskReasons,
      recommendedManagerActions: rider.recommendedManagerActions
    }));
  const pendingCount = pendingQueue.length;
  const sentCount = weeklyQueue.filter((item) => item.sendStatus === "발송완료").length;
  const dataWarningCount = dataWarnings.length;
  const highRiskRiderCount = riders.filter((rider) => isHighRisk(rider.riskLevel)).length;
  const priorityActionHints = buildPriorityActionHints({
    highRiskCount: highRiskRiderCount,
    unsentCount: pendingCount,
    dataWarningCount,
    incompleteChecklistItemCount
  });

  return {
    weekKey,
    summaryStats: {
      totalRiderCount: riders.length,
      highRiskRiderCount,
      cautionRiderCount: riders.filter((rider) => isCautionRisk(rider.riskLevel)).length,
      stableRiderCount: riders.filter((rider) => isStableRisk(rider.riskLevel)).length,
      decliningRiderCount: riders.filter((rider) => isDecliningTrend(String(rider.trendLabel ?? ""))).length,
      recoveringRiderCount: riders.filter((rider) => isRecoveringTrend(String(rider.trendLabel ?? ""))).length,
      newOrReturningRiderCount: riders.filter((rider) => isNewOrReturningTrend(String(rider.trendLabel ?? ""))).length,
      dataWarningCount,
      unsentQueueCount: pendingCount,
      sentQueueCount: sentCount,
      incompleteChecklistItemCount,
      weeklyAICoachingGeneratedCount: input.coachingHistory.filter((entry) => sameWeek(entry.weekKey, weekKey)).length
    },
    riskRiderSummaries,
    messageQueueStats: {
      totalCount: weeklyQueue.length,
      pendingCount,
      sentCount,
      heldCount: weeklyQueue.filter((item) => item.sendStatus === "보류").length,
      highRiskPendingCount: pendingQueue.filter((item) => isHighRisk(String(item.riskLevel))).length
    },
    actionChecklistStats: {
      targetRiderCount: targetRiders.length,
      incompleteRiderCount: checklistGaps.filter((item) => item.incompleteCount > 0).length,
      incompleteItemCount: incompleteChecklistItemCount
    },
    dataWarnings,
    priorityActionHints,
    monthlyReportSummary: input.monthlyReportSummary
  };
}

export function createTemplateOperationBriefing(weekKey: string, summary: OperationBriefingSummaryInput): OperationBriefingResult {
  const stats = summary.summaryStats;
  const priorityActions = normalizeActions(summary.priorityActionHints);
  return {
    weekKey,
    executiveSummary: `${weekKey} 기준 전체 ${formatNumber(stats.totalRiderCount)}명 중 고위험 ${formatNumber(stats.highRiskRiderCount)}명, 관리주의 ${formatNumber(stats.cautionRiderCount)}명입니다. 미발송 ${formatNumber(stats.unsentQueueCount)}건과 체크리스트 미완료 ${formatNumber(stats.incompleteChecklistItemCount)}건을 우선 확인하세요.`,
    managerBriefing: `최근 4주 흐름 기준 하락세 ${formatNumber(stats.decliningRiderCount)}명, 회복세 ${formatNumber(stats.recoveringRiderCount)}명, 신규/복귀 ${formatNumber(stats.newOrReturningRiderCount)}명입니다. AI 코칭 생성 ${formatNumber(stats.weeklyAICoachingGeneratedCount)}건과 데이터 검수 경고 ${formatNumber(stats.dataWarningCount)}건을 함께 확인해야 합니다.`,
    priorityActions,
    riskFocus:
      summary.riskRiderSummaries.length > 0
        ? summary.riskRiderSummaries.map((rider) => `${rider.riderName}(${rider.riskLevel}/${rider.trendLabel ?? "추세 확인"})`).join(", ")
        : "이번 주 집중 위험 라이더는 없습니다.",
    messageQueueAdvice:
      stats.unsentQueueCount > 0
        ? `발송 대기함 미발송 ${formatNumber(stats.unsentQueueCount)}건 중 고위험 미발송 ${formatNumber(summary.messageQueueStats.highRiskPendingCount)}건을 먼저 처리하세요.`
        : "발송 대기함의 미발송 항목은 없습니다.",
    dataQualityNotes:
      stats.dataWarningCount > 0 ? summary.dataWarnings.slice(0, 3).join(" / ") : "현재 표시할 데이터 검수 경고는 없습니다.",
    isTemplate: true,
    source: "template",
    fallbackUsed: true,
    fallbackReason: "AI_MODE_TEMPLATE",
    templateVersion: "v1",
    createdAt: new Date().toISOString()
  };
}

export function createOperationBriefingEntry(
  briefing: OperationBriefingResult,
  summary: OperationBriefingSummaryInput,
  createdBy = "관리자"
): LocalOperationBriefingEntry {
  return {
    ...briefing,
    id: `operation-briefing-${briefing.weekKey}-${briefing.createdAt}-${Math.random().toString(36).slice(2)}`,
    createdBy,
    summary
  };
}

export function formatExecutiveOperationBriefingText(briefing: OperationBriefingResult, summary: OperationBriefingSummaryInput) {
  return [
    "[라이더 코칭센터 주간 운영 요약]",
    "이번 주 핵심 변화:",
    `- ${briefing.executiveSummary}`,
    "우선 관리 대상:",
    `- 고위험 ${formatNumber(summary.summaryStats.highRiskRiderCount)}명 / 관리주의 ${formatNumber(summary.summaryStats.cautionRiderCount)}명`,
    "진행 필요 액션:",
    ...briefing.priorityActions.slice(0, 3).map((action) => `- ${action}`),
    "AI 운영본부 제안:",
    `- ${briefing.managerBriefing}`
  ].join("\n");
}

export function formatManagerOperationBriefingText(briefing: OperationBriefingResult, summary: OperationBriefingSummaryInput) {
  return [
    `[${summary.weekKey} AI 운영본부 브리핑]`,
    `전체 ${formatNumber(summary.summaryStats.totalRiderCount)}명 · 고위험 ${formatNumber(summary.summaryStats.highRiskRiderCount)}명 · 미발송 ${formatNumber(summary.summaryStats.unsentQueueCount)}건`,
    "",
    `핵심 요약: ${briefing.executiveSummary}`,
    `관리 브리핑: ${briefing.managerBriefing}`,
    `위험 집중: ${briefing.riskFocus}`,
    `발송 조언: ${briefing.messageQueueAdvice}`,
    `데이터 검수: ${briefing.dataQualityNotes}`,
    "",
    "오늘의 우선 조치",
    ...briefing.priorityActions.slice(0, 3).map((action, index) => `${index + 1}. ${action}`)
  ].join("\n");
}
