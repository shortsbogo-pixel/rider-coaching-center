import assert from "node:assert/strict";
import test from "node:test";
import type { WeeklyAIBriefingSummary } from "../../../src/types/aiCoaching";
import { getDefaultWeeklyBriefing } from "./weeklyBriefingService";

const summary: WeeklyAIBriefingSummary = {
  totalRiders: 10,
  highRiskCount: 2,
  cautionCount: 3,
  stableCount: 4,
  declinedCount: 5,
  recoveredCount: 2,
  averageChangeRate: -4.2,
  topDeclinedRiders: [],
  topRecoveredRiders: [],
  actionCompletionRate: 62,
  coachingGeneratedCount: 7
};

test("weekly briefing service fallback returns a safe template briefing", () => {
  const result = getDefaultWeeklyBriefing("5월3주차", summary);

  assert.equal(result.weekKey, "5월3주차");
  assert.equal(result.isTemplate, true);
  assert.equal(result.source, "template");
  assert.equal(result.priorityActions.length, 3);
  assert.match(result.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(result.executiveSummary, /고위험/);
});
