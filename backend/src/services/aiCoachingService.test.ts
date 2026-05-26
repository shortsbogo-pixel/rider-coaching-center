import assert from "node:assert/strict";
import test from "node:test";
import orders from "../../../src/data/sampleOrders.json";
import riders from "../../../src/data/sampleRiders.json";
import type { OrderRecord } from "../../../src/types/order";
import type { RiderProfile } from "../../../src/types/rider";
import { buildRiderMetrics } from "../../../src/utils/scoring";
import { buildOllamaGenerateRequestBody, buildOllamaStatusRequestBody, generateAICoachingMessages } from "./aiCoachingService";

const sampleRiskLevel = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[])[0].riskLevel;

function setEnv(name: string, value: string | undefined) {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  return () => {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  };
}

function createInput() {
  return {
    riderName: "김테스트",
    previousWeekCompleted: 40,
    currentWeekCompleted: 20,
    changeRate: -50,
    riskLevel: sampleRiskLevel
  };
}

test("Ollama generate request uses default context and prediction options", () => {
  const body = buildOllamaGenerateRequestBody("test prompt");

  assert.equal(body.options.num_ctx, 1024);
  assert.equal(body.options.num_predict, 300);
});

test("Ollama status request uses the default context option", () => {
  const body = buildOllamaStatusRequestBody();

  assert.equal(body.options.num_ctx, 1024);
});

test("AI_PROVIDER=template returns a template without calling Gemma", async () => {
  const restoreProvider = setEnv("AI_PROVIDER", "template");
  const restoreMode = setEnv("AI_MODE", "template");
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called in template mode");
  }) as typeof fetch;

  try {
    const result = await generateAICoachingMessages(createInput());

    assert.equal(fetchCalled, false);
    assert.equal(result.isTemplate, true);
    assert.equal(result.source, "template");
    assert.equal(result.provider, "template");
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.fallbackReason, undefined);
    assert.ok(result.templateKey);
    assert.equal(result.templateVersion, "v1");
  } finally {
    globalThis.fetch = originalFetch;
    restoreMode();
    restoreProvider();
  }
});

test("AI_MODE=auto falls back to a template when Gemma fails", async () => {
  const restoreProvider = setEnv("AI_PROVIDER", "ollama");
  const restoreMode = setEnv("AI_MODE", "auto");
  const restoreFallback = setEnv("AI_FALLBACK_ENABLED", "true");
  const restoreRetry = setEnv("OLLAMA_RETRY_COUNT", "1");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("fetch failed");
  }) as typeof fetch;

  try {
    const result = await generateAICoachingMessages(createInput());

    assert.equal(result.isTemplate, true);
    assert.equal(result.source, "template");
    assert.equal(result.provider, "ollama");
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.fallbackReason, "OLLAMA_UNAVAILABLE");
  } finally {
    globalThis.fetch = originalFetch;
    restoreRetry();
    restoreFallback();
    restoreMode();
    restoreProvider();
  }
});
