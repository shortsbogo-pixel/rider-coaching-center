import orders from "../../../src/data/sampleOrders.json";
import riders from "../../../src/data/sampleRiders.json";
import type { AnalysisCache } from "../../../src/types/analysis";
import type { DeliveryType, OrderRecord, TimeSegment } from "../../../src/types/order";
import type { RiderMetrics, RiderProfile } from "../../../src/types/rider";
import { buildRiderMetrics } from "../../../src/utils/scoring";
import { analysisRepository } from "../repositories/analysisRepository";
import { riderRepository } from "../repositories/riderRepository";
import { loadParsedOrders } from "./excelService";

const segments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];
const deliveryTypes: DeliveryType[] = ["단건배달", "멀티배달1", "멀티배달2", "멀티배달3", "멀티배달4"];

export async function getAnalysisOrders() {
  const parsedOrders = await loadParsedOrders();
  return parsedOrders.length ? parsedOrders : (orders as OrderRecord[]);
}

function buildAnalysisCache(metrics: RiderMetrics[], weekKey: string): AnalysisCache {
  const totalCompleted = metrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const segmentSummary = Object.fromEntries(
    segments.map((segment) => [segment, metrics.reduce((sum, metric) => sum + metric.segmentCompleted[segment], 0)])
  ) as Record<TimeSegment, number>;
  const multiDeliverySummary = Object.fromEntries(
    deliveryTypes.map((type) => [type, metrics.reduce((sum, metric) => sum + metric.deliveryTypeCompleted[type], 0)])
  ) as Record<DeliveryType, number>;
  const riderRankings = metrics
    .map((metric) => ({
      riderId: metric.riderId,
      riderName: metric.displayName,
      totalCompleted: metric.totalCompleted,
      coachingScore: metric.coachingScore
    }))
    .sort((a, b) => b.totalCompleted - a.totalCompleted || b.coachingScore - a.coachingScore || a.riderName.localeCompare(b.riderName, "ko"));

  return {
    id: weekKey,
    weekKey,
    generatedAt: new Date().toISOString(),
    totalRiders: metrics.filter((metric) => metric.totalCompleted > 0).length,
    totalCompleted,
    averageCompleted: metrics.length ? Math.round(totalCompleted / metrics.length) : 0,
    segmentSummary,
    multiDeliverySummary,
    riderRankings,
    weakSegments: [...segments].sort((a, b) => segmentSummary[a] - segmentSummary[b]).slice(0, 2),
    topRiders: riderRankings.slice(0, 5).map((item) => item.riderId),
    riskRiders: metrics.filter((metric) => metric.riderGrade === "MANAGEMENT_TARGET" || metric.riskLevel === "고위험").map((metric) => metric.riderId)
  };
}

export async function getRiderMetrics() {
  const cached = await riderRepository.getAll();
  if (cached.length) return cached as RiderMetrics[];

  const metrics = buildRiderMetrics(await getAnalysisOrders(), riders as RiderProfile[]);
  await riderRepository.replaceCache(metrics, "all");
  await analysisRepository.save(buildAnalysisCache(metrics, "all"));
  return metrics;
}

export async function getAnalysisCache(weekKey = "all") {
  const cached = await analysisRepository.getByWeek(weekKey);
  if (cached) return cached;
  return regenerateAnalysisCache(weekKey);
}

export async function regenerateAnalysisCache(weekKey = "all") {
  const allOrders = await getAnalysisOrders();
  const targetOrders = weekKey === "all" ? allOrders : allOrders.filter((order) => order.week === weekKey);
  const metrics = buildRiderMetrics(targetOrders.length ? targetOrders : allOrders, riders as RiderProfile[]);
  const cache = buildAnalysisCache(metrics, weekKey);
  await analysisRepository.save(cache);
  if (weekKey === "all") {
    await riderRepository.replaceCache(metrics, "all");
  }
  return cache;
}
