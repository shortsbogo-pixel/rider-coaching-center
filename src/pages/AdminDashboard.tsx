import { useEffect, useMemo, useState } from "react";
import { ChevronUp, Menu } from "lucide-react";
import orders from "../data/sampleOrders.json";
import riders from "../data/sampleRiders.json";
import { MetricCard } from "../components/common/MetricCard";
import { RequiredColumnHealth } from "../components/common/RequiredColumnHealth";
import { SectionHeader } from "../components/common/SectionHeader";
import { AICoachingHistoryPanel } from "../components/admin/AICoachingHistoryPanel";
import { AIStatusPanel } from "../components/admin/AIStatusPanel";
import { DataQualityWarningPanel } from "../components/admin/DataQualityWarningPanel";
import { ManagerActionChecklist } from "../components/admin/ManagerActionChecklist";
import { MessageCopyPanel } from "../components/admin/MessageCopyPanel";
import { MessageQueuePanel } from "../components/admin/MessageQueuePanel";
import { MonthlyOperationReportPanel } from "../components/admin/MonthlyOperationReport";
import { OperationBackupPanel } from "../components/admin/OperationBackupPanel";
import { OperationDataCheckPanel } from "../components/admin/OperationDataCheckPanel";
import { OperationLogsPanel } from "../components/admin/OperationLogsPanel";
import { OperationMigrationPanel } from "../components/admin/OperationMigrationPanel";
import { OperationStorageStatus } from "../components/admin/OperationStorageStatus";
import { RiderAnalysisReasonPanel } from "../components/admin/RiderAnalysisReasonPanel";
import { RiskBadge } from "../components/admin/RiskBadge";
import { WeeklyAIBriefingPanel } from "../components/admin/WeeklyAIBriefingPanel";
import type { UploadedWeekSummary } from "../types/newWeekBriefing";
import type { MessageQueueItem, MessageSendChannel, MessageSendHistoryEntry } from "../types/messageQueue";
import type { OrderRecord, TimeSegment } from "../types/order";
import type { RiderGrade, RiderMetrics, RiderProfile, RiderRiskLevel } from "../types/rider";
import type {
  AICoachingHistoryEntry,
  AICoachingSource,
  LocalAICoachingHistoryEntry,
  LocalWeeklyAIBriefingEntry,
  WeeklyAIBriefingResult
} from "../types/aiCoaching";
import type { MigrationResult, OperationActionType, OperationSaveStatus } from "../types/operation";
import { getAuthHeader } from "../utils/authStore";
import {
  createAICoachingHistoryEntry,
  getLatestAICoachingHistoryForRiderWeek,
  readAICoachingHistoryEntries,
  saveAICoachingHistoryEntry
} from "../utils/aiCoachingHistory";
import { sortAdminRiderItems, type AdminRiderSortOption } from "../utils/adminRiderSort";
import {
  buildMonthlyOperationReportSummary,
  createTemplateMonthlyOperationReport,
  formatMonthlyOperationReportText,
  type MonthlyOperationReport
} from "../utils/monthlyOperationReport";
import {
  createMonthlyReportEntry,
  readMonthlyReportEntries,
  saveMonthlyReportEntry,
  type LocalMonthlyReportEntry
} from "../utils/monthlyReportHistory";
import { buildLunchMissionBrief, getUploadHealth, getWeakestAction } from "../utils/newWeekBriefingAnalyzer";
import { readManagerActionChecklistRecords, saveManagerActionChecklist } from "../utils/managerActionChecklist";
import type { ManagerActionChecklistRecord } from "../utils/managerActionChecklist";
import { operationApi, writeOperationLog } from "../utils/operationApi";
import { messageQueueApi } from "../utils/messageQueueApi";
import {
  createMessageQueueItem,
  createSendHistoryEntry,
  deleteMessageQueueItem,
  hasDuplicateMessageQueueItem,
  readMessageQueueItems,
  readMessageSendHistoryEntries,
  saveMessageQueueItem,
  saveMessageSendHistoryEntry,
  updateMessageQueueItem
} from "../utils/messageQueueStorage";
import { buildOperationDataCheckItems } from "../utils/operationDataValidator";
import {
  buildAICoachingAnalysisContext,
  buildDataQualityWarnings,
  buildRiderTrendAnalysis,
  buildRiderTrendAnalysisMap,
  type AICoachingAnalysisContext
} from "../utils/riderTrendAnalysis";
import { buildRiderMetrics, getGradeLabel } from "../utils/scoring";
import { buildWeeklyBriefingSummary, createTemplateWeeklyAIBriefing } from "../utils/weeklyBriefingSummary";
import {
  createWeeklyAIBriefingEntry,
  readWeeklyAIBriefingEntries,
  saveWeeklyAIBriefingEntry
} from "../utils/weeklyBriefingHistory";
import { getLatestWeekKey, sortWeekKeys } from "../utils/weekSelector";

const fallbackMetrics = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[]);
const segments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];
const trackedSegments: TimeSegment[] = ["Lunch_Peak", "Post_Lunch", "Post_Dinner"];
const gradeOrder: RiderGrade[] = ["S", "A", "B", "C", "MANAGEMENT_TARGET"];
const WEEKLY_BRIEFING_LOG_KEY = "admin-weekly-briefing-threshold-log";

interface WeeklyBriefingCard {
  id: string;
  title: string;
  type: string;
  tone: "danger" | "good" | "default";
  changeRateLabel: string;
  changeRateValue: number;
  lines: string[];
  reason: string;
  action: string;
  // optional metadata for rider-specific briefing cards
  riderId?: string;
  riderName?: string;
  previousCompleted?: number;
  currentCompleted?: number;
  changeRatePercent?: number | null;
  riskLevel?: RiderRiskLevel;
}

interface ThresholdLog {
  id: string;
  changedAt: string;
  message: string;
  riskThreshold: number;
  opportunityThreshold: number;
}

interface AICoachingResultState {
  adminMessage: string;
  riderMessage: string;
  isTemplate: boolean;
  source?: AICoachingSource;
  createdAt?: string;
}

interface AICopyStatusState {
  adminCopied?: boolean;
  riderCopied?: boolean;
}

type AdminTopicId = "briefing" | "operation" | "analysis" | "riders";
type AdminTopicState = Record<AdminTopicId, boolean>;

const adminTopicIds: AdminTopicId[] = ["briefing", "operation", "analysis", "riders"];
const adminTopicLabels: Record<AdminTopicId, { label: string; shortLabel: string; caption: string }> = {
  briefing: { label: "기준 주차·주간 브리핑", shortLabel: "브리핑", caption: "15장 카드" },
  operation: { label: "운영지표·전주 대비 변화", shortLabel: "운영", caption: "핵심 KPI" },
  analysis: { label: "누적·등급·구간 분석", shortLabel: "분석", caption: "보조 지표" },
  riders: { label: "라이더 위험도 요약", shortLabel: "라이더", caption: "급변화 라이더" }
};

const riderSortOptions: Array<{ value: AdminRiderSortOption; label: string }> = [
  { value: "risk-first", label: "고위험 우선" },
  { value: "decline-first", label: "하락폭 큰 순" },
  { value: "low-completed", label: "완료건수 낮은 순" },
  { value: "recent-ai", label: "최근 AI 코칭 생성순" },
  { value: "default", label: "기본 순서" }
];

function createAdminTopicState(openTopic: AdminTopicId = "briefing"): AdminTopicState {
  return adminTopicIds.reduce(
    (state, topicId) => ({
      ...state,
      [topicId]: topicId === openTopic
    }),
    {} as AdminTopicState
  );
}

function createClosedAdminTopicState(): AdminTopicState {
  return adminTopicIds.reduce(
    (state, topicId) => ({
      ...state,
      [topicId]: false
    }),
    {} as AdminTopicState
  );
}

function getInitialCompactAdminLayout() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(max-width: 759px)").matches;
}

function getCurrentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "비교 불가";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatBriefingRate(value: number | null) {
  if (value === null) return "신규";
  if (!Number.isFinite(value)) return "비교 불가";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getTrendTone(label: string) {
  if (label === "급락" || label === "하락세" || label === "확인 필요") return "danger";
  if (label === "데이터 부족") return "warning";
  if (label === "회복세" || label === "안정") return "good";
  return "default";
}

function formatDelta(value: number, unit: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${unit}`;
}

function formatChange(current: number, previous: number, unit: string) {
  const delta = current - previous;
  if (!previous) {
    return {
      line: `${formatNumber(previous)}${unit} → ${formatNumber(current)}${unit}`,
      detail: current ? "신규" : "비교 불가",
      delta
    };
  }

  if (!delta) {
    return {
      line: `${formatNumber(previous)}${unit} → ${formatNumber(current)}${unit}`,
      detail: "변동 없음",
      delta
    };
  }

  return {
    line: `${formatNumber(previous)}${unit} → ${formatNumber(current)}${unit}`,
    detail: `${formatDelta(delta, unit)} / ${formatRate((delta / previous) * 100)}`,
    delta
  };
}

function getActiveRiderCount(metrics: RiderMetrics[]) {
  return metrics.filter((metric) => metric.totalCompleted > 0).length;
}

function getMultiCompleted(metrics: RiderMetrics[]) {
  return metrics.reduce(
    (sum, metric) =>
      sum +
      Object.entries(metric.deliveryTypeCompleted)
        .filter(([type]) => type.includes("멀티"))
        .reduce((innerSum, [, count]) => innerSum + count, 0),
    0
  );
}

function getAverageScore(metrics: RiderMetrics[]) {
  if (!metrics.length) return 0;
  return Math.round(metrics.reduce((sum, metric) => sum + metric.dispatchScore, 0) / metrics.length);
}

function getAttendanceCount(metric?: RiderMetrics) {
  if (!metric) return 0;
  return Object.values(metric.weekdayCompleted).filter((count) => count > 0).length;
}

function getMetricByRider(metrics: RiderMetrics[], rider: RiderMetrics) {
  return (
    metrics.find((item) => item.riderId === rider.riderId) ??
    metrics.find((item) => item.baseName === rider.baseName) ??
    metrics.find((item) => item.displayName === rider.displayName)
  );
}

function buildSegmentChange(currentMetrics: RiderMetrics[], previousMetrics: RiderMetrics[], direction: "up" | "down") {
  const changes = trackedSegments.map((segment) => {
    const current = currentMetrics.reduce((sum, metric) => sum + metric.segmentCompleted[segment], 0);
    const previous = previousMetrics.reduce((sum, metric) => sum + metric.segmentCompleted[segment], 0);
    return { segment, current, previous, delta: current - previous };
  });

  const sorted = [...changes].sort((a, b) => (direction === "up" ? b.delta - a.delta : a.delta - b.delta));
  return sorted[0];
}

function getRiskPriority(metric: RiderMetrics) {
  if (metric.riderGrade === "MANAGEMENT_TARGET" || metric.riskLevel === "고위험") return 4;
  if (metric.riskLevel === "관리주의") return 3;
  if (metric.riderGrade === "C") return 2;
  return 1;
}

function loadThresholdLogs(): ThresholdLog[] {
  try {
    const raw = window.localStorage.getItem(WEEKLY_BRIEFING_LOG_KEY);
    return raw ? (JSON.parse(raw) as ThresholdLog[]) : [];
  } catch {
    return [];
  }
}

function saveThresholdLogs(logs: ThresholdLog[]) {
  try {
    window.localStorage.setItem(WEEKLY_BRIEFING_LOG_KEY, JSON.stringify(logs));
  } catch {
    // Local logging is best-effort for this MVP.
  }
}

function buildWeeklyBriefingCards(
  currentMetrics: RiderMetrics[],
  previousMetrics: RiderMetrics[],
  riskThreshold: number,
  opportunityThreshold: number
): WeeklyBriefingCard[] {
  const currentCompletedTotal = currentMetrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const previousCompletedTotal = previousMetrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const completedChange = formatChange(currentCompletedTotal, previousCompletedTotal, "건");
  const currentActiveRiders = getActiveRiderCount(currentMetrics);
  const previousActiveRiders = getActiveRiderCount(previousMetrics);
  const activeRiderChange = formatChange(currentActiveRiders, previousActiveRiders, "명");
  const currentMultiCompleted = getMultiCompleted(currentMetrics);
  const previousMultiCompleted = getMultiCompleted(previousMetrics);
  const currentMultiRate = currentCompletedTotal ? (currentMultiCompleted / currentCompletedTotal) * 100 : 0;
  const previousMultiRate = previousCompletedTotal ? (previousMultiCompleted / previousCompletedTotal) * 100 : 0;
  const currentScore = getAverageScore(currentMetrics);
  const previousScore = getAverageScore(previousMetrics);
  const scoreChange = formatChange(currentScore, previousScore, "점");

  const operationCards: WeeklyBriefingCard[] = [
    {
      id: "operation-summary",
      title: "선택 주차 운영지표",
      type: "운영지표",
      tone: "default",
      changeRateLabel: completedChange.detail,
      changeRateValue: completedChange.delta,
      lines: [
        `완료 ${formatNumber(currentCompletedTotal)}건`,
        `운영 라이더 ${formatNumber(currentActiveRiders)}명`,
        `멀티율 ${currentMultiRate.toFixed(1)}%`,
        `평균 점수 ${currentScore}점`
      ],
      reason: "현재 선택 주차의 운영 판단 기준값입니다.",
      action: "이 값과 아래 전주 대비 변화를 함께 확인하세요."
    },
    {
      id: "operation-completed-change",
      title: "전주 대비 완료 변화",
      type: "전주 대비 변화",
      tone: completedChange.delta < 0 ? "danger" : completedChange.delta > 0 ? "good" : "default",
      changeRateLabel: completedChange.detail,
      changeRateValue: completedChange.delta,
      lines: [completedChange.line, `멀티 ${previousMultiRate.toFixed(1)}% → ${currentMultiRate.toFixed(1)}%`],
      reason: "전체 완료건수의 주간 증감입니다.",
      action: completedChange.delta < 0 ? "감소 원인을 구간별 카드와 함께 확인하세요." : "증가 구간과 기여 라이더를 확인하세요."
    },
    {
      id: "operation-rider-score-change",
      title: "운영 라이더·점수 변화",
      type: "전주 대비 변화",
      tone: activeRiderChange.delta < 0 || scoreChange.delta < 0 ? "danger" : activeRiderChange.delta > 0 || scoreChange.delta > 0 ? "good" : "default",
      changeRateLabel: activeRiderChange.detail,
      changeRateValue: activeRiderChange.delta + scoreChange.delta,
      lines: [activeRiderChange.line, scoreChange.line],
      reason: "출근 규모와 배차 친화 점수의 동시 변화입니다.",
      action: "운영 라이더가 줄었거나 점수가 떨어진 경우 대상자를 우선 확인하세요."
    }
  ];

  const segmentCards: WeeklyBriefingCard[] = segments.map((segment) => {
    const current = currentMetrics.reduce((sum, metric) => sum + metric.segmentCompleted[segment], 0);
    const previous = previousMetrics.reduce((sum, metric) => sum + metric.segmentCompleted[segment], 0);
    const change = formatChange(current, previous, "건");
    return {
      id: `segment-${segment}`,
      title: `${segment} 콜 수행 변화`,
      type: "구간별 콜수행변화",
      tone: change.delta < 0 ? "danger" : change.delta > 0 ? "good" : "default",
      changeRateLabel: change.detail,
      changeRateValue: change.delta,
      lines: [change.line],
      reason: `${segment} 구간의 전주 대비 수행량 변화입니다.`,
      action: change.delta < 0 ? "감소 구간은 미션 또는 코칭 메시지로 보강하세요." : "증가 구간은 유지 가능한 패턴인지 확인하세요."
    };
  });

  const riderCards = currentMetrics.map((metric): WeeklyBriefingCard => {
    const previous = getMetricByRider(previousMetrics, metric);
    const previousCompleted = previous?.totalCompleted ?? 0;
    const currentCompleted = metric.totalCompleted;
    const delta = currentCompleted - previousCompleted;
    const changeRate = previousCompleted ? (delta / previousCompleted) * 100 : currentCompleted ? null : 0;
    const sortValue = changeRate ?? 999;
    const previousAttendance = getAttendanceCount(previous);
    const currentAttendance = getAttendanceCount(metric);
    const attendanceDelta = currentAttendance - previousAttendance;
    const attendanceRate = previousAttendance ? (attendanceDelta / previousAttendance) * 100 : currentAttendance ? null : 0;
    const completedLine = `완료 ${formatNumber(previousCompleted)}건 → ${formatNumber(currentCompleted)}건`;
    const attendanceLine = `출근 ${previousAttendance}회 → ${currentAttendance}회 (${formatBriefingRate(attendanceRate)})`;

    if (changeRate !== null && changeRate <= riskThreshold) {
      return {
        id: `rider-${metric.riderId}`,
        title: metric.displayName,
        type: "완료 급감 위험",
        tone: "danger" as const,
        changeRateLabel: formatBriefingRate(changeRate),
        changeRateValue: sortValue,
        lines: [completedLine, attendanceLine],
        reason: `전주 대비 완료건수 ${formatNumber(Math.abs(delta))}건 감소`,
        action: "피크 이후 이탈 원인을 확인하고 보강 메시지를 준비하세요.",
        riderId: metric.riderId,
        riderName: metric.displayName,
        previousCompleted,
        currentCompleted,
        changeRatePercent: changeRate,
        riskLevel: metric.riskLevel
      };
    }

    if (changeRate === null || changeRate >= opportunityThreshold) {
      return {
        id: `rider-${metric.riderId}`,
        title: metric.displayName,
        type: "성장 기회",
        tone: "good" as const,
        changeRateLabel: formatBriefingRate(changeRate),
        changeRateValue: sortValue,
        lines: [completedLine, attendanceLine],
        reason: changeRate === null ? "직전 주차 기록 없이 신규 운행 발생" : `전주 대비 완료건수 ${formatNumber(delta)}건 증가`,
        action: "상승 패턴을 유지하도록 미션 후보로 검토하세요.",
        riderId: metric.riderId,
        riderName: metric.displayName,
        previousCompleted,
        currentCompleted,
        changeRatePercent: changeRate ?? 0,
        riskLevel: metric.riskLevel
      };
    }

    return {
      id: `rider-${metric.riderId}`,
      title: metric.displayName,
      type: "변화 관찰",
      tone: "default" as const,
      changeRateLabel: formatBriefingRate(changeRate),
      changeRateValue: sortValue,
      lines: [completedLine, attendanceLine],
      reason: `전주 대비 완료건수 ${formatDelta(delta, "건")}`,
      action: "다음 주에도 같은 흐름인지 관찰하세요.",
      riderId: metric.riderId,
      riderName: metric.displayName,
      previousCompleted,
      currentCompleted,
      changeRatePercent: changeRate ?? 0,
      riskLevel: metric.riskLevel
    };
  });

  const risks = riderCards
    .filter((card) => card.type === "완료 급감 위험")
    .sort((a, b) => a.changeRateValue - b.changeRateValue);
  const opportunities = riderCards
    .filter((card) => card.type === "성장 기회")
    .sort((a, b) => b.changeRateValue - a.changeRateValue);
  const observations = riderCards
    .filter((card) => card.type === "변화 관찰")
    .sort((a, b) => Math.abs(b.changeRateValue) - Math.abs(a.changeRateValue));
  const riderHighlights = [...risks, ...opportunities, ...observations].slice(0, 7);
  const currentAttendanceTotal = currentMetrics.reduce((sum, metric) => sum + getAttendanceCount(metric), 0);
  const previousAttendanceTotal = previousMetrics.reduce((sum, metric) => sum + getAttendanceCount(metric), 0);
  const attendanceChange = formatChange(currentAttendanceTotal, previousAttendanceTotal, "회");
  const multiCompletedChange = formatChange(currentMultiCompleted, previousMultiCompleted, "건");
  const managementTargets = currentMetrics.filter((metric) => metric.riderGrade === "MANAGEMENT_TARGET");
  const topCompletedRider = [...currentMetrics].sort((a, b) => b.totalCompleted - a.totalCompleted)[0];
  const topMultiRider = [...currentMetrics].sort((a, b) => b.multiDeliveryRate - a.multiDeliveryRate)[0];
  const topScoreRider = [...currentMetrics].sort((a, b) => b.dispatchScore - a.dispatchScore)[0];
  const supportCards: WeeklyBriefingCard[] = [
    {
      id: "support-attendance-total",
      title: "전체 출근 횟수 변화",
      type: "출근횟수",
      tone: attendanceChange.delta < 0 ? "danger" : attendanceChange.delta > 0 ? "good" : "default",
      changeRateLabel: attendanceChange.detail,
      changeRateValue: attendanceChange.delta,
      lines: [attendanceChange.line],
      reason: "라이더별 출근일 합계의 주간 변화입니다.",
      action: "출근 횟수가 줄면 완료건수 감소 카드와 함께 확인하세요."
    },
    {
      id: "support-multi-completed",
      title: "멀티 수행 변화",
      type: "운영지표",
      tone: multiCompletedChange.delta < 0 ? "danger" : multiCompletedChange.delta > 0 ? "good" : "default",
      changeRateLabel: multiCompletedChange.detail,
      changeRateValue: multiCompletedChange.delta,
      lines: [multiCompletedChange.line, `멀티율 ${previousMultiRate.toFixed(1)}% → ${currentMultiRate.toFixed(1)}%`],
      reason: "멀티 완료건수와 멀티율의 동시 변화입니다.",
      action: "멀티 수행이 줄면 피크 이후 구간 카드와 같이 보세요."
    },
    {
      id: "support-management-targets",
      title: "관리대상 규모",
      type: "위험도",
      tone: managementTargets.length ? "danger" : "default",
      changeRateLabel: `${formatNumber(managementTargets.length)}명`,
      changeRateValue: managementTargets.length,
      lines: [`운영 라이더 ${formatNumber(currentActiveRiders)}명 중 ${formatNumber(managementTargets.length)}명`],
      reason: "선택 주차 기준 관리대상 등급 라이더 수입니다.",
      action: "관리대상은 코칭 화면에서 개인별 메시지를 먼저 확인하세요."
    },
    {
      id: "support-top-completed-rider",
      title: "완료건수 상위 라이더",
      type: "라이더 참고",
      tone: "good",
      changeRateLabel: topCompletedRider ? `${formatNumber(topCompletedRider.totalCompleted)}건` : "데이터 없음",
      changeRateValue: topCompletedRider?.totalCompleted ?? 0,
      lines: [topCompletedRider ? `${topCompletedRider.displayName} · 출근 ${getAttendanceCount(topCompletedRider)}회` : "현재 주차 운행 데이터가 없습니다."],
      reason: "선택 주차에서 완료건수가 가장 높은 라이더입니다.",
      action: "상위 패턴을 다른 성장 후보와 비교하세요."
    },
    {
      id: "support-top-multi-rider",
      title: "멀티율 상위 라이더",
      type: "라이더 참고",
      tone: "good",
      changeRateLabel: topMultiRider ? `${(topMultiRider.multiDeliveryRate * 100).toFixed(1)}%` : "데이터 없음",
      changeRateValue: topMultiRider ? topMultiRider.multiDeliveryRate * 100 : 0,
      lines: [topMultiRider ? `${topMultiRider.displayName} · 완료 ${formatNumber(topMultiRider.totalCompleted)}건` : "현재 주차 운행 데이터가 없습니다."],
      reason: "선택 주차에서 멀티 비중이 가장 높은 라이더입니다.",
      action: "멀티 수행 유지 메시지나 미션 후보로 검토하세요."
    },
    {
      id: "support-top-score-rider",
      title: "배차 친화 점수 상위",
      type: "라이더 참고",
      tone: "good",
      changeRateLabel: topScoreRider ? `${topScoreRider.dispatchScore}점` : "데이터 없음",
      changeRateValue: topScoreRider?.dispatchScore ?? 0,
      lines: [topScoreRider ? `${topScoreRider.displayName} · ${getGradeLabel(topScoreRider.riderGrade)}` : "현재 주차 운행 데이터가 없습니다."],
      reason: "선택 주차에서 배차 친화 점수가 가장 높은 라이더입니다.",
      action: "우수 패턴을 주간 브리핑 참고값으로 활용하세요."
    },
    {
      id: "support-threshold-setting",
      title: "브리핑 임계값",
      type: "설정",
      tone: "default",
      changeRateLabel: `${riskThreshold}% / +${opportunityThreshold}%`,
      changeRateValue: opportunityThreshold - riskThreshold,
      lines: [`위험 ${riskThreshold}% 이하`, `기회 +${opportunityThreshold}% 이상`],
      reason: "현재 카드 분류에 적용된 슬라이더 기준입니다.",
      action: "운영 상황에 맞춰 조정하면 로그에 기록됩니다."
    }
  ];

  const baseCards = [...operationCards, ...segmentCards, ...riderHighlights];
  return [...baseCards, ...supportCards].slice(0, 15);
}

export function AdminDashboard() {
  const [allMetrics, setAllMetrics] = useState<RiderMetrics[]>(fallbackMetrics);
  const [currentMetrics, setCurrentMetrics] = useState<RiderMetrics[]>(fallbackMetrics);
  const [previousMetrics, setPreviousMetrics] = useState<RiderMetrics[]>([]);
  const [uploadedWeeks, setUploadedWeeks] = useState<UploadedWeekSummary[]>([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");
  const [riskThreshold, setRiskThreshold] = useState(-20);
  const [opportunityThreshold, setOpportunityThreshold] = useState(10);
  const [thresholdLogs, setThresholdLogs] = useState<ThresholdLog[]>(loadThresholdLogs);
  const [isCompactAdminLayout, setIsCompactAdminLayout] = useState(getInitialCompactAdminLayout);
  const [openAdminTopics, setOpenAdminTopics] = useState<AdminTopicState>(() => createClosedAdminTopicState());
  const [riderSortOption, setRiderSortOption] = useState<AdminRiderSortOption>("risk-first");
  const [localAICoachingHistory, setLocalAICoachingHistory] = useState<LocalAICoachingHistoryEntry[]>(() => readAICoachingHistoryEntries());
  const [localWeeklyBriefingHistory, setLocalWeeklyBriefingHistory] = useState<LocalWeeklyAIBriefingEntry[]>(() => readWeeklyAIBriefingEntries());
  const [localMonthlyReportHistory, setLocalMonthlyReportHistory] = useState<LocalMonthlyReportEntry[]>(() => readMonthlyReportEntries());
  const [weeklyBriefingLoading, setWeeklyBriefingLoading] = useState(false);
  const [weeklyBriefingError, setWeeklyBriefingError] = useState("");
  const [weeklyBriefingCopyStatus, setWeeklyBriefingCopyStatus] = useState("");
  const [managerActionRevision, setManagerActionRevision] = useState(0);
  const [operationMemo, setOperationMemo] = useState("");
  const [monthlyReportLoading, setMonthlyReportLoading] = useState(false);
  const [monthlyReportError, setMonthlyReportError] = useState("");
  const [monthlyReportCopyStatus, setMonthlyReportCopyStatus] = useState("");
  const [monthlyReportCopyFailed, setMonthlyReportCopyFailed] = useState(false);
  const [monthlyReportManualText, setMonthlyReportManualText] = useState("");
  const [operationSaveStatus, setOperationSaveStatus] = useState<OperationSaveStatus>("server");
  const [operationSaveDetail, setOperationSaveDetail] = useState("서버 저장을 우선 사용합니다.");
  const [operationLogRevision, setOperationLogRevision] = useState(0);
  const [messageQueueItems, setMessageQueueItems] = useState<MessageQueueItem[]>(() => readMessageQueueItems());
  const [messageSendHistory, setMessageSendHistory] = useState<MessageSendHistoryEntry[]>(() => readMessageSendHistoryEntries());
  const [messageQueueStatusByKey, setMessageQueueStatusByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/uploads")
      .then((response) => response.json())
      .then((data) => {
        const uploads = ((data.weeks ?? []) as UploadedWeekSummary[])
          .map((item) => ({
            ...item,
            week: item.weekKey ?? item.week
          }))
          .filter((item) => item.week);
        setUploadedWeeks(uploads);
        setSelectedWeekKey((current) => current || getLatestWeekKey(uploads.map((item) => item.week)));
      })
      .catch(() => setUploadedWeeks([]));

    fetch("/api/riders", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => setAllMetrics(data as RiderMetrics[]))
      .catch(() => setAllMetrics(fallbackMetrics));
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadOperationData() {
      const [historyResult, weeklyBriefingsResult, monthlyReportsResult, messageQueueResult, messageSendHistoryResult] = await Promise.allSettled([
        operationApi.getAICoachingHistory(),
        operationApi.getWeeklyBriefings(),
        operationApi.getMonthlyReports(),
        messageQueueApi.getQueue(),
        messageQueueApi.getSendHistory()
      ]);
      if (!mounted) return;

      if (historyResult.status === "fulfilled") {
        setLocalAICoachingHistory(historyResult.value);
      } else {
        refreshLocalAICoachingHistory();
      }

      if (weeklyBriefingsResult.status === "fulfilled") {
        setLocalWeeklyBriefingHistory(weeklyBriefingsResult.value);
      } else {
        refreshLocalWeeklyBriefingHistory();
      }

      if (monthlyReportsResult.status === "fulfilled") {
        setLocalMonthlyReportHistory(monthlyReportsResult.value);
      } else {
        refreshLocalMonthlyReportHistory();
      }

      if (messageQueueResult.status === "fulfilled") {
        setMessageQueueItems(messageQueueResult.value);
      } else {
        setMessageQueueItems(readMessageQueueItems());
      }

      if (messageSendHistoryResult.status === "fulfilled") {
        setMessageSendHistory(messageSendHistoryResult.value);
      } else {
        setMessageSendHistory(readMessageSendHistoryEntries());
      }

      const hasServerLoadFailure = [historyResult, weeklyBriefingsResult, monthlyReportsResult, messageQueueResult, messageSendHistoryResult].some((result) => result.status === "rejected");
      if (hasServerLoadFailure) {
        setOperationSaveStatus("local");
        setOperationSaveDetail("일부 서버 조회 실패로 로컬 임시 데이터를 함께 사용합니다.");
      } else {
        setOperationSaveStatus("server");
        setOperationSaveDetail("서버 저장소에서 운영 데이터를 불러왔습니다.");
      }
    }

    void loadOperationData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 759px)");
    const syncLayout = () => {
      const isCompact = mediaQuery.matches;
      setIsCompactAdminLayout(isCompact);
      if (!isCompact) return;

      setOpenAdminTopics((current) => {
        const firstOpenTopic = adminTopicIds.find((topicId) => current[topicId]);
        return firstOpenTopic ? createAdminTopicState(firstOpenTopic) : createClosedAdminTopicState();
      });
    };

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  const weekOptions = useMemo(() => sortWeekKeys(uploadedWeeks.map((item) => item.week)), [uploadedWeeks]);
  const trendSourceMetrics = allMetrics.length ? allMetrics : currentMetrics;
  const trendWeekOptions = useMemo(
    () =>
      sortWeekKeys([
        ...new Set([
          ...uploadedWeeks.map((item) => item.week).filter(Boolean),
          ...trendSourceMetrics.flatMap((metric) => Object.keys(metric.weeklyCompleted ?? {})).filter(Boolean)
        ])
      ]),
    [uploadedWeeks, trendSourceMetrics]
  );
  const riderTrendAnalysisMap = useMemo(
    () => buildRiderTrendAnalysisMap(trendSourceMetrics, selectedWeekKey, trendWeekOptions),
    [selectedWeekKey, trendSourceMetrics, trendWeekOptions]
  );
  const dataQualityWarnings = useMemo(
    () =>
      buildDataQualityWarnings({
        metrics: trendSourceMetrics,
        selectedWeekKey,
        orderedWeekKeys: trendWeekOptions
      }),
    [selectedWeekKey, trendSourceMetrics, trendWeekOptions]
  );
  const selectedWeekIndex = weekOptions.indexOf(selectedWeekKey);
  const previousWeekKey = selectedWeekIndex >= 0 ? weekOptions[selectedWeekIndex + 1] ?? "" : "";

  useEffect(() => {
    if (!selectedWeekKey) return;

    Promise.all([
      fetch(`/api/riders?weekKey=${encodeURIComponent(selectedWeekKey)}`, { headers: getAuthHeader() }),
      previousWeekKey
        ? fetch(`/api/riders?weekKey=${encodeURIComponent(previousWeekKey)}`, { headers: getAuthHeader() })
        : Promise.resolve(undefined)
    ])
      .then(async ([currentResponse, previousResponse]) => {
        setCurrentMetrics((await currentResponse.json()) as RiderMetrics[]);
        setPreviousMetrics(previousResponse ? ((await previousResponse.json()) as RiderMetrics[]) : []);
      })
      .catch(() => {
        setCurrentMetrics([]);
        setPreviousMetrics([]);
      });
  }, [previousWeekKey, selectedWeekKey]);

  useEffect(() => {
    if (!selectedWeekKey) return;
    fetch(`/api/ai-coaching/history?weekKey=${encodeURIComponent(selectedWeekKey)}`, { headers: getAuthHeader() })
      .then((response) => response.ok ? response.json() : [])
      .then((history: AICoachingHistoryEntry[]) => {
        const restored = history.reduce<Record<string, AICoachingResultState>>((acc, item) => {
          acc[`rider-${item.riderId}`] = {
            adminMessage: item.adminMessage,
            riderMessage: item.riderMessage,
            isTemplate: item.isTemplate,
            source: item.isTemplate ? "template" : "gemma4",
            createdAt: item.generatedAt
          };
          return acc;
        }, {});
        setAiResultById((current) => ({ ...current, ...restored }));
      })
      .catch(() => {
        // ignore history load failures
      });
  }, [selectedWeekKey]);

  const currentCompleted = currentMetrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const previousCompleted = previousMetrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const currentActiveRiderCount = getActiveRiderCount(currentMetrics);
  const previousActiveRiderCount = getActiveRiderCount(previousMetrics);
  const currentMultiCompleted = getMultiCompleted(currentMetrics);
  const currentMultiRatio = currentCompleted ? (currentMultiCompleted / currentCompleted) * 100 : 0;
  const previousMultiCompleted = getMultiCompleted(previousMetrics);
  const previousMultiRatio = previousCompleted ? (previousMultiCompleted / previousCompleted) * 100 : 0;
  const currentAverageScore = getAverageScore(currentMetrics);
  const previousAverageScore = getAverageScore(previousMetrics);

  const allCompleted = allMetrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const allActiveRiderCount = getActiveRiderCount(allMetrics);
  const allMultiCompleted = getMultiCompleted(allMetrics);
  const allMultiRatio = allCompleted ? (allMultiCompleted / allCompleted) * 100 : 0;

  const latestUpload = uploadedWeeks.find((upload) => upload.week === selectedWeekKey);
  const uploadHealth = getUploadHealth(latestUpload);
  const autoTargetCount = currentMetrics.filter((metric) => metric.validationStatus === "AUTO_ANALYSIS_TARGET").length;
  const managementCount = currentMetrics.filter((metric) => metric.riderGrade === "MANAGEMENT_TARGET").length;
  const lunchMission = buildLunchMissionBrief(currentMetrics);
  const actionRequired = getWeakestAction(currentMetrics);

  const completedChange = formatChange(currentCompleted, previousCompleted, "건");
  const activeRiderChange = formatChange(currentActiveRiderCount, previousActiveRiderCount, "명");
  const scoreChange = formatChange(currentAverageScore, previousAverageScore, "점");
  const multiRatioChange = previousMultiRatio
    ? `${previousMultiRatio.toFixed(1)}% → ${currentMultiRatio.toFixed(1)}% / ${formatRate(currentMultiRatio - previousMultiRatio)}p`
    : currentMultiRatio
      ? `${currentMultiRatio.toFixed(1)}% / 신규`
      : "비교 불가";
  const decreasedSegment = buildSegmentChange(currentMetrics, previousMetrics, "down");
  const improvedSegment = buildSegmentChange(currentMetrics, previousMetrics, "up");
  const decreasedSegmentLabel = decreasedSegment?.delta < 0 ? decreasedSegment.segment : "감소 없음";
  const decreasedSegmentDetail = decreasedSegment?.delta < 0 ? formatDelta(decreasedSegment.delta, "건") : "전주 대비 감소 구간 없음";
  const improvedSegmentLabel = improvedSegment?.delta > 0 ? improvedSegment.segment : "개선 없음";
  const improvedSegmentDetail = improvedSegment?.delta > 0 ? formatDelta(improvedSegment.delta, "건") : "전주 대비 증가 구간 없음";

  const segmentTotals = useMemo(
    () =>
      segments.map((segment) => ({
        segment,
        total: currentMetrics.reduce((sum, metric) => sum + metric.segmentCompleted[segment], 0)
      })),
    [currentMetrics]
  );
  const maxSegmentTotal = Math.max(...segmentTotals.map((item) => item.total), 1);

  const gradeCounts = Object.fromEntries(
    gradeOrder.map((grade) => [grade, currentMetrics.filter((metric) => metric.riderGrade === grade).length])
  ) as Record<RiderGrade, number>;

  const riderComparisonsBase = currentMetrics.map((metric) => {
      const previous = getMetricByRider(previousMetrics, metric);
      const previousCompletedForRider = previous?.totalCompleted ?? 0;
      const change = formatChange(metric.totalCompleted, previousCompletedForRider, "건");
      const changeRate = previousCompletedForRider ? ((metric.totalCompleted - previousCompletedForRider) / previousCompletedForRider) * 100 : 0;
      const trendAnalysis =
        riderTrendAnalysisMap.get(metric.riderId) ??
        buildRiderTrendAnalysis({
          riderName: metric.displayName,
          weekKey: selectedWeekKey,
          orderedWeekKeys: trendWeekOptions,
          weeklyCompleted: metric.weeklyCompleted,
          riskLevel: metric.riskLevel,
          currentWeekCompleted: metric.totalCompleted
        });
      return {
        id: metric.riderId,
        metric,
        previousCompleted: previousCompletedForRider,
        change,
        riskLevel: metric.riskLevel,
        changeRate,
        trendAnalysis,
        currentWeekCompleted: metric.totalCompleted,
        latestAICoachingCreatedAt: getLatestLocalHistoryCreatedAt(metric.displayName, selectedWeekKey)
      };
    });

  const riderComparisons = sortAdminRiderItems(riderComparisonsBase, riderSortOption)
    .slice(0, 10);

  const weeklyBriefingCardsBase = buildWeeklyBriefingCards(currentMetrics, previousMetrics, riskThreshold, opportunityThreshold);
  const nonRiderBriefingCards = weeklyBriefingCardsBase.filter((card) => !card.riderName);
  const riderBriefingCards = weeklyBriefingCardsBase.filter((card) => card.riderName);
  const weeklyBriefingCards = [
    ...nonRiderBriefingCards,
    ...sortAdminRiderItems(
      riderBriefingCards.map((card) => ({
        ...card,
        id: card.id,
        riskLevel: card.riskLevel ?? "허용",
        changeRate: card.changeRatePercent ?? 0,
        currentWeekCompleted: card.currentCompleted ?? 0,
        latestAICoachingCreatedAt: card.riderName ? getLatestLocalHistoryCreatedAt(card.riderName, selectedWeekKey) : undefined
      })),
      riderSortOption
    )
  ];
  const managerActionRecords = useMemo(() => readManagerActionChecklistRecords(), [managerActionRevision]);

  const weeklyAIBriefingSummary = buildWeeklyBriefingSummary({
    weekKey: selectedWeekKey,
    riders: riderComparisonsBase.map(({ metric, previousCompleted, changeRate }) => ({
      riderName: metric.displayName,
      riskLevel: metric.riskLevel,
      previousWeekCompleted: previousCompleted,
      currentWeekCompleted: metric.totalCompleted,
      changeRate
    })),
    actionRecords: managerActionRecords,
    coachingHistory: localAICoachingHistory
  });
  const weeklyAIBriefingHistory = localWeeklyBriefingHistory
    .filter((entry) => entry.weekKey.trim() === selectedWeekKey.trim())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latestWeeklyAIBriefing = weeklyAIBriefingHistory[0];
  const monthlyOperationReportSummary = buildMonthlyOperationReportSummary({
    monthKey: getCurrentMonthKey(),
    coachingHistory: localAICoachingHistory,
    actionRecords: managerActionRecords,
    riders: riderComparisonsBase.map(({ metric, changeRate }) => ({
      riderName: metric.displayName,
      riskLevel: metric.riskLevel,
      currentWeekCompleted: metric.totalCompleted,
      changeRate
    })),
    operationMemo
  });
  const monthlyReportHistory = localMonthlyReportHistory
    .filter((entry) => entry.monthKey.trim() === monthlyOperationReportSummary.monthKey)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const monthlyOperationReport = monthlyReportHistory[0];
  const operationDataCheckItems = buildOperationDataCheckItems({
    currentRiderCount: currentMetrics.length,
    aiCoachingHistory: localAICoachingHistory,
    managerActions: managerActionRecords,
    weeklyBriefings: localWeeklyBriefingHistory,
    monthlyReports: localMonthlyReportHistory,
    hasLocalStorageData:
      localAICoachingHistory.length > 0 ||
      managerActionRecords.length > 0 ||
      localWeeklyBriefingHistory.length > 0 ||
      localMonthlyReportHistory.length > 0
  });

  const [aiLoadingById, setAiLoadingById] = useState<Record<string, boolean>>({});
  const [aiResultById, setAiResultById] = useState<Record<string, AICoachingResultState>>({});
  const [aiCopyStatusById, setAiCopyStatusById] = useState<Record<string, AICopyStatusState>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [batchFailures, setBatchFailures] = useState<Array<{ riderId: string; riderName: string; error: string }>>([]);
  const [historyWeekKey, setHistoryWeekKey] = useState<string>(selectedWeekKey || "");
  const [historyRiderId, setHistoryRiderId] = useState<string>("");
  const [historyEntries, setHistoryEntries] = useState<AICoachingHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>("");
  const [historyRestoreStatus, setHistoryRestoreStatus] = useState<string>("");

  function appendThresholdLog(message: string, nextRiskThreshold: number, nextOpportunityThreshold: number) {
    const log: ThresholdLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      changedAt: new Date().toISOString(),
      message,
      riskThreshold: nextRiskThreshold,
      opportunityThreshold: nextOpportunityThreshold
    };
    setThresholdLogs((current) => {
      if (
        current[0]?.message === message &&
        current[0]?.riskThreshold === nextRiskThreshold &&
        current[0]?.opportunityThreshold === nextOpportunityThreshold
      ) {
        return current;
      }
      const next = [log, ...current].slice(0, 5);
      saveThresholdLogs(next);
      return next;
    });
  }

  function normalizeRiskLevel(riskLevel: string): RiderRiskLevel {
    const validRiskLevels: RiderRiskLevel[] = ["고위험", "관리주의", "허용", "안정", "에이스"];
    return validRiskLevels.includes(riskLevel as RiderRiskLevel) ? (riskLevel as RiderRiskLevel) : "허용";
  }

  function refreshLocalAICoachingHistory() {
    setLocalAICoachingHistory(readAICoachingHistoryEntries());
  }

  function refreshLocalWeeklyBriefingHistory() {
    setLocalWeeklyBriefingHistory(readWeeklyAIBriefingEntries());
  }

  function refreshLocalMonthlyReportHistory() {
    setLocalMonthlyReportHistory(readMonthlyReportEntries());
  }

  function refreshLocalMessageQueue() {
    setMessageQueueItems(readMessageQueueItems());
  }

  function refreshLocalMessageSendHistory() {
    setMessageSendHistory(readMessageSendHistoryEntries());
  }

  function refreshOperationDataAfterRestore() {
    refreshLocalAICoachingHistory();
    refreshLocalWeeklyBriefingHistory();
    refreshLocalMonthlyReportHistory();
    refreshLocalMessageQueue();
    refreshLocalMessageSendHistory();
    setManagerActionRevision((value) => value + 1);
  }

  function setSaveStatus(status: OperationSaveStatus, detail: string) {
    setOperationSaveStatus(status);
    setOperationSaveDetail(detail);
  }

  async function audit(actionType: OperationActionType, summary: string, extra?: { riderName?: string; weekKey?: string; monthKey?: string }) {
    await writeOperationLog({ actionType, summary, ...extra });
    setOperationLogRevision((value) => value + 1);
  }

  async function saveAICoachingEntry(entry: LocalAICoachingHistoryEntry, actionType: OperationActionType = "AI_COACHING_GENERATED") {
    try {
      await operationApi.saveAICoachingHistory(entry);
      saveAICoachingHistoryEntry(entry);
      setLocalAICoachingHistory((current) => [...current.filter((item) => item.id !== entry.id), entry]);
      setSaveStatus("server", "AI 코칭 이력을 서버에 저장했습니다.");
      await audit(actionType, `${entry.riderName} AI 코칭 생성`, { riderName: entry.riderName, weekKey: entry.weekKey });
      return true;
    } catch {
      const saved = saveAICoachingHistoryEntry(entry);
      if (saved) {
        refreshLocalAICoachingHistory();
        setSaveStatus("local", "서버 저장 실패로 AI 코칭 이력을 로컬에 임시 저장했습니다.");
      } else {
        setLocalAICoachingHistory((current) => [...current, entry]);
        setSaveStatus("failed", "AI 코칭 이력 저장에 실패했습니다.");
      }
      return false;
    }
  }

  async function saveChecklistRecord(record: ManagerActionChecklistRecord) {
    try {
      await operationApi.saveActionChecklist(record);
      saveManagerActionChecklist(record.riderName, record.weekKey, record.checkedItems);
      setManagerActionRevision((value) => value + 1);
      setSaveStatus("server", "관리자 체크리스트를 서버에 저장했습니다.");
      await audit("CHECKLIST_UPDATED", `${record.riderName} 체크리스트 변경`, { riderName: record.riderName, weekKey: record.weekKey });
      return true;
    } catch {
      const saved = saveManagerActionChecklist(record.riderName, record.weekKey, record.checkedItems);
      if (saved) {
        setSaveStatus("local", "서버 저장 실패로 체크리스트를 로컬에 임시 저장했습니다.");
        return true;
      }
      setSaveStatus("failed", "체크리스트 저장에 실패했습니다.");
      return false;
    }
  }

  async function saveWeeklyBriefingEntry(entry: LocalWeeklyAIBriefingEntry) {
    try {
      await operationApi.saveWeeklyBriefing(entry);
      saveWeeklyAIBriefingEntry(entry);
      setLocalWeeklyBriefingHistory((current) => [...current.filter((item) => item.id !== entry.id), entry]);
      setSaveStatus("server", "주간 AI 브리핑을 서버에 저장했습니다.");
      await audit("WEEKLY_BRIEFING_GENERATED", `${entry.weekKey} 주간 AI 브리핑 생성`, { weekKey: entry.weekKey });
      return true;
    } catch {
      const saved = saveWeeklyAIBriefingEntry(entry);
      if (saved) {
        refreshLocalWeeklyBriefingHistory();
        setSaveStatus("local", "서버 저장 실패로 주간 브리핑을 로컬에 임시 저장했습니다.");
      } else {
        setLocalWeeklyBriefingHistory((current) => [entry, ...current]);
        setSaveStatus("failed", "주간 브리핑 저장에 실패했습니다.");
      }
      return false;
    }
  }

  async function saveMonthlyReport(entry: LocalMonthlyReportEntry) {
    try {
      await operationApi.saveMonthlyReport(entry);
      saveMonthlyReportEntry(entry);
      setLocalMonthlyReportHistory((current) => [...current.filter((item) => item.id !== entry.id), entry]);
      setSaveStatus("server", "월간 운영 리포트를 서버에 저장했습니다.");
      await audit("MONTHLY_REPORT_GENERATED", `${entry.monthKey} 월간 운영 리포트 생성`, { monthKey: entry.monthKey });
      return true;
    } catch {
      const saved = saveMonthlyReportEntry(entry);
      if (saved) {
        refreshLocalMonthlyReportHistory();
        setSaveStatus("local", "서버 저장 실패로 월간 리포트를 로컬에 임시 저장했습니다.");
      } else {
        setLocalMonthlyReportHistory((current) => [entry, ...current]);
        setSaveStatus("failed", "월간 리포트 저장에 실패했습니다.");
      }
      return false;
    }
  }

  async function migrateLocalOperationData(): Promise<MigrationResult> {
    const groups = [
      { items: readAICoachingHistoryEntries(), save: operationApi.migrateAICoachingHistory },
      { items: readManagerActionChecklistRecords(), save: operationApi.migrateActionChecklists },
      { items: readWeeklyAIBriefingEntries(), save: operationApi.migrateWeeklyBriefings },
      { items: readMonthlyReportEntries(), save: operationApi.migrateMonthlyReports }
    ];
    const result: MigrationResult = { successCount: 0, failedCount: 0, skippedCount: 0 };

    for (const group of groups) {
      if (!group.items.length) {
        result.skippedCount += 1;
        continue;
      }
      try {
        await (group.save as (items: unknown[]) => Promise<unknown>)(group.items);
        result.successCount += group.items.length;
      } catch {
        result.failedCount += group.items.length;
      }
    }

    if (result.failedCount > 0) {
      setSaveStatus("local", "일부 로컬 데이터를 서버로 이전하지 못했습니다.");
    } else {
      setSaveStatus("server", "로컬 데이터를 서버 저장소로 이전했습니다.");
    }
    await audit("LOCAL_DATA_MIGRATED", `로컬 데이터 서버 이전: 성공 ${result.successCount}건, 실패 ${result.failedCount}건`);
    return result;
  }

  function buildCurrentWeeklyAIBriefingSummary(coachingHistory = localAICoachingHistory) {
    return buildWeeklyBriefingSummary({
      weekKey: selectedWeekKey,
      riders: riderComparisonsBase.map(({ metric, previousCompleted, changeRate }) => ({
        riderName: metric.displayName,
        riskLevel: metric.riskLevel,
        previousWeekCompleted: previousCompleted,
        currentWeekCompleted: metric.totalCompleted,
        changeRate
      })),
      actionRecords: readManagerActionChecklistRecords(),
      coachingHistory
    });
  }

  function buildCurrentMonthlyOperationReportSummary(coachingHistory = localAICoachingHistory) {
    return buildMonthlyOperationReportSummary({
      monthKey: getCurrentMonthKey(),
      coachingHistory,
      actionRecords: readManagerActionChecklistRecords(),
      riders: riderComparisonsBase.map(({ metric, changeRate }) => ({
        riderName: metric.displayName,
        riskLevel: metric.riskLevel,
        currentWeekCompleted: metric.totalCompleted,
        changeRate
      })),
      operationMemo
    });
  }

  function normalizeWeeklyBriefingResult(data: unknown, fallback: WeeklyAIBriefingResult): WeeklyAIBriefingResult {
    const result = data as Partial<WeeklyAIBriefingResult>;
    const actions = Array.isArray(result.priorityActions)
      ? result.priorityActions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
      : fallback.priorityActions;

    return {
      weekKey: typeof result.weekKey === "string" && result.weekKey.trim() ? result.weekKey : fallback.weekKey,
      briefingTitle: typeof result.briefingTitle === "string" && result.briefingTitle.trim() ? result.briefingTitle : fallback.briefingTitle,
      executiveSummary: typeof result.executiveSummary === "string" && result.executiveSummary.trim() ? result.executiveSummary : fallback.executiveSummary,
      riskSummary: typeof result.riskSummary === "string" && result.riskSummary.trim() ? result.riskSummary : fallback.riskSummary,
      priorityActions: actions.length ? actions : fallback.priorityActions,
      recommendedFocus: typeof result.recommendedFocus === "string" && result.recommendedFocus.trim() ? result.recommendedFocus : fallback.recommendedFocus,
      messageForManagers:
        typeof result.messageForManagers === "string" && result.messageForManagers.trim()
          ? result.messageForManagers
          : fallback.messageForManagers,
      isTemplate: !!result.isTemplate,
      source: result.source === "gemma4" ? "gemma4" : "template",
      createdAt: typeof result.createdAt === "string" && result.createdAt.trim() ? result.createdAt : fallback.createdAt
    };
  }

  async function recordWeeklyAIBriefing(result: WeeklyAIBriefingResult, summary = weeklyAIBriefingSummary) {
    const entry = createWeeklyAIBriefingEntry({ ...result, summary });
    await saveWeeklyBriefingEntry(entry);
    return entry;
  }

  function normalizeMonthlyOperationReport(data: unknown, fallback: MonthlyOperationReport): MonthlyOperationReport {
    const result = data as Partial<MonthlyOperationReport>;
    const actions = Array.isArray(result.nextMonthActions)
      ? result.nextMonthActions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
      : fallback.nextMonthActions;

    return {
      ...fallback,
      operationSummary:
        typeof result.operationSummary === "string" && result.operationSummary.trim()
          ? result.operationSummary
          : fallback.operationSummary,
      nextMonthActions: actions.length ? actions : fallback.nextMonthActions,
      isTemplate: !!result.isTemplate,
      source: result.source === "gemma4" ? "gemma4" : "template",
      createdAt: typeof result.createdAt === "string" && result.createdAt.trim() ? result.createdAt : fallback.createdAt
    };
  }

  async function recordMonthlyOperationReport(report: MonthlyOperationReport) {
    const entry = createMonthlyReportEntry(report);
    await saveMonthlyReport(entry);
    return entry;
  }

  function formatWeeklyBriefingCopy(entry: LocalWeeklyAIBriefingEntry) {
    return [
      `[주간 AI 브리핑] ${entry.weekKey}`,
      "",
      entry.briefingTitle,
      `전체 라이더 ${formatNumber(entry.summary.totalRiders)}명 · 고위험 ${formatNumber(entry.summary.highRiskCount)}명 · 하락 라이더 ${formatNumber(entry.summary.declinedCount)}명`,
      "",
      `핵심 요약: ${entry.executiveSummary}`,
      `위험 요약: ${entry.riskSummary}`,
      "",
      "우선 액션",
      ...entry.priorityActions.slice(0, 3).map((action, index) => `${index + 1}. ${action}`),
      "",
      `집중 포인트: ${entry.recommendedFocus}`,
      `관리자 메시지: ${entry.messageForManagers}`
    ].join("\n");
  }

  async function handleCopyWeeklyBriefing(entry: LocalWeeklyAIBriefingEntry) {
    try {
      await navigator.clipboard.writeText(formatWeeklyBriefingCopy(entry));
      setWeeklyBriefingCopyStatus("복사 완료");
    } catch {
      setWeeklyBriefingCopyStatus("복사 실패");
    } finally {
      window.setTimeout(() => setWeeklyBriefingCopyStatus(""), 1800);
    }
  }

  async function handleGenerateWeeklyAIBriefing() {
    const summary = buildCurrentWeeklyAIBriefingSummary(readAICoachingHistoryEntries());
    if (!selectedWeekKey || summary.totalRiders === 0) {
      setWeeklyBriefingError("브리핑을 생성할 데이터가 없습니다.");
      return;
    }

    setWeeklyBriefingLoading(true);
    setWeeklyBriefingError("");

    try {
      const response = await fetch("/api/ai-coaching/weekly-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ weekKey: selectedWeekKey, summary })
      });

      if (!response.ok) {
        throw new Error("weekly briefing request failed");
      }

      const fallback = createTemplateWeeklyAIBriefing(selectedWeekKey);
      const result = normalizeWeeklyBriefingResult(await response.json(), fallback);
      await recordWeeklyAIBriefing(result, summary);
    } catch {
      const fallback = createTemplateWeeklyAIBriefing(selectedWeekKey);
      await recordWeeklyAIBriefing(fallback, summary);
      setWeeklyBriefingError("AI 브리핑 API 연결 실패로 기본 템플릿을 저장했습니다.");
    } finally {
      setWeeklyBriefingLoading(false);
    }
  }

  function getLocalHistoryFor(riderName: string, weekKey: string) {
    return localAICoachingHistory
      .filter((entry) => entry.riderName.trim() === riderName.trim() && entry.weekKey.trim() === weekKey.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function getLatestLocalHistoryCreatedAt(riderName: string, weekKey: string) {
    return getLocalHistoryFor(riderName, weekKey)[0]?.createdAt;
  }

  function getLatestLocalResultFor(riderName: string, weekKey: string): AICoachingResultState | undefined {
    const latest = getLatestAICoachingHistoryForRiderWeek(riderName, weekKey);
    if (!latest) return undefined;
    return {
      adminMessage: latest.adminMessage,
      riderMessage: latest.riderMessage,
      isTemplate: latest.isTemplate,
      source: latest.source,
      createdAt: latest.createdAt
    };
  }

  function getVisibleAICoachingResult(key: string, riderName?: string, weekKey = selectedWeekKey) {
    return aiResultById[key] ?? (riderName ? getLatestLocalResultFor(riderName, weekKey) : undefined);
  }

  async function recordAICoachingResult(params: {
    key: string;
    riderName: string;
    weekKey: string;
    riskLevel: string;
    previousWeekCompleted: number;
    currentWeekCompleted: number;
    changeRate: number;
    adminMessage: string;
    riderMessage: string;
    isTemplate: boolean;
    source: AICoachingSource;
  }) {
    const entry = createAICoachingHistoryEntry({
      riderName: params.riderName,
      weekKey: params.weekKey,
      riskLevel: normalizeRiskLevel(params.riskLevel),
      previousWeekCompleted: params.previousWeekCompleted,
      currentWeekCompleted: params.currentWeekCompleted,
      changeRate: params.changeRate,
      adminMessage: params.adminMessage,
      riderMessage: params.riderMessage,
      isTemplate: params.isTemplate,
      source: params.source
    });

    await saveAICoachingEntry(entry);
    setAiResultById((current) => ({
      ...current,
      [params.key]: {
        adminMessage: entry.adminMessage,
        riderMessage: entry.riderMessage,
        isTemplate: entry.isTemplate,
        source: entry.source,
        createdAt: entry.createdAt
      }
    }));
  }

  async function handleGenerateAICoaching(
    key: string,
    riderId: string,
    riderName: string,
    weekKey: string,
    previousWeekCompleted: number,
    currentWeekCompleted: number,
    changeRate: number,
    riskLevel: string,
    analysisContext?: AICoachingAnalysisContext
  ) {
    setAiLoadingById((s) => ({ ...s, [key]: true }));
    try {
      const payload = { riderId, riderName, weekKey, previousWeekCompleted, currentWeekCompleted, changeRate, riskLevel, analysisContext };
      const res = await fetch(`/api/ai-coaching/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload)
      });

      let data;
      if (res.ok) {
        data = await res.json();
      } else {
        // fallback to template endpoint if generate fails
        const tpl = await fetch(`/api/ai-coaching/template`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify(payload)
        });
        data = tpl.ok ? await tpl.json() : null;
      }

      if (!data) {
        await recordAICoachingResult({
          key,
          riderName,
          weekKey,
          previousWeekCompleted,
          currentWeekCompleted,
          changeRate,
          riskLevel,
          adminMessage: `⚠️ [${riderName}] AI 서비스가 응답하지 않아 기본 템플릿을 사용합니다.`,
          riderMessage: `${riderName}님, 현재 외부 AI 응답이 불가하여 기본 코칭 문구를 안내드립니다. ${currentWeekCompleted}건`,
          isTemplate: true,
          source: "local-template"
        });
      } else {
        await recordAICoachingResult({
          key,
          riderName,
          weekKey,
          previousWeekCompleted,
          currentWeekCompleted,
          changeRate,
          riskLevel,
          adminMessage: data.adminMessage,
          riderMessage: data.riderMessage,
          isTemplate: !!data.isTemplate,
          source: data.isTemplate ? "template" : "gemma4"
        });
      }
    } catch (error) {
      // network or unexpected error: try template endpoint
      try {
        const tpl = await fetch(`/api/ai-coaching/template`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ riderName, previousWeekCompleted, currentWeekCompleted, changeRate, riskLevel, analysisContext })
        });
        const data = tpl.ok ? await tpl.json() : null;
        if (data) {
          await recordAICoachingResult({
            key,
            riderName,
            weekKey,
            previousWeekCompleted,
            currentWeekCompleted,
            changeRate,
            riskLevel,
            adminMessage: data.adminMessage,
            riderMessage: data.riderMessage,
            isTemplate: !!data.isTemplate,
            source: "template"
          });
        }
      } catch {
        await recordAICoachingResult({
          key,
          riderName,
          weekKey,
          previousWeekCompleted,
          currentWeekCompleted,
          changeRate,
          riskLevel,
          adminMessage: `⚠️ [${riderName}] AI 호출 실패 - 기본 템플릿 사용`,
          riderMessage: `${riderName}님, 현재 AI 서비스에 접근할 수 없어 기본 안내 문구를 표시합니다. (${currentWeekCompleted}건)`,
          isTemplate: true,
          source: "local-template"
        });
      }
    } finally {
      setAiLoadingById((s) => ({ ...s, [key]: false }));
    }
  }

  async function handleCopyText(key: string, type: "admin" | "rider", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setAiCopyStatusById((s) => ({ ...s, [key]: { ...(s[key] ?? {}), [type === "admin" ? "adminCopied" : "riderCopied"]: true } }));
      window.setTimeout(() => {
        setAiCopyStatusById((s) => ({ ...s, [key]: { ...(s[key] ?? {}), [type === "admin" ? "adminCopied" : "riderCopied"]: false } }));
      }, 1800);
    } catch {
      // noop: clipboard may fail in some environments
    }
  }

  function setMessageQueueStatus(key: string, message: string) {
    setMessageQueueStatusByKey((current) => ({ ...current, [key]: message }));
    window.setTimeout(() => {
      setMessageQueueStatusByKey((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }, 2200);
  }

  async function persistMessageQueueItem(item: MessageQueueItem) {
    try {
      await messageQueueApi.saveQueueItem(item);
      saveMessageQueueItem(item);
      setMessageQueueItems((current) => [...current.filter((entry) => entry.id !== item.id), item]);
      setSaveStatus("server", "발송 대기함을 서버에 저장했습니다.");
      return true;
    } catch {
      const saved = saveMessageQueueItem(item);
      if (saved) {
        refreshLocalMessageQueue();
        setSaveStatus("local", "서버 저장 실패로 발송 대기함을 로컬에 임시 저장했습니다.");
        return true;
      }
      setMessageQueueItems((current) => [...current.filter((entry) => entry.id !== item.id), item]);
      setSaveStatus("failed", "발송 대기함 저장에 실패했습니다.");
      return false;
    }
  }

  async function persistMessageQueueUpdate(item: MessageQueueItem) {
    try {
      await messageQueueApi.updateQueueItem(item);
      updateMessageQueueItem(item);
      setMessageQueueItems((current) => [...current.filter((entry) => entry.id !== item.id), item]);
      setSaveStatus("server", "발송 대기함 변경사항을 서버에 저장했습니다.");
      return true;
    } catch {
      const saved = updateMessageQueueItem(item);
      if (saved) {
        refreshLocalMessageQueue();
        setSaveStatus("local", "서버 저장 실패로 발송 대기함 변경사항을 로컬에 임시 저장했습니다.");
        return true;
      }
      setMessageQueueItems((current) => [...current.filter((entry) => entry.id !== item.id), item]);
      setSaveStatus("failed", "발송 대기함 변경사항 저장에 실패했습니다.");
      return false;
    }
  }

  async function persistMessageQueueDelete(item: MessageQueueItem) {
    try {
      await messageQueueApi.deleteQueueItem(item.id);
      deleteMessageQueueItem(item.id);
      setMessageQueueItems((current) => current.filter((entry) => entry.id !== item.id));
      setSaveStatus("server", "발송 대기 항목을 서버에서 삭제했습니다.");
      return true;
    } catch {
      const saved = deleteMessageQueueItem(item.id);
      if (saved) {
        refreshLocalMessageQueue();
        setSaveStatus("local", "서버 삭제 실패로 발송 대기 항목을 로컬에서만 삭제했습니다.");
        return true;
      }
      setSaveStatus("failed", "발송 대기 항목 삭제에 실패했습니다.");
      return false;
    }
  }

  async function persistMessageSendHistory(entry: MessageSendHistoryEntry) {
    try {
      await messageQueueApi.saveSendHistory(entry);
      saveMessageSendHistoryEntry(entry);
      setMessageSendHistory((current) => [...current.filter((item) => item.id !== entry.id), entry]);
      return true;
    } catch {
      const saved = saveMessageSendHistoryEntry(entry);
      if (saved) {
        refreshLocalMessageSendHistory();
        return true;
      }
      setMessageSendHistory((current) => [...current.filter((item) => item.id !== entry.id), entry]);
      return false;
    }
  }

  async function handleAddMessageQueueItem(input: {
    key: string;
    riderName: string;
    weekKey: string;
    riskLevel: RiderRiskLevel;
    trendLabel?: MessageQueueItem["trendLabel"];
    adminMessage: string;
    riderMessage: string;
    currentWeekCompleted: number;
    changeRate: number;
  }) {
    const candidate = createMessageQueueItem(input);
    if (hasDuplicateMessageQueueItem(messageQueueItems, candidate)) {
      setMessageQueueStatus(input.key, "이미 발송 대기함에 있는 문구입니다.");
      return;
    }

    await persistMessageQueueItem(candidate);
    setMessageQueueStatus(input.key, "발송 대기함 추가 완료");
    await audit("MESSAGE_QUEUE_ADDED", `${input.riderName} 발송 대기함 추가`, { riderName: input.riderName, weekKey: input.weekKey });
  }

  async function handleMessageQueueCopy(item: MessageQueueItem, copyType: "kakao" | "sms") {
    const updatedAt = new Date().toISOString();
    const updated: MessageQueueItem = {
      ...item,
      sendStatus: "복사완료",
      sendChannel: copyType === "kakao" ? "카톡" : "문자",
      updatedAt
    };
    await persistMessageQueueUpdate(updated);
    await audit(copyType === "kakao" ? "MESSAGE_QUEUE_KAKAO_COPIED" : "MESSAGE_QUEUE_SMS_COPIED", `${item.riderName} ${copyType === "kakao" ? "카톡" : "문자"} 문구 복사`, {
      riderName: item.riderName,
      weekKey: item.weekKey
    });
  }

  async function handleMessageQueueUpdate(item: MessageQueueItem) {
    await persistMessageQueueUpdate(item);
    await audit("MESSAGE_QUEUE_MEMO_UPDATED", `${item.riderName} 발송 대기함 메모/채널 수정`, { riderName: item.riderName, weekKey: item.weekKey });
  }

  async function handleMessageQueueHold(item: MessageQueueItem) {
    const updated = { ...item, sendStatus: "보류" as const, updatedAt: new Date().toISOString() };
    await persistMessageQueueUpdate(updated);
    await audit("MESSAGE_QUEUE_HELD", `${item.riderName} 발송 보류 처리`, { riderName: item.riderName, weekKey: item.weekKey });
  }

  async function handleMessageQueueDelete(item: MessageQueueItem) {
    await persistMessageQueueDelete(item);
    await audit("MESSAGE_QUEUE_DELETED", `${item.riderName} 발송 대기 항목 삭제`, { riderName: item.riderName, weekKey: item.weekKey });
  }

  async function handleMessageQueueSent(item: MessageQueueItem, sentMessage: string) {
    const sentAt = new Date().toISOString();
    const sentBy = "관리자";
    const updated: MessageQueueItem = {
      ...item,
      sendStatus: "발송완료",
      sentAt,
      sentBy,
      updatedAt: sentAt
    };
    const history = createSendHistoryEntry(updated, {
      sendChannel: updated.sendChannel as MessageSendChannel,
      sentMessage,
      sentAt,
      sentBy,
      memo: updated.memo
    });

    await persistMessageQueueUpdate(updated);
    await persistMessageSendHistory(history);
    await audit("MESSAGE_SEND_COMPLETED", `${item.riderName} ${updated.sendChannel} 발송완료 처리`, { riderName: item.riderName, weekKey: item.weekKey });
  }

  async function handleGenerateMonthlyOperationReport() {
    const summary = buildCurrentMonthlyOperationReportSummary(readAICoachingHistoryEntries());
    setMonthlyReportLoading(true);
    setMonthlyReportError("");

    try {
      const response = await fetch("/api/ai-coaching/monthly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ summary })
      });

      if (!response.ok) {
        throw new Error("monthly report request failed");
      }

      const fallback = createTemplateMonthlyOperationReport(summary);
      const result = normalizeMonthlyOperationReport(await response.json(), fallback);
      await recordMonthlyOperationReport(result);
    } catch {
      const fallback = createTemplateMonthlyOperationReport(summary);
      await recordMonthlyOperationReport(fallback);
      setMonthlyReportError("AI 리포트 API 연결 실패로 기본 템플릿을 저장했습니다.");
    } finally {
      setMonthlyReportLoading(false);
    }
  }

  async function handleCopyMonthlyOperationReport() {
    if (!monthlyOperationReport) return;
    const copyText = formatMonthlyOperationReportText(monthlyOperationReport);
    try {
      await navigator.clipboard.writeText(copyText);
      setMonthlyReportCopyStatus("복사 완료");
      setMonthlyReportCopyFailed(false);
      setMonthlyReportManualText("");
    } catch {
      setMonthlyReportCopyStatus("복사 실패");
      setMonthlyReportCopyFailed(true);
      setMonthlyReportManualText(copyText);
    } finally {
      window.setTimeout(() => setMonthlyReportCopyStatus(""), 1800);
    }
  }

  async function handleGenerateAICoachingForAll() {
    if (!currentMetrics.length || !selectedWeekKey) return;
    setBatchLoading(true);
    setBatchStatus(`일괄 생성 시작 (${currentMetrics.length}명)`);

    const items = currentMetrics.map((metric) => {
      const previous = getMetricByRider(previousMetrics, metric);
      const previousCompleted = previous?.totalCompleted ?? 0;
      const changeRate = previousCompleted ? ((metric.totalCompleted - previousCompleted) / previousCompleted) * 100 : 0;
      const trendAnalysis =
        riderTrendAnalysisMap.get(metric.riderId) ??
        buildRiderTrendAnalysis({
          riderName: metric.displayName,
          weekKey: selectedWeekKey,
          orderedWeekKeys: trendWeekOptions,
          weeklyCompleted: metric.weeklyCompleted,
          riskLevel: metric.riskLevel,
          currentWeekCompleted: metric.totalCompleted
        });

      return {
        riderId: metric.riderId,
        riderName: metric.displayName,
        weekKey: selectedWeekKey,
        previousWeekCompleted: previousCompleted,
        currentWeekCompleted: metric.totalCompleted,
        changeRate,
        riskLevel: metric.riskLevel,
        analysisContext: buildAICoachingAnalysisContext(trendAnalysis)
      };
    });

    try {
      setBatchProgress({ completed: 0, total: items.length });
      setBatchFailures([]);
      setBatchStatus(`일괄 생성 시작 (${items.length}명)`);

      const response = await fetch("/api/ai-coaching/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ weekKey: selectedWeekKey, items })
      });

      if (!response.ok) {
        throw new Error("AI 배치 생성 요청 실패");
      }

      const results = (await response.json()) as Array<{
        riderId: string;
        adminMessage: string;
        riderMessage: string;
        isTemplate: boolean;
        error?: string;
      }>;

      const nextResults: Record<string, AICoachingResultState> = {};
      for (const item of results) {
        const sourceItem = items.find((candidate) => candidate.riderId === item.riderId);
        const source = item.isTemplate ? "template" : "gemma4";
        const entry = createAICoachingHistoryEntry({
          riderName: sourceItem?.riderName ?? item.riderId,
          weekKey: selectedWeekKey,
          riskLevel: normalizeRiskLevel(sourceItem?.riskLevel ?? "허용"),
          previousWeekCompleted: sourceItem?.previousWeekCompleted ?? 0,
          currentWeekCompleted: sourceItem?.currentWeekCompleted ?? 0,
          changeRate: sourceItem?.changeRate ?? 0,
          adminMessage: item.adminMessage,
          riderMessage: item.riderMessage,
          isTemplate: item.isTemplate,
          source
        });
        await saveAICoachingEntry(entry);
        nextResults[`rider-${item.riderId}`] = {
          adminMessage: item.adminMessage,
          riderMessage: item.riderMessage,
          isTemplate: item.isTemplate,
          source,
          createdAt: entry.createdAt
        };
      }

      setAiResultById((current) => ({ ...current, ...nextResults }));
      setBatchProgress({ completed: results.length, total: results.length });

      const failures = results
        .filter((item) => item.error)
        .map((item) => ({ riderId: item.riderId, riderName: item.riderId, error: item.error ?? "알 수 없는 오류" }));

      if (failures.length) {
        setBatchFailures(failures);
        setBatchStatus(`일괄 생성 완료 (${results.length}명, 오류 ${failures.length}건)`);
      } else {
        setBatchStatus(`일괄 생성 완료 (${results.length}명)`);
      }
    } catch (error) {
      setBatchStatus("일괄 생성 중 오류가 발생했습니다.");
      setBatchFailures([{
        riderId: "unknown",
        riderName: "알 수 없음",
        error: error instanceof Error ? error.message : "네트워크 또는 서버 오류"
      }]);
    } finally {
      setBatchLoading(false);
      window.setTimeout(() => setBatchStatus(""), 3000);
    }
  }

  useEffect(() => {
    if (selectedWeekKey) {
      setHistoryWeekKey(selectedWeekKey);
      loadAICoachingHistory();
    }
  }, [selectedWeekKey]);

  async function loadAICoachingHistory() {
    if (!historyWeekKey) {
      setHistoryError("조회할 주차를 선택해 주세요.");
      setHistoryEntries([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");
    setHistoryEntries([]);

    try {
      const params = new URLSearchParams({ weekKey: historyWeekKey });
      if (historyRiderId.trim()) {
        params.set("riderId", historyRiderId.trim());
      }

      const response = await fetch(`/api/ai-coaching/history?${params.toString()}`, {
        headers: getAuthHeader()
      });
      if (!response.ok) {
        throw new Error(`히스토리 조회에 실패했습니다. (${response.status})`);
      }

      const entries = (await response.json()) as AICoachingHistoryEntry[];
      setHistoryEntries(entries);
      if (!entries.length) {
        setHistoryError("조건에 맞는 히스토리가 없습니다.");
      }
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "히스토리 로드 중 오류가 발생했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function restoreHistoryEntry(entry: AICoachingHistoryEntry) {
    const key = `rider-${entry.riderId}`;
    setAiResultById((current) => ({
      ...current,
      [key]: {
        adminMessage: entry.adminMessage,
        riderMessage: entry.riderMessage,
        isTemplate: entry.isTemplate
      }
    }));
    setHistoryRestoreStatus(`히스토리 항목이 ${entry.riderName}에 복원되었습니다.`);
    window.setTimeout(() => setHistoryRestoreStatus(""), 3000);
  }

  function previewRiskThreshold(value: string) {
    const nextRiskThreshold = Number(value);
    setRiskThreshold(nextRiskThreshold);
    appendThresholdLog(`위험 임계값 ${nextRiskThreshold}%`, nextRiskThreshold, opportunityThreshold);
  }

  function previewOpportunityThreshold(value: string) {
    const nextOpportunityThreshold = Number(value);
    setOpportunityThreshold(nextOpportunityThreshold);
    appendThresholdLog(`기회 임계값 +${nextOpportunityThreshold}%`, riskThreshold, nextOpportunityThreshold);
  }

  function commitRiskThreshold(value: string) {
    const nextRiskThreshold = Number(value);
    setRiskThreshold(nextRiskThreshold);
    appendThresholdLog(`위험 임계값 ${nextRiskThreshold}%`, nextRiskThreshold, opportunityThreshold);
  }

  function commitOpportunityThreshold(value: string) {
    const nextOpportunityThreshold = Number(value);
    setOpportunityThreshold(nextOpportunityThreshold);
    appendThresholdLog(`기회 임계값 +${nextOpportunityThreshold}%`, riskThreshold, nextOpportunityThreshold);
  }

  function toggleAdminTopic(topicId: AdminTopicId) {
    setOpenAdminTopics((current) => {
      const nextOpen = !current[topicId];
      if (isCompactAdminLayout) {
        return nextOpen ? createAdminTopicState(topicId) : { ...current, [topicId]: false };
      }
      return { ...current, [topicId]: nextOpen };
    });
  }

  function scrollToAdminTopic(topicId: AdminTopicId) {
    window.setTimeout(() => {
      document.getElementById(`admin-topic-${topicId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function openAdminTopic(topicId: AdminTopicId) {
    setOpenAdminTopics((current) => (isCompactAdminLayout ? createAdminTopicState(topicId) : { ...current, [topicId]: true }));
    scrollToAdminTopic(topicId);
  }

  function closeAllAdminTopics() {
    setOpenAdminTopics(createClosedAdminTopicState());
  }

  function scrollToAdminTop() {
    document.querySelector(".admin-dashboard-page")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={`page-stack admin-dashboard-page ${isCompactAdminLayout ? "compact" : "wide"}`}>
      <div className="admin-debug-banner">
        <span className="status-pill good">AI 코칭 UI 연결됨</span>
        <span className="status-pill">관리자 라우트: /admin</span>
      </div>
      <SectionHeader
        title="관리자 대시보드"
        description="선택 주차 기준으로 운영 지표와 전주 대비 변화를 확인합니다."
      />

      <nav className="admin-quick-nav" aria-label="관리자 대시보드 빠른 이동">
        <div className="admin-quick-topic-buttons">
          {adminTopicIds.map((topicId) => (
            <button
              className={openAdminTopics[topicId] ? "active" : ""}
              key={topicId}
              type="button"
              onClick={() => openAdminTopic(topicId)}
            >
              <Menu size={14} aria-hidden="true" />
              <span>{adminTopicLabels[topicId].shortLabel}</span>
            </button>
          ))}
        </div>
        <div className="admin-quick-action-buttons">
          <button type="button" onClick={closeAllAdminTopics}>
            <Menu size={14} aria-hidden="true" />
            <span>전체 접기</span>
          </button>
          <button type="button" onClick={scrollToAdminTop}>
            <ChevronUp size={15} aria-hidden="true" />
            <span>맨 위</span>
          </button>
        </div>
      </nav>

      <section className="panel admin-sort-panel">
        <label className="field admin-sort-field">
          <span>라이더 표시 정렬</span>
          <select value={riderSortOption} onChange={(event) => setRiderSortOption(event.target.value as AdminRiderSortOption)}>
            {riderSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p>브리핑의 라이더 카드와 위험도 요약 리스트에만 적용됩니다.</p>
      </section>

      <OperationStorageStatus status={operationSaveStatus} detail={operationSaveDetail} />
      <AIStatusPanel
        onChecked={(status) => {
          void operationApi.saveAIStatusResult({ id: `ai-status-${status.checkedAt}`, ...status });
          void audit("AI_STATUS_CHECKED", status.message || "AI 상태 점검 실행");
        }}
      />
      <OperationDataCheckPanel items={operationDataCheckItems} />
      <OperationBackupPanel
        aiCoachingHistory={localAICoachingHistory}
        managerActions={managerActionRecords}
        monthlyReports={localMonthlyReportHistory}
        onRestored={refreshOperationDataAfterRestore}
        onAudit={(actionType, summary) => {
          void audit(actionType, summary);
        }}
      />
      <OperationMigrationPanel onMigrate={migrateLocalOperationData} />
      <OperationLogsPanel refreshKey={operationLogRevision} />

      <div className="dashboard-topic-list">
        <details className="dashboard-topic" id="admin-topic-briefing" open={openAdminTopics.briefing}>
          <summary className="dashboard-topic-summary" onClick={(event) => {
            event.preventDefault();
            toggleAdminTopic("briefing");
          }}>
            <span>{adminTopicLabels.briefing.label}</span>
            <small>{adminTopicLabels.briefing.caption}</small>
          </summary>
          <div className="dashboard-topic-body">
            <section className="panel">
              <label className="field validation-week-field">
                <span>기준 주차</span>
                <select value={selectedWeekKey} onChange={(event) => setSelectedWeekKey(event.target.value)}>
                  {weekOptions.map((week) => (
                    <option key={week} value={week}>
                      {week}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <WeeklyAIBriefingPanel
              weekKey={selectedWeekKey}
              previousWeekKey={previousWeekKey}
              summary={weeklyAIBriefingSummary}
              latestBriefing={latestWeeklyAIBriefing}
              history={weeklyAIBriefingHistory}
              loading={weeklyBriefingLoading}
              copyStatus={weeklyBriefingCopyStatus}
              errorMessage={weeklyBriefingError}
              onGenerate={handleGenerateWeeklyAIBriefing}
              onCopy={handleCopyWeeklyBriefing}
            />

            <MonthlyOperationReportPanel
              summary={monthlyOperationReportSummary}
              report={monthlyOperationReport}
              history={monthlyReportHistory}
              loading={monthlyReportLoading}
              copyStatus={monthlyReportCopyStatus}
              copyFailed={monthlyReportCopyFailed}
              manualCopyText={monthlyReportManualText}
              errorMessage={monthlyReportError}
              operationMemo={operationMemo}
              onMemoChange={setOperationMemo}
              onGenerate={handleGenerateMonthlyOperationReport}
              onCopy={handleCopyMonthlyOperationReport}
            />

      <section className="panel weekly-briefing-panel">
        <div className="analysis-title">
          <div>
            <h3>관리자 주간 브리핑 MVP</h3>
            <p>{previousWeekKey ? `${previousWeekKey} 대비 ${selectedWeekKey} 변화율 기준` : "직전 주차가 없으면 신규/관찰 카드로 표시합니다."}</p>
          </div>
        </div>

        <div className="threshold-grid">
          <label className="slider-field">
            <span>위험 임계값 {riskThreshold}%</span>
            <input
              type="range"
              min="-60"
              max="0"
              step="1"
              value={riskThreshold}
              onInput={(event) => previewRiskThreshold(event.currentTarget.value)}
              onBlur={(event) => commitRiskThreshold(event.currentTarget.value)}
              onKeyUp={(event) => commitRiskThreshold(event.currentTarget.value)}
              onPointerUp={(event) => commitRiskThreshold(event.currentTarget.value)}
            />
          </label>
          <label className="slider-field">
            <span>기회 임계값 +{opportunityThreshold}%</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={opportunityThreshold}
              onInput={(event) => previewOpportunityThreshold(event.currentTarget.value)}
              onBlur={(event) => commitOpportunityThreshold(event.currentTarget.value)}
              onKeyUp={(event) => commitOpportunityThreshold(event.currentTarget.value)}
              onPointerUp={(event) => commitOpportunityThreshold(event.currentTarget.value)}
            />
          </label>
        </div>

        <div className="weekly-briefing-list">
          {weeklyBriefingCards.map((card) => {
            const cardRiderName = card.riderName;
            const visibleAiResult = getVisibleAICoachingResult(card.id, cardRiderName, selectedWeekKey);
            const cardHistory = cardRiderName ? getLocalHistoryFor(cardRiderName, selectedWeekKey) : [];
            const cardTrendAnalysis = card.riderId ? riderTrendAnalysisMap.get(card.riderId) : undefined;
            const cardAiInputPreview = cardTrendAnalysis ? buildAICoachingAnalysisContext(cardTrendAnalysis) : undefined;

            return (
            <details className={`weekly-briefing-card ${card.tone}`} key={card.id}>
              <summary className="weekly-briefing-card-head">
                <span className="weekly-briefing-summary-text">
                  <strong>{card.title}</strong>
                  <em>{card.type}</em>
                </span>
                <b>{card.changeRateLabel}</b>
              </summary>
              <div className="weekly-briefing-card-body">
                {card.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <p>{card.reason}</p>
                <p>{card.action}</p>
                {/* AI Coaching button for rider-specific cards */}
                {typeof (card as any).riderName !== "undefined" ? (
                  <div className="ai-coaching-row">
                    <button
                      className="ai-coaching-button"
                      type="button"
                      disabled={!!aiLoadingById[card.id]}
                      onClick={() =>
                        handleGenerateAICoaching(
                          card.id,
                          (card as any).riderId ?? `${card.id.replace(/^rider-/, "")}`,
                          (card as any).riderName,
                          selectedWeekKey,
                          (card as any).previousCompleted ?? 0,
                          (card as any).currentCompleted ?? 0,
                          (card as any).changeRatePercent ?? 0,
                          (card as any).riskLevel ?? "허용",
                          cardAiInputPreview
                        )
                      }
                    >
                      {aiLoadingById[card.id] ? "생성 중…" : visibleAiResult ? "재생성" : "AI 코칭 생성"}
                    </button>

                    {visibleAiResult ? (
                      <div className="ai-result-block">
                        <span className={`ai-result-badge ${visibleAiResult.isTemplate ? "template" : "generated"}`}>
                          {visibleAiResult.isTemplate ? "기본 템플릿 사용" : "Gemma 4 생성"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {cardRiderName ? <AICoachingHistoryPanel history={cardHistory} latestCreatedAt={visibleAiResult?.createdAt} /> : null}
                {cardRiderName ? (
                  <ManagerActionChecklist
                    riderName={cardRiderName}
                    weekKey={selectedWeekKey}
                    onSaved={() => setManagerActionRevision((value) => value + 1)}
                    onSaveRecord={saveChecklistRecord}
                  />
                ) : null}
                {/* show result messages if present */}
                {visibleAiResult ? (
                  <div className="ai-result">
                    <div className="ai-result-admin">
                      <strong>관리자용 코칭</strong>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <p style={{ margin: 0, flex: 1 }}>{visibleAiResult.adminMessage}</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 90 }}>
                          <button
                            className="copy-button"
                            type="button"
                            onClick={() => handleCopyText(card.id, "admin", visibleAiResult.adminMessage)}
                          >
                            관리자 문구 복사
                          </button>
                          {aiCopyStatusById[card.id]?.adminCopied ? <span className="copy-toast">복사 완료</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="ai-result-rider">
                      <strong>라이더 전달용</strong>
                      <div className="ai-result-message-row">
                        <p>{visibleAiResult.riderMessage}</p>
                        <div className="ai-result-copy-actions">
                          <button
                            className="copy-button"
                            type="button"
                            onClick={() => handleCopyText(card.id, "rider", visibleAiResult.riderMessage)}
                          >
                            원문 복사
                          </button>
                          {aiCopyStatusById[card.id]?.riderCopied ? <span className="copy-toast">복사 완료</span> : null}
                        </div>
                      </div>
                      <MessageCopyPanel
                        riderName={cardRiderName ?? "라이더"}
                        weekKey={selectedWeekKey}
                        riderMessage={visibleAiResult.riderMessage}
                        currentWeekCompleted={card.currentCompleted ?? 0}
                        changeRate={card.changeRatePercent ?? 0}
                        riskLevel={card.riskLevel ?? "활용"}
                        onCopied={({ copyType, text, riderName, weekKey }) => {
                          void operationApi.saveMessageCopy({
                            id: `message-copy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            copyType,
                            text,
                            riderName,
                            weekKey,
                            createdAt: new Date().toISOString()
                          });
                          void audit("MESSAGE_COPIED", `${riderName} ${copyType === "kakao" ? "카톡용" : "문자용"} 문구 복사`, { riderName, weekKey });
                        }}
                      />
                      {cardRiderName ? (
                        <div className="message-queue-add-row">
                          <button
                            className="ai-coaching-button small"
                            type="button"
                            onClick={() =>
                              handleAddMessageQueueItem({
                                key: card.id,
                                riderName: cardRiderName,
                                weekKey: selectedWeekKey,
                                riskLevel: normalizeRiskLevel(card.riskLevel ?? "주의"),
                                trendLabel: cardTrendAnalysis?.trendLabel,
                                adminMessage: visibleAiResult.adminMessage,
                                riderMessage: visibleAiResult.riderMessage,
                                currentWeekCompleted: card.currentCompleted ?? 0,
                                changeRate: card.changeRatePercent ?? 0
                              })
                            }
                          >
                            발송 대기함에 추가
                          </button>
                          {messageQueueStatusByKey[card.id] ? <span className="copy-toast">{messageQueueStatusByKey[card.id]}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
            );
          })}
        </div>

        <div className="threshold-log">
          <strong>조정 로그</strong>
          {thresholdLogs.length ? (
            thresholdLogs.map((log) => (
              <p key={log.id}>
                {formatDateTime(log.changedAt)} · {log.message}
              </p>
            ))
          ) : (
            <p>아직 조정 로그가 없습니다.</p>
          )}
        </div>
      </section>
          </div>
        </details>

        <details className="dashboard-topic" id="admin-topic-operation" open={openAdminTopics.operation}>
          <summary className="dashboard-topic-summary" onClick={(event) => {
            event.preventDefault();
            toggleAdminTopic("operation");
          }}>
            <span>{adminTopicLabels.operation.label}</span>
            <small>{adminTopicLabels.operation.caption}</small>
          </summary>
          <div className="dashboard-topic-body">
            <MessageQueuePanel
              items={messageQueueItems}
              onCopy={handleMessageQueueCopy}
              onMarkSent={handleMessageQueueSent}
              onHold={handleMessageQueueHold}
              onUpdate={handleMessageQueueUpdate}
              onDelete={handleMessageQueueDelete}
            />

      {latestUpload ? (
        <section className="panel briefing-panel">
          <div className="analysis-title">
            <div>
              <h3>{selectedWeekKey} 운영 브리핑</h3>
              <p>
                {previousWeekKey ? `${previousWeekKey} 대비 ${selectedWeekKey} 변화를 기준으로 표시합니다.` : "비교할 직전 주차가 없어 현재 주차 기준으로 표시합니다."}
              </p>
            </div>
            <span className={`status-pill ${uploadHealth.tone}`}>{uploadHealth.label}</span>
          </div>

          <div className="briefing-grid">
            <article className="briefing-card">
              <span>기준 주차</span>
              <strong>{selectedWeekKey}</strong>
              <small>{formatDateTime(latestUpload.uploadedAt)}</small>
            </article>
            <article className="briefing-card good">
              <span>선택 주차 완료건수</span>
              <strong>{formatNumber(currentCompleted)}건</strong>
              <small>{completedChange.line}</small>
              <p>{completedChange.detail}</p>
            </article>
            <article className="briefing-card">
              <span>운영 라이더 수</span>
              <strong>{formatNumber(currentActiveRiderCount)}명</strong>
              <small>{activeRiderChange.line}</small>
              <p>{activeRiderChange.detail}</p>
            </article>
            <article className="briefing-card">
              <span>멀티율</span>
              <strong>{currentMultiRatio.toFixed(1)}%</strong>
              <small>{multiRatioChange}</small>
            </article>
          </div>

          <div className="briefing-section">
            <h4>이번주 핵심 변화</h4>
            <div className="briefing-grid">
              <article className={`briefing-card ${completedChange.delta >= 0 ? "good" : "warning"}`}>
                <span>전체 완료건수</span>
                <strong>{completedChange.detail}</strong>
                <small>{completedChange.line}</small>
              </article>
              <article className={`briefing-card ${activeRiderChange.delta >= 0 ? "good" : "warning"}`}>
                <span>운영 라이더 수</span>
                <strong>{activeRiderChange.detail}</strong>
                <small>{activeRiderChange.line}</small>
              </article>
              <article className={`briefing-card ${decreasedSegment?.delta < 0 ? "warning" : ""}`}>
                <span>취약 구간</span>
                <strong>{decreasedSegmentLabel}</strong>
                <small>{decreasedSegmentDetail}</small>
              </article>
              <article className={`briefing-card ${improvedSegment?.delta > 0 ? "good" : ""}`}>
                <span>개선 구간</span>
                <strong>{improvedSegmentLabel}</strong>
                <small>{improvedSegmentDetail}</small>
              </article>
            </div>
          </div>

          <div className="briefing-split">
            {actionRequired ? (
              <article className="briefing-card warning">
                <span>즉시 조치 필요</span>
                <strong>{actionRequired.segment}</strong>
                <small>{actionRequired.reason}</small>
                <p>{actionRequired.recommendation}</p>
              </article>
            ) : null}
            <article className="briefing-card">
              <span>런치 미션 후보</span>
              <strong>{lunchMission.tenPlusCount}명</strong>
              <small>14건 이상 {lunchMission.fourteenPlusCount}명 · 예상 {formatCurrency(lunchMission.estimatedBudget)}원</small>
              <p>{lunchMission.recommendation}</p>
            </article>
          </div>

          <div className="button-row data-button-row">
            <a className="secondary-link-button" href="/validation">데이터 검수</a>
            <a className="secondary-link-button" href="/missions">미션 확인</a>
            <a className="secondary-link-button" href={`/coaching?weekKey=${encodeURIComponent(selectedWeekKey)}`}>코칭 생성</a>
          </div>
        </section>
      ) : null}

      <div className="metric-grid">
        <MetricCard label="선택 주차 완료건수" value={`${formatNumber(currentCompleted)}건`} caption={completedChange.detail} tone="good" />
        <MetricCard label="운영 라이더 수" value={`${formatNumber(currentActiveRiderCount)}명`} caption={activeRiderChange.detail} />
        <MetricCard label="멀티율" value={`${currentMultiRatio.toFixed(1)}%`} caption={`${formatNumber(currentMultiCompleted)}건`} tone="good" />
        <MetricCard label="평균 점수" value={`${currentAverageScore}점`} caption={scoreChange.detail} />
        <MetricCard label="관리대상" value={`${managementCount}명`} tone={managementCount ? "warning" : "default"} />
        <MetricCard label="자동 분석 대상" value={`${autoTargetCount}명`} caption="선택 주차 기준" tone="warning" />
        <MetricCard label="취약 구간" value={decreasedSegmentLabel} caption={decreasedSegmentDetail} />
        <MetricCard label="개선 구간" value={improvedSegmentLabel} caption={improvedSegmentDetail} />
      </div>
          </div>
        </details>

        <details className="dashboard-topic" id="admin-topic-analysis" open={openAdminTopics.analysis}>
          <summary className="dashboard-topic-summary" onClick={(event) => {
            event.preventDefault();
            toggleAdminTopic("analysis");
          }}>
            <span>{adminTopicLabels.analysis.label}</span>
            <small>{adminTopicLabels.analysis.caption}</small>
          </summary>
          <div className="dashboard-topic-body">

      <RequiredColumnHealth
        weekKey={selectedWeekKey}
        compact
        title="필수 컬럼 검증"
        description="선택 주차 업로드 데이터가 코칭 분석에 필요한 컬럼을 갖췄는지 확인합니다."
      />

      <section className="panel">
        <h3>전체 누적 데이터</h3>
        <div className="mini-stat-grid">
          <article className="mini-stat-card">
            <span>누적 완료건수</span>
            <strong>{formatNumber(allCompleted)}건</strong>
          </article>
          <article className="mini-stat-card">
            <span>누적 운영 라이더</span>
            <strong>{formatNumber(allActiveRiderCount)}명</strong>
          </article>
          <article className="mini-stat-card">
            <span>누적 멀티율</span>
            <strong>{allMultiRatio.toFixed(1)}%</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>라이더 등급 분포</h3>
        <div className="grade-grid">
          {gradeOrder.map((grade) => (
            <div className={`grade-card ${grade === "MANAGEMENT_TARGET" ? "warning" : ""}`} key={grade}>
              <span>{getGradeLabel(grade)}</span>
              <strong>{gradeCounts[grade]}명</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>구간별 완료 집중도</h3>
        <div className="bar-list">
          {segmentTotals.map((item) => (
            <div className="bar-row" key={item.segment}>
              <span>{item.segment}</span>
              <div className="bar-track">
                <div className="bar-fill teal" style={{ width: `${(item.total / maxSegmentTotal) * 100}%` }} />
              </div>
              <strong>{formatNumber(item.total)}</strong>
            </div>
          ))}
        </div>
      </section>
          </div>
        </details>

        <details className="dashboard-topic" id="admin-topic-riders" open={openAdminTopics.riders}>
          <summary className="dashboard-topic-summary" onClick={(event) => {
            event.preventDefault();
            toggleAdminTopic("riders");
          }}>
            <span>{adminTopicLabels.riders.label}</span>
            <small>{adminTopicLabels.riders.caption}</small>
          </summary>
          <div className="dashboard-topic-body">

      <section className="panel">
        <div className="panel-header-row">
          <h3>라이더 위험도 요약</h3>
          <div className="batch-action-row">
            <button
              className="ai-coaching-button small"
              type="button"
              disabled={batchLoading || currentMetrics.length === 0}
              onClick={handleGenerateAICoachingForAll}
            >
              {batchLoading ? "일괄 생성 중…" : "전체 AI 코칭 생성"}
            </button>
            {batchStatus ? <span className="batch-status">{batchStatus}</span> : null}
          </div>
        </div>
        <DataQualityWarningPanel warnings={dataQualityWarnings} compact />
        {batchProgress ? (
          <div className="batch-progress-row">
            <strong>일괄 진행</strong>
            <span>
              {batchProgress.completed}/{batchProgress.total} 완료
            </span>
          </div>
        ) : null}
        {batchFailures.length > 0 ? (
          <div className="batch-failure-panel">
            <strong>실패 항목</strong>
            <div className="batch-failure-list">
              {batchFailures.map((failure) => (
                <div className="batch-failure-item" key={`${failure.riderId}-${failure.error}`}>
                  <span>{failure.riderName}</span>
                  <small>{failure.error}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="history-filter-row">
          <label>
            주차
            <select value={historyWeekKey} onChange={(event) => setHistoryWeekKey(event.target.value)}>
              {weekOptions.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </label>
          <label>
            라이더 ID
            <input
              type="text"
              placeholder="선택 입력"
              value={historyRiderId}
              onChange={(event) => setHistoryRiderId(event.target.value)}
            />
          </label>
          <button
            className="ai-coaching-button small"
            type="button"
            disabled={historyLoading || !historyWeekKey}
            onClick={loadAICoachingHistory}
          >
            {historyLoading ? "조회 중…" : "히스토리 조회"}
          </button>
        </div>
        {historyRestoreStatus ? <div className="history-restore-status">{historyRestoreStatus}</div> : null}
        {historyError ? <div className="history-error">{historyError}</div> : null}
        {historyEntries.length > 0 ? (
          <div className="ai-history-list">
            {historyEntries.map((entry) => (
              <article className="ai-history-item" key={entry.id}>
                <div className="ai-history-meta">
                  <span>{entry.riderName} / {entry.riderId}</span>
                  <small>{formatDateTime(entry.generatedAt)}</small>
                  <span className={`ai-result-badge ${entry.isTemplate ? "template" : "generated"}`}>
                    {entry.isTemplate ? "기본 템플릿" : "Gemma 4"}
                  </span>
                </div>
                <div className="ai-history-message">
                  <strong>관리자 메시지</strong>
                  <p>{entry.adminMessage}</p>
                </div>
                <div className="ai-history-message">
                  <strong>라이더 메시지</strong>
                  <p>{entry.riderMessage}</p>
                </div>
                <button
                  className="ai-coaching-button small"
                  type="button"
                  onClick={() => restoreHistoryEntry(entry)}
                >
                  복원
                </button>
              </article>
            ))}
          </div>
        ) : null}
        <div className="rider-list">
          {riderComparisons.map(({ metric, previousCompleted, change, trendAnalysis }) => {
            const riderAiKey = `rider-${metric.riderId}`;
            const visibleAiResult = getVisibleAICoachingResult(riderAiKey, metric.displayName, selectedWeekKey);
            const riderHistory = getLocalHistoryFor(metric.displayName, selectedWeekKey);
            const analysisContext = buildAICoachingAnalysisContext(trendAnalysis);
            const changeRateForAI = previousCompleted ? ((metric.totalCompleted - previousCompleted) / previousCompleted) * 100 : 0;
            const aiInputPreview = {
              riderName: metric.displayName,
              weekKey: selectedWeekKey,
              previousWeekCompleted: previousCompleted,
              currentWeekCompleted: metric.totalCompleted,
              changeRate: changeRateForAI,
              riskLevel: metric.riskLevel,
              analysisContext
            };

            return (
            <article className="list-card rider-risk-card" key={metric.riderId}>
              <div>
                <div className="rider-risk-title-row">
                  <strong>{metric.displayName}</strong>
                  <span className={`trend-badge ${getTrendTone(trendAnalysis.trendLabel)}`}>{trendAnalysis.trendLabel}</span>
                </div>
                <span>
                  {previousWeekKey || "직전 주차"} {formatNumber(previousCompleted)}건 → {selectedWeekKey} {formatNumber(metric.totalCompleted)}건
                </span>
                <span>
                  {change.detail} · 멀티 {Math.round(metric.multiDeliveryRate * 100)}% · {getGradeLabel(metric.riderGrade)}
                </span>
                <RiderAnalysisReasonPanel analysis={trendAnalysis} aiInputPreview={aiInputPreview} />
              </div>
              <div className="list-card-right">
                <b>{metric.dispatchScore}점</b>
                <RiskBadge level={metric.riskLevel} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 8 }}>
                  <button
                    className="ai-coaching-button small"
                    type="button"
                    disabled={!!aiLoadingById[riderAiKey]}
                    onClick={() =>
                      handleGenerateAICoaching(
                        riderAiKey,
                        metric.riderId,
                        metric.displayName,
                        selectedWeekKey,
                        previousCompleted,
                        metric.totalCompleted,
                        changeRateForAI,
                        metric.riskLevel,
                        analysisContext
                      )
                    }
                  >
                    {aiLoadingById[riderAiKey] ? "생성 중…" : visibleAiResult ? "재생성" : "AI 코칭 생성"}
                  </button>
                  {visibleAiResult ? (
                    <span className={`ai-result-badge ${visibleAiResult.isTemplate ? "template" : "generated"}`}>
                      {visibleAiResult.isTemplate ? "기본 템플릿 사용" : "Gemma 4 생성"}
                    </span>
                  ) : null}
                  <AICoachingHistoryPanel history={riderHistory} latestCreatedAt={visibleAiResult?.createdAt} />
                  <ManagerActionChecklist
                    riderName={metric.displayName}
                    weekKey={selectedWeekKey}
                    onSaved={() => setManagerActionRevision((value) => value + 1)}
                    onSaveRecord={saveChecklistRecord}
                  />
                  {visibleAiResult ? (
                    <div className="message-queue-add-row compact">
                      <button
                        className="ai-coaching-button small"
                        type="button"
                        onClick={() =>
                          handleAddMessageQueueItem({
                            key: riderAiKey,
                            riderName: metric.displayName,
                            weekKey: selectedWeekKey,
                            riskLevel: metric.riskLevel,
                            trendLabel: trendAnalysis.trendLabel,
                            adminMessage: visibleAiResult.adminMessage,
                            riderMessage: visibleAiResult.riderMessage,
                            currentWeekCompleted: metric.totalCompleted,
                            changeRate: changeRateForAI
                          })
                        }
                      >
                        발송 대기함에 추가
                      </button>
                      {messageQueueStatusByKey[riderAiKey] ? <span className="copy-toast">{messageQueueStatusByKey[riderAiKey]}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </section>
          </div>
        </details>
      </div>
    </div>
  );
}
