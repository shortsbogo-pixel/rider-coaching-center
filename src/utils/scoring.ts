import type { DeliveryType, OrderRecord, TimeSegment } from "../types/order";
import type { GradeProgress, RiderGrade, RiderMetrics, RiderProfile, RiderRiskLevel, ScoreBreakdown } from "../types/rider";
import { buildRiderProfilesFromOrders } from "./riderProfileBuilder";

const segments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];
const deliveryTypes: DeliveryType[] = ["단건배달", "멀티배달1", "멀티배달2", "멀티배달3", "멀티배달4"];
const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

const gradeRules: Array<{ grade: RiderGrade; label: string; min: number }> = [
  { grade: "S", label: "S급", min: 300 },
  { grade: "A", label: "A급", min: 250 },
  { grade: "B", label: "B급", min: 200 },
  { grade: "C", label: "C급", min: 150 },
  { grade: "MANAGEMENT_TARGET", label: "관리대상", min: 0 }
];

export function calculateRiderGrade(totalCompleted: number): RiderGrade {
  return gradeRules.find((rule) => totalCompleted >= rule.min)?.grade ?? "MANAGEMENT_TARGET";
}

export function getGradeLabel(grade: RiderGrade) {
  return gradeRules.find((rule) => rule.grade === grade)?.label ?? grade;
}

export function getGradeProgress(totalCompleted: number): GradeProgress {
  const currentRule = gradeRules.find((rule) => totalCompleted >= rule.min) ?? gradeRules[gradeRules.length - 1];
  const nextRule = [...gradeRules].reverse().find((rule) => rule.min > totalCompleted);

  return {
    currentGrade: currentRule.grade,
    currentLabel: currentRule.label,
    nextGrade: nextRule?.grade,
    nextLabel: nextRule?.label,
    nextTarget: nextRule?.min,
    remainingToNext: nextRule ? Math.max(nextRule.min - totalCompleted, 0) : 0
  };
}

export function calculateDispatchScore(input: {
  totalCompleted: number;
  maxCompleted: number;
  multiDeliveryRate: number;
  postLunchRate: number;
  postDinnerRate: number;
  activeWeekdayCount: number;
  rejectionIgnoredRate?: number;
  hasRejectionMetric?: boolean;
}): { totalScore: number; breakdown: ScoreBreakdown; missingMetrics: string[] } {
  const completedScore = Math.min(input.totalCompleted / Math.max(input.maxCompleted, 1), 1) * 25;
  const multiDeliveryScore = input.multiDeliveryRate * 20;
  const postLunchScore = Math.min(input.postLunchRate / 0.18, 1) * 15;
  const postDinnerScore = Math.min(input.postDinnerRate / 0.18, 1) * 15;
  const consistencyScore = Math.min(input.activeWeekdayCount / 5, 1) * 15;
  const rejectionScore = input.hasRejectionMetric
    ? Math.max(0, 1 - (input.rejectionIgnoredRate ?? 0) / 0.1) * 10
    : 8;

  const breakdown = {
    completedScore: Math.round(completedScore),
    multiDeliveryScore: Math.round(multiDeliveryScore),
    postLunchScore: Math.round(postLunchScore),
    postDinnerScore: Math.round(postDinnerScore),
    consistencyScore: Math.round(consistencyScore),
    rejectionScore: Math.round(rejectionScore)
  };

  return {
    totalScore: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    breakdown,
    missingMetrics: input.hasRejectionMetric ? [] : ["rejectionIgnoredRate"]
  };
}

export function getRiskLevel(rejectionIgnoredRate: number, dispatchScore?: number): RiderRiskLevel {
  if (rejectionIgnoredRate >= 0.1) return "고위험";
  if (rejectionIgnoredRate >= 0.06) return "관리주의";
  if (dispatchScore !== undefined && dispatchScore >= 85) return "에이스";
  if (dispatchScore !== undefined && dispatchScore >= 70) return "안정";
  return "허용";
}

function sortRiderMetrics(metrics: RiderMetrics[]) {
  return [...metrics].sort((a, b) => {
    if (b.totalCompleted !== a.totalCompleted) return b.totalCompleted - a.totalCompleted;
    if (b.coachingScore !== a.coachingScore) return b.coachingScore - a.coachingScore;
    return a.displayName.localeCompare(b.displayName, "ko");
  });
}

function findStrongestSegment(segmentCompleted: Record<TimeSegment, number>) {
  return segments.reduce((best, segment) => (segmentCompleted[segment] > segmentCompleted[best] ? segment : best), segments[0]);
}

function findWeakestSegment(segmentCompleted: Record<TimeSegment, number>) {
  return segments.reduce((weakest, segment) => (segmentCompleted[segment] < segmentCompleted[weakest] ? segment : weakest), segments[0]);
}

