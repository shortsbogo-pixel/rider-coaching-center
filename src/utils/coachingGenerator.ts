import type { CoachingMessage } from "../types/coaching";
import type { RiderMetrics } from "../types/rider";

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function generateCoachingMessage(
  metrics: RiderMetrics,
  options: { basisWeek?: string; isFallbackWeek?: boolean; topCompletedThreshold?: number } = {}
): CoachingMessage {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendedActions: string[] = [];
  const profitTips: string[] = [];
  const isTopCompleted = metrics.totalCompleted >= (options.topCompletedThreshold ?? Number.POSITIVE_INFINITY);

  if (metrics.profileSource === "uploaded") {
    profitTips.push("업로드 데이터에서 새롭게 확인된 라이더입니다. 현재 기록을 기준으로 자동 분석 중이며, 누적 데이터가 쌓이면 더 정확한 코칭이 가능합니다.");
  }

  if (metrics.multiDeliveryRate >= 0.45 && isTopCompleted) {
    strengths.push("멀티배달 수행률이 높고 완료건수도 안정적입니다.");
    profitTips.push("피크타임 패턴을 유지하면서 포스트구간 이탈만 줄이면 배차 안정성이 더 좋아질 수 있습니다.");
  } else if (metrics.multiDeliveryRate >= 0.45) {
    strengths.push("멀티배달 수행률이 높아 피크타임 처리 효율이 좋습니다.");
    profitTips.push("현재 멀티배달 패턴을 유지하면서 Post_Lunch 또는 Post_Dinner 중 약한 구간을 보강하세요.");
  } else {
    weaknesses.push("현재 단건 위주 패턴입니다.");
    recommendedActions.push("무리한 멀티 수행보다 픽업/배달 동선이 겹치는 구간에서 멀티 수락 경험을 늘리는 전략이 적합합니다.");
  }

  if (metrics.postLunchRate < 0.15) {
    weaknesses.push("14:00~16:30 Post_Lunch 구간 참여가 낮습니다.");
    recommendedActions.push("Post_Lunch 구간은 경쟁이 줄어드는 시간대이므로 최소 2~3콜 이상 유지하면 배차 신뢰도 유지에 도움이 됩니다.");
  } else {
    strengths.push(`Post_Lunch 참여율이 ${percent(metrics.postLunchRate)}로 안정적입니다.`);
  }

  if (metrics.postDinnerRate < 0.15) {
    weaknesses.push("저녁 피크 이후 이탈이 빠른 편입니다.");
    recommendedActions.push("Post_Dinner 구간에서 짧게라도 운행을 이어가면 추가 배차 기회와 주간 완료건수 방어에 도움이 됩니다.");
  } else {
    strengths.push(`Post_Dinner 참여율이 ${percent(metrics.postDinnerRate)}로 좋습니다.`);
  }

  if (isTopCompleted && (metrics.postLunchRate < 0.15 || metrics.postDinnerRate < 0.15)) {
    recommendedActions.push("피크타임 수행력은 좋지만 포스트구간 공백이 있습니다. 상위권을 유지하려면 Post_Lunch 또는 Post_Dinner 중 하나를 보강하는 것이 좋습니다.");
  }

  if (metrics.rejectionIgnoredRate >= 0.06) {
    weaknesses.push("거절/무시율이 높아 배차 우선순위에 불리하게 작용할 수 있습니다.");
    recommendedActions.push("운행 중에는 수락 가능한 지역에서 대기하고, 불필요한 앱 대기 상태를 줄이는 것을 추천합니다.");
  }

  if (strengths.length === 0) {
    strengths.push("최근 5주 데이터가 쌓이고 있어 개선 포인트를 빠르게 찾을 수 있습니다.");
  }

  if (profitTips.length === 0) {
    profitTips.push("런치와 디너 피크 앞뒤 30분을 붙여 운행하면 대기 손실을 줄일 수 있습니다.");
  }

  return {
    riderId: metrics.riderId,
    riderName: metrics.riderName,
    basisWeek: options.basisWeek,
    isFallbackWeek: options.isFallbackWeek,
    riskLevel: metrics.riskLevel,
    summary: `${metrics.riderName}님의 ${options.basisWeek ? `${options.basisWeek} 기준 ` : ""}배차 친화 점수는 ${metrics.dispatchScore}점이며, 현재 등급은 ${metrics.riskLevel}입니다.`,
    strengths,
    weaknesses,
    recommendedActions,
    profitTips,
    weeklyMission: recommendedActions[0] ?? "이번 주에는 피크타임 이후 포스트구간 2콜 유지를 목표로 해보세요."
  };
}
