import type { KeyChangeItem, LunchMissionBrief, UploadedWeekSummary } from "../types/newWeekBriefing";
import type { TimeSegment } from "../types/order";
import type { RiderMetrics } from "../types/rider";

const trackedSegments: TimeSegment[] = ["Lunch_Peak", "Post_Lunch", "Post_Dinner"];

function formatRatio(value: number) {
  if (!Number.isFinite(value)) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getTotal(metrics: RiderMetrics[], selector: (metric: RiderMetrics) => number) {
  return metrics.reduce((sum, metric) => sum + selector(metric), 0);
}

function buildChange(label: string, current: number, previous: number): KeyChangeItem {
  if (!previous) {
    return {
      label,
      value: "전주 데이터 부족",
      tone: "default"
    };
  }

  const changeRate = ((current - previous) / previous) * 100;
  return {
    label,
    value: formatRatio(changeRate),
    tone: changeRate >= 5 ? "good" : changeRate <= -10 ? "warning" : "default"
  };
}

export function getUploadHealth(upload?: UploadedWeekSummary) {
  if (!upload) {
    return { label: "데이터 없음", tone: "warning" as const };
  }

  const totalRows = upload.orderCount + upload.issueCount;
  const issueRate = totalRows ? upload.issueCount / totalRows : 0;
  if (issueRate >= 0.15) return { label: "검수 필요", tone: "warning" as const };
  if (issueRate > 0) return { label: "일부 확인", tone: "warning" as const };
  return { label: "정상", tone: "good" as const };
}

export function buildKeyChanges(current: RiderMetrics[], previous: RiderMetrics[]): KeyChangeItem[] {
  const changes = [
    buildChange(
      "전체 완료건수",
      getTotal(current, (metric) => metric.totalCompleted),
      getTotal(previous, (metric) => metric.totalCompleted)
    ),
    buildChange("운행 라이더 수", current.length, previous.length),
    ...trackedSegments.map((segment) =>
      buildChange(
        segment,
        getTotal(current, (metric) => metric.segmentCompleted[segment]),
        getTotal(previous, (metric) => metric.segmentCompleted[segment])
      )
    )
  ];

  return changes
    .sort((a, b) => {
      const aNeedsAction = a.tone === "warning" ? 1 : 0;
      const bNeedsAction = b.tone === "warning" ? 1 : 0;
      return bNeedsAction - aNeedsAction;
    })
    .slice(0, 3);
}

export function getWeakestAction(current: RiderMetrics[]) {
  const segmentTotals = trackedSegments.map((segment) => ({
    segment,
    total: getTotal(current, (metric) => metric.segmentCompleted[segment])
  }));
  const weakest = [...segmentTotals].sort((a, b) => a.total - b.total)[0];

  if (!weakest) return undefined;
  const recommendation =
    weakest.segment === "Post_Lunch"
      ? "런치 이후 이탈을 줄이는 연결 미션을 검토하세요."
      : weakest.segment === "Post_Dinner"
        ? "저녁 피크 이후 짧은 추가 운행 유도 메시지를 준비하세요."
        : "런치 피크 참여 라이더를 우선 확인하세요.";

  return {
    segment: weakest.segment,
    reason: `${weakest.segment} 완료건수가 상대적으로 낮습니다.`,
    recommendation
  };
}

export function buildLunchMissionBrief(current: RiderMetrics[]): LunchMissionBrief {
  const tenPlusCount = current.filter((metric) => metric.segmentCompleted.Lunch_Peak >= 10).length;
  const fourteenPlusCount = current.filter((metric) => metric.segmentCompleted.Lunch_Peak >= 14).length;
  const tenOnlyCount = Math.max(tenPlusCount - fourteenPlusCount, 0);
  const estimatedBudget = tenOnlyCount * 5000 + fourteenPlusCount * 7000;

  return {
    tenPlusCount,
    fourteenPlusCount,
    estimatedBudget,
    recommendation: tenPlusCount ? "런치 브릿지 미션 후보를 검토할 수 있습니다." : "런치 후보가 적어 데이터 검수가 먼저 필요합니다."
  };
}
