import assert from "node:assert/strict";
import test from "node:test";
import type { RiderRiskLevel } from "../types/rider";
import { sortAdminRiderItems, type AdminRiderSortOption, type AdminSortableRiderItem } from "./adminRiderSort";

function item(
  id: string,
  riskLevel: RiderRiskLevel,
  changeRate: number,
  currentWeekCompleted: number,
  latestAICoachingCreatedAt?: string
): AdminSortableRiderItem {
  return { id, riskLevel, changeRate, currentWeekCompleted, latestAICoachingCreatedAt };
}

function ids(option: AdminRiderSortOption, items: AdminSortableRiderItem[]) {
  return sortAdminRiderItems(items, option).map((entry) => entry.id);
}

test("admin rider sorting does not mutate source items", () => {
  const source = [
    item("stable", "안정", 5, 300),
    item("risk", "고위험", -10, 80)
  ];

  assert.deepEqual(ids("risk-first", source), ["risk", "stable"]);
  assert.deepEqual(source.map((entry) => entry.id), ["stable", "risk"]);
});

test("admin rider sorting prioritizes high risk and warning riders", () => {
  const source = [
    item("safe", "안정", -40, 10),
    item("warning", "관리주의", -5, 200),
    item("risk", "고위험", -1, 250)
  ];

  assert.deepEqual(ids("risk-first", source), ["risk", "warning", "safe"]);
});

test("admin rider sorting supports decline, low completed, recent coaching, and default order", () => {
  const source = [
    item("a", "안정", -5, 40, "2026-05-26T01:00:00.000Z"),
    item("b", "허용", -30, 90, "2026-05-26T03:00:00.000Z"),
    item("c", "에이스", 10, 10)
  ];

  assert.deepEqual(ids("decline-first", source), ["b", "a", "c"]);
  assert.deepEqual(ids("low-completed", source), ["c", "a", "b"]);
  assert.deepEqual(ids("recent-ai", source), ["b", "a", "c"]);
  assert.deepEqual(ids("default", source), ["a", "b", "c"]);
});
