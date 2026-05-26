import type {
  LocalAICoachingHistoryEntry,
  WeeklyAIBriefingRiderSummary,
  WeeklyAIBriefingSummary
} from "../types/aiCoaching";
import { managerActionChecklistItems, type ManagerActionChecklistRecord } from "./managerActionChecklist";

export interface WeeklyBriefingRiderInput {
  riderName: string;
  riskLevel: string;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
}

export interface BuildWeeklyBriefingSummaryInput {
  weekKey: string;
  riders: WeeklyBriefingRiderInput[];
  actionRecords?: ManagerActionChecklistRecord[];
  coachingHistory?: LocalAICoachingHistoryEntry[];
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function roundOne(value: number) {
  return (Math.sign(value) || 1) * (Math.round(Math.abs(value) * 10) / 10);
}

function sameWeek(value: string, weekKey: string) {
  return value.trim() === weekKey.trim();
}

function toRiderSummary(rider: WeeklyBriefingRiderInput): WeeklyAIBriefingRiderSummary {
  return {
    riderName: rider.riderName,
    riskLevel: rider.riskLevel,
    previousWeekCompleted: safeNumber(rider.previousWeekCompleted),
    currentWeekCompleted: safeNumber(rider.currentWeekCompleted),
    changeRate: safeNumber(rider.changeRate)
  };
}

function getActionCompletionRate(weekKey: string, actionRecords: ManagerActionChecklistRecord[]) {
  const weeklyRecords = actionRecords.filter((record) => sameWeek(record.weekKey, weekKey));
  if (!weeklyRecords.length) return 0;

  const validIds = new Set(managerActionChecklistItems.map((item) => item.id));
  const checkedCount = weeklyRecords.reduce((sum, record) => {
    const checkedIds = new Set(record.checkedItems.filter((item) => validIds.has(item)));
    return sum + checkedIds.size;
  }, 0);
  const totalCount = weeklyRecords.length * managerActionChecklistItems.length;
  return totalCount ? roundOne((checkedCount / totalCount) * 100) : 0;
}

export function buildWeeklyBriefingSummary(input: BuildWeeklyBriefingSummaryInput): WeeklyAIBriefingSummary {
  const riders = input.riders.map(toRiderSummary);
  const totalChangeRate = riders.reduce((sum, rider) => sum + safeNumber(rider.changeRate), 0);

  return {
    totalRiders: riders.length,
    highRiskCount: riders.filter((rider) => rider.riskLevel === "고위험").length,
    cautionCount: riders.filter((rider) => rider.riskLevel === "관리주의" || rider.riskLevel === "주의").length,
    stableCount: riders.filter((rider) => rider.riskLevel === "안정").length,
    declinedCount: riders.filter((rider) => rider.changeRate < 0).length,
    recoveredCount: riders.filter((rider) => rider.changeRate >= 10).length,
    averageChangeRate: riders.length ? roundOne(totalChangeRate / riders.length) : 0,
    topDeclinedRiders: riders
      .filter((rider) => rider.changeRate < 0)
      .sort((a, b) => a.changeRate - b.changeRate)
      .slice(0, 5),
    topRecoveredRiders: riders
      .filter((rider) => rider.changeRate > 0)
      .sort((a, b) => b.changeRate - a.changeRate)
      .slice(0, 5),
    actionCompletionRate: getActionCompletionRate(input.weekKey, input.actionRecords ?? []),
    coachingGeneratedCount: (input.coachingHistory ?? []).filter((entry) => sameWeek(entry.weekKey, input.weekKey)).length
  };
}

export function createTemplateWeeklyAIBriefing(weekKey: string) {
  return {
    weekKey,
    briefingTitle: "이번 주 라이더 운영 브리핑",
    executiveSummary: "이번 주 라이더 운영 데이터 기준으로 고위험 및 관리주의 대상자를 우선 확인해야 합니다.",
    riskSummary: "하락세 라이더와 고위험 라이더를 중심으로 개별 확인이 필요합니다.",
    priorityActions: [
      "고위험 라이더부터 활동 가능 시간 확인",
      "하락폭이 큰 라이더의 최근 활동 시간대 점검",
      "관리자 액션 체크리스트 미완료 대상 우선 처리"
    ],
    recommendedFocus: "이번 주는 완료건수 하락 라이더와 미조치 라이더 관리에 집중하는 것이 좋습니다.",
    messageForManagers: "숫자 집계는 시스템 계산값을 기준으로 확인하고, 라이더별 상황은 코칭 이력과 체크리스트를 함께 보며 관리하세요.",
    isTemplate: true,
    source: "template" as const,
    createdAt: new Date().toISOString()
  };
}
