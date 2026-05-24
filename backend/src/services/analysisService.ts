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

export interface RiderMetricsQuery {
  weekKey?: string;
}

function normalizeWeekKey(weekKey?: string) {
  const trimmed = weekKey?.trim();
  return trimmed && trimmed !== "all" ? trimmed : "all";
}

function selectOrdersForWeek(orders: OrderRecord[], weekKey: string) {
  return weekKey === "all" ? orders : orders.filter((order) => order.week === weekKey);
}

function cacheCoversOrders(cached: RiderMetrics[], orders: OrderRecord[]) {
  const orderWeeks = new Set(orders.map((order) => order.week).filter(Boolean));
  const cachedWeeks = new Set(cached.flatMap((metric) => Object.keys(metric.weeklyCompleted ?? {})));
  return [...orderWeeks].every((week) => cachedWeeks.has(week));
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

export async function getRiderMetrics(query: RiderMetricsQuery = {}) {
  const weekKey = normalizeWeekKey(query.weekKey);

  if (weekKey === "all") {
    const allOrders = await getAnalysisOrders();
    const cached = await riderRepository.getAll();
    if (cached.length && cacheCoversOrders(cached as RiderMetrics[], allOrders)) return cached as RiderMetrics[];

    const metrics = buildRiderMetrics(allOrders, riders as RiderProfile[]);
    await analysisRepository.save(buildAnalysisCache(metrics, "all"));
    await riderRepository.replaceCache(metrics, "all");
    return metrics;
  }

  const allOrders = await getAnalysisOrders();
  const targetOrders = selectOrdersForWeek(allOrders, weekKey);
  const metrics = buildRiderMetrics(targetOrders, riders as RiderProfile[]);
  await analysisRepository.save(buildAnalysisCache(metrics, weekKey));

  if (weekKey === "all") {
    await riderRepository.replaceCache(metrics, "all");
  }

  return metrics;
}

export async function getAnalysisCache(weekKey = "all") {
  const cached = await analysisRepository.getByWeek(weekKey);
  if (cached) return cached;
  return regenerateAnalysisCache(weekKey);
}

export async function regenerateAnalysisCache(weekKey = "all") {
  const allOrders = await getAnalysisOrders();
  const normalizedWeekKey = normalizeWeekKey(weekKey);
  const targetOrders = selectOrdersForWeek(allOrders, normalizedWeekKey);
  const metrics = buildRiderMetrics(targetOrders, riders as RiderProfile[]);
  const cache = buildAnalysisCache(metrics, normalizedWeekKey);
  await analysisRepository.save(cache);
  if (normalizedWeekKey === "all") {
    await riderRepository.replaceCache(metrics, "all");
  }
  return cache;
}
