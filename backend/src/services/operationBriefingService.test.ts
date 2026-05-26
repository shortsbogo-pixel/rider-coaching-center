import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateOperationBriefing } from "../../../src/utils/operationBriefingSummary";
import type { OperationBriefingSummaryInput } from "../../../src/types/operationBriefing";
import { generateOperationBriefing, getDefaultOperationBriefing } from "./operationBriefingService";

const summary: OperationBriefingSummaryInput = {
  weekKey: "5월2주차",
  summaryStats: {
    totalRiderCount: 10,
    highRiskRiderCount: 2,
    cautionRiderCount: 3,
    stableRiderCount: 5,
    decliningRiderCount: 4,
    recoveringRiderCount: 1,
    newOrReturningRiderCount: 1,
    dataWarningCount: 1,
    unsentQueueCount: 3,
    sentQueueCount: 7,
    incompleteChecklistItemCount: 6,
    weeklyAICoachingGeneratedCount: 5
  },
  riskRiderSummaries: [],
  messageQueueStats: { totalCount: 10, pendingCount: 3, sentCount: 7, heldCount: 0, highRiskPendingCount: 1 },
  actionChecklistStats: { targetRiderCount: 2, incompleteRiderCount: 1, incompleteItemCount: 6 },
  dataWarnings: ["전주 데이터 없음"],
  priorityActionHints: ["고위험 2명 확인", "미발송 3건 처리", "데이터 경고 1건 확인"]
};

test("operation briefing service fallback returns a safe template briefing", () => {
  const result = getDefaultOperationBriefing("5월2주차", summary);
  const sharedTemplate = createTemplateOperationBriefing("5월2주차", summary);

  assert.equal(result.weekKey, "5월2주차");
  assert.equal(result.isTemplate, true);
  assert.equal(result.source, "template");
  assert.deepEqual(result.priorityActions, sharedTemplate.priorityActions);
  assert.match(result.executiveSummary, /고위험 2명/);
});

test("operation briefing service respects AI_PROVIDER=template without calling Gemma", async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousMode = process.env.AI_MODE;
  process.env.AI_PROVIDER = "template";
  process.env.AI_MODE = "template";
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called in template mode");
  }) as typeof fetch;

  try {
    const result = await generateOperationBriefing("5??二쇱감", summary);

    assert.equal(fetchCalled, false);
    assert.equal(result.isTemplate, true);
    assert.equal(result.source, "template");
    assert.equal(result.provider, "template");
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.fallbackReason, undefined);
    assert.equal(result.templateVersion, "v1");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = previousProvider;
    }
    if (previousMode === undefined) {
      delete process.env.AI_MODE;
    } else {
      process.env.AI_MODE = previousMode;
    }
  }
});
