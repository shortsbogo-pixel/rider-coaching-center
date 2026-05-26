import { checklistCompletion, type ManagerActionChecklistRecord } from "./managerActionChecklist";

interface MinimalAICoachingHistoryEntry {
  riderName?: string;
  weekKey?: string;
  createdAt?: string;
}

interface OperationDataCheckInput {
  currentRiderCount: number;
  aiCoachingHistory: MinimalAICoachingHistoryEntry[];
  managerActions: ManagerActionChecklistRecord[];
  weeklyBriefings: unknown[];
  monthlyReports: unknown[];
  hasLocalStorageData: boolean;
}

export interface OperationDataCheckItem {
  id: string;
  label: string;
  value: string;
  tone: "good" | "warning";
  badge: "정상" | "확인 필요";
  description: string;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function uniqueCount(values: string[]) {
  return new Set(values.map((value) => value.trim()).filter(Boolean)).size;
}

export function buildOperationDataCheckItems(input: OperationDataCheckInput): OperationDataCheckItem[] {
  const coachedRiderCount = uniqueCount(input.aiCoachingHistory.map((entry) => entry.riderName ?? ""));
  const inProgressActionCount = input.managerActions.filter((record) => checklistCompletion(record.checkedItems).status === "in-progress").length;
  const completedActionCount = input.managerActions.filter((record) => checklistCompletion(record.checkedItems).status === "completed").length;
  const latestAI = input.aiCoachingHistory
    .map((entry) => entry.createdAt)
    .filter((value): value is string => typeof value === "string" && !!value)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return [
    {
      id: "current-riders",
      label: "현재 로드된 라이더",
      value: `${input.currentRiderCount}명`,
      tone: input.currentRiderCount > 0 ? "good" : "warning",
      badge: input.currentRiderCount > 0 ? "정상" : "확인 필요",
      description: "현재 관리자 화면 기준 분석 대상입니다."
    },
    {
      id: "coached-riders",
      label: "AI 코칭 이력 라이더",
      value: `${coachedRiderCount}명`,
      tone: coachedRiderCount > 0 ? "good" : "warning",
      badge: coachedRiderCount > 0 ? "정상" : "확인 필요",
      description: "localStorage에 저장된 AI 코칭 이력 기준입니다."
    },
    {
      id: "in-progress-actions",
      label: "체크리스트 진행 중",
      value: `${inProgressActionCount}명`,
      tone: inProgressActionCount > 0 ? "warning" : "good",
      badge: inProgressActionCount > 0 ? "확인 필요" : "정상",
      description: "일부 액션만 완료된 라이더 수입니다."
    },
    {
      id: "completed-actions",
      label: "관리 완료 라이더",
      value: `${completedActionCount}명`,
      tone: completedActionCount > 0 ? "good" : "warning",
      badge: completedActionCount > 0 ? "정상" : "확인 필요",
      description: "관리 액션 체크리스트를 모두 완료한 라이더 수입니다."
    },
    {
      id: "weekly-briefing",
      label: "주간 브리핑",
      value: input.weeklyBriefings.length ? "생성됨" : "없음",
      tone: input.weeklyBriefings.length ? "good" : "warning",
      badge: input.weeklyBriefings.length ? "정상" : "확인 필요",
      description: "저장된 주간 AI 브리핑 이력 기준입니다."
    },
    {
      id: "monthly-report",
      label: "월간 리포트",
      value: input.monthlyReports.length ? "생성됨" : "없음",
      tone: input.monthlyReports.length ? "good" : "warning",
      badge: input.monthlyReports.length ? "정상" : "확인 필요",
      description: "저장된 월간 운영 리포트 기준입니다."
    },
    {
      id: "local-storage",
      label: "운영 저장 데이터",
      value: input.hasLocalStorageData ? "있음" : "없음",
      tone: input.hasLocalStorageData ? "good" : "warning",
      badge: input.hasLocalStorageData ? "정상" : "확인 필요",
      description: "AI 운영 데이터가 브라우저 저장소에 있는지 확인합니다."
    },
    {
      id: "latest-ai",
      label: "최근 AI 코칭",
      value: formatDate(latestAI),
      tone: latestAI ? "good" : "warning",
      badge: latestAI ? "정상" : "확인 필요",
      description: "가장 최근에 저장된 AI 코칭 생성 시간입니다."
    }
  ];
}