export function buildRiderMetrics(orders: OrderRecord[], riders: RiderProfile[] = []): RiderMetrics[] {
  const profiles = buildRiderProfilesFromOrders(orders, riders);
  const grouped = new Map<string, OrderRecord[]>();

  for (const profile of profiles) {
    const aliases = new Set(profile.aliases);
    grouped.set(
      profile.id,
      orders.filter((order) => aliases.has(order.riderName) || order.baseName === profile.baseName)
    );
  }

  const totals = Array.from(grouped.values()).map((items) =>
    items.reduce((sum, order) => sum + order.completedCount, 0)
  );
  const maxCompleted = Math.max(...totals, 1);
  const allWeeks = [...new Set(orders.map((order) => order.week))];

  const metrics = profiles.map((profile) => {
    const riderOrders = grouped.get(profile.id) ?? [];
    const totalCompleted = riderOrders.reduce((sum, order) => sum + order.completedCount, 0);
    const multiCompleted = riderOrders
      .filter((order) => order.deliveryType.startsWith("멀티배달"))
      .reduce((sum, order) => sum + order.completedCount, 0);

    const weeklyCompleted = Object.fromEntries(
      allWeeks.map((week) => [
        week,
        riderOrders.filter((order) => order.week === week).reduce((sum, order) => sum + order.completedCount, 0)
      ])
    );

    const weekdayCompleted = Object.fromEntries(
      weekdays.map((weekday) => [
        weekday,
        riderOrders.filter((order) => order.weekday === weekday).reduce((sum, order) => sum + order.completedCount, 0)
      ])
    );

    const segmentCompleted = Object.fromEntries(
      segments.map((segment) => [
        segment,
        riderOrders.filter((order) => order.timeSegment === segment).reduce((sum, order) => sum + order.completedCount, 0)
      ])
    ) as Record<TimeSegment, number>;

    const deliveryTypeCompleted = Object.fromEntries(
      deliveryTypes.map((deliveryType) => [
        deliveryType,
        riderOrders.filter((order) => order.deliveryType === deliveryType).reduce((sum, order) => sum + order.completedCount, 0)
      ])
    ) as Record<DeliveryType, number>;

    const postLunchRate = totalCompleted ? segmentCompleted.Post_Lunch / totalCompleted : 0;
    const postDinnerRate = totalCompleted ? segmentCompleted.Post_Dinner / totalCompleted : 0;
    const activeWeekdayCount = Object.values(weekdayCompleted).filter((count) => count > 0).length;
    const hasRejectionMetric = riderOrders.some((order) => (order.rejectionRate ?? 0) > 0 || (order.ignoredRate ?? 0) > 0);
    const rejectionIgnoredRate = hasRejectionMetric
      ? riderOrders.reduce((sum, order) => sum + (order.rejectionRate ?? 0) + (order.ignoredRate ?? 0), 0) /
        Math.max(riderOrders.length, 1)
      : 0;
    const score = calculateDispatchScore({
      totalCompleted,
      maxCompleted,
      multiDeliveryRate: totalCompleted ? multiCompleted / totalCompleted : 0,
      postLunchRate,
      postDinnerRate,
      activeWeekdayCount,
      rejectionIgnoredRate,
      hasRejectionMetric
    });
    const weakSegments = segments.filter((segment) => segmentCompleted[segment] === 0);
    const riderGrade = calculateRiderGrade(totalCompleted);

    return {
      riderId: profile.id,
      riderName: profile.name,
      displayName: profile.displayName ?? profile.name,
      baseName: profile.baseName,
      profileSource: profile.source ?? "sample",
      validationStatus: profile.validationStatus ?? "MATCHED_EXISTING",
      totalCompleted,
      weeklyCompleted,
      weekdayCompleted,
      segmentCompleted,
      deliveryTypeCompleted,
      multiDeliveryRate: totalCompleted ? multiCompleted / totalCompleted : 0,
      postLunchRate,
      postDinnerRate,
      consistencyRate: activeWeekdayCount / weekdays.length,
      rejectionIgnoredRate,
      weakSegments,
      strongSegment: findStrongestSegment(segmentCompleted),
      weakestSegment: findWeakestSegment(segmentCompleted),
      dispatchScore: score.totalScore,
      coachingScore: score.totalScore,
      scoreBreakdown: score.breakdown,
      missingMetrics: score.missingMetrics,
      riskLevel: getRiskLevel(rejectionIgnoredRate, score.totalScore),
      riderGrade,
      gradeProgress: getGradeProgress(totalCompleted)
    } satisfies RiderMetrics;
  });

  return sortRiderMetrics(metrics).filter((metric) => metric.totalCompleted > 0);
}
