import type { RiderRiskLevel } from "../types/rider";

export type AdminRiderSortOption = "risk-first" | "decline-first" | "low-completed" | "recent-ai" | "default";

export interface AdminSortableRiderItem {
  id: string;
  riskLevel: RiderRiskLevel | "주의";
  changeRate: number;
  currentWeekCompleted: number;
  latestAICoachingCreatedAt?: string;
}

const riskRank: Record<string, number> = {
  고위험: 5,
  관리주의: 4,
  주의: 4,
  허용: 3,
  안정: 2,
  에이스: 1
};

function riskPriority(item: AdminSortableRiderItem) {
  return riskRank[item.riskLevel] ?? 0;
}

function recentTime(item: AdminSortableRiderItem) {
  return item.latestAICoachingCreatedAt ? new Date(item.latestAICoachingCreatedAt).getTime() : 0;
}

function declineValue(item: AdminSortableRiderItem) {
  return item.changeRate < 0 ? item.changeRate : Number.POSITIVE_INFINITY;
}

function priorityFallback(a: AdminSortableRiderItem, b: AdminSortableRiderItem) {
  const riskDiff = riskPriority(b) - riskPriority(a);
  if (riskDiff) return riskDiff;
  const declineDiff = declineValue(a) - declineValue(b);
  if (declineDiff) return declineDiff;
  const completedDiff = a.currentWeekCompleted - b.currentWeekCompleted;
  if (completedDiff) return completedDiff;
  return recentTime(b) - recentTime(a);
}

export function sortAdminRiderItems<T extends AdminSortableRiderItem>(items: T[], option: AdminRiderSortOption): T[] {
  const copied = [...items];
  if (option === "default") return copied;

  return copied.sort((a, b) => {
    if (option === "decline-first") {
      const diff = declineValue(a) - declineValue(b);
      return diff || priorityFallback(a, b);
    }

    if (option === "low-completed") {
      const diff = a.currentWeekCompleted - b.currentWeekCompleted;
      return diff || priorityFallback(a, b);
    }

    if (option === "recent-ai") {
      const diff = recentTime(b) - recentTime(a);
      return diff || priorityFallback(a, b);
    }

    return priorityFallback(a, b);
  });
}
