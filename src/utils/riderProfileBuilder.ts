import type { OrderRecord, TimeSegment } from "../types/order";
import type { RiderProfile, RiderValidationStatus } from "../types/rider";
import { extractBaseName, matchRiderByName } from "./riderMatcher";

const segments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];

function makeUploadedId(baseName: string) {
  return `uploaded-${baseName || "unknown"}`;
}

function getWeekBounds(weeks: string[]) {
  return {
    firstActiveWeek: weeks[0] ?? "",
    lastActiveWeek: weeks[weeks.length - 1] ?? ""
  };
}

function getStatus(sampleMatch: RiderProfile | undefined, aliases: string[]): RiderValidationStatus {
  if (sampleMatch) return "MATCHED_EXISTING";
  const baseNames = new Set(aliases.map((alias) => extractBaseName(alias)));
  if (baseNames.size > 1) return "NAME_REVIEW_RECOMMENDED";
  return "AUTO_ANALYSIS_TARGET";
}

export function buildRiderProfilesFromOrders(orders: OrderRecord[], sampleRiders: RiderProfile[] = []): RiderProfile[] {
  const grouped = new Map<string, OrderRecord[]>();

  for (const order of orders) {
    if (order.completedCount <= 0) continue;
    const sampleMatch = matchRiderByName(order.riderName, sampleRiders);
    const key = sampleMatch?.id ?? makeUploadedId(order.baseName || extractBaseName(order.riderName));
    grouped.set(key, [...(grouped.get(key) ?? []), order]);
  }

  return Array.from(grouped.entries()).map(([id, riderOrders]) => {
    const aliases = [...new Set(riderOrders.map((order) => order.riderName).filter(Boolean))];
    const baseName = riderOrders[0]?.baseName || extractBaseName(aliases[0] ?? "");
    const sampleMatch = sampleRiders.find((rider) => rider.id === id) ?? aliases.map((alias) => matchRiderByName(alias, sampleRiders)).find(Boolean);
    const weeks = [...new Set(riderOrders.map((order) => order.week))];
    const { firstActiveWeek, lastActiveWeek } = getWeekBounds(weeks);
    const totalCompleted = riderOrders.reduce((sum, order) => sum + order.completedCount, 0);
    const segmentStats = Object.fromEntries(
      segments.map((segment) => [
        segment,
        riderOrders.filter((order) => order.timeSegment === segment).reduce((sum, order) => sum + order.completedCount, 0)
      ])
    );

    return {
      id,
      name: sampleMatch?.name ?? baseName,
      displayName: sampleMatch?.displayName ?? sampleMatch?.name ?? baseName,
      baseName,
      aliases: [...new Set([...(sampleMatch?.aliases ?? []), ...aliases])],
      phoneSuffix: sampleMatch?.phoneSuffix,
      source: sampleMatch ? "merged" : "uploaded",
      totalCompleted,
      firstActiveWeek,
      lastActiveWeek,
      activeWeeks: weeks,
      segmentStats,
      validationStatus: getStatus(sampleMatch, aliases)
    } satisfies RiderProfile & { segmentStats: Record<string, number> };
  });
}
