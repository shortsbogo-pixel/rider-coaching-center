import assert from "node:assert/strict";
import test from "node:test";
import orders from "../../../../src/data/sampleOrders.json";
import riders from "../../../../src/data/sampleRiders.json";
import type { OrderRecord } from "../../../../src/types/order";
import type { RiderProfile } from "../../../../src/types/rider";
import { buildRiderMetrics } from "../../../../src/utils/scoring";
import { createAIProvider, getAIProviderConfig } from "./providerFactory";

const sampleRiskLevel = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[])[0].riskLevel;

const coachingInput = {
  riderName: "김테스트",
  previousWeekCompleted: 40,
  currentWeekCompleted: 20,
  changeRate: -50,
  riskLevel: sampleRiskLevel
};

test("provider config normalizes supported provider and mode values", () => {
  const config = getAIProviderConfig({
    AI_PROVIDER: "template",
    AI_MODE: "template",
    AI_FALLBACK_ENABLED: "true"
  });

  assert.equal(config.provider, "template");
  assert.equal(config.mode, "template");
  assert.equal(config.fallbackEnabled, true);
});

test("template provider returns template output without calling external AI", async () => {
  const provider = createAIProvider({
    provider: "template",
    mode: "auto",
    fallbackEnabled: true
  });

  const result = await provider.generateCoachingMessage(coachingInput);

  assert.equal(result.isTemplate, true);
  assert.equal(result.source, "template");
  assert.equal(result.provider, "template");
  assert.equal(result.fallbackUsed, false);
  assert.ok(result.templateKey);
  assert.equal(result.templateVersion, "v1");
});

test("openai provider without API key safely falls back to template", async () => {
  const provider = createAIProvider({
    provider: "openai",
    mode: "auto",
    fallbackEnabled: true,
    env: { OPENAI_API_KEY: "" }
  });

  const result = await provider.generateCoachingMessage(coachingInput);

  assert.equal(result.isTemplate, true);
  assert.equal(result.source, "template");
  assert.equal(result.provider, "openai");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.fallbackReason, "API_ERROR");
});

test("gemini provider without API key safely falls back to template", async () => {
  const provider = createAIProvider({
    provider: "gemini",
    mode: "auto",
    fallbackEnabled: true,
    env: { GEMINI_API_KEY: "" }
  });

  const result = await provider.generateCoachingMessage(coachingInput);

  assert.equal(result.isTemplate, true);
  assert.equal(result.source, "template");
  assert.equal(result.provider, "gemini");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.fallbackReason, "API_ERROR");
});

test("ollama provider failure safely falls back to template when enabled", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("Ollama unavailable");
  }) as typeof fetch;

  try {
    const provider = createAIProvider({
      provider: "ollama",
      mode: "auto",
      fallbackEnabled: true,
      env: { OLLAMA_BASE_URL: "http://localhost:1", OLLAMA_TIMEOUT_MS: "10" }
    });

    const result = await provider.generateCoachingMessage(coachingInput);

    assert.equal(result.isTemplate, true);
    assert.equal(result.source, "template");
    assert.equal(result.provider, "ollama");
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.fallbackReason, "OLLAMA_UNAVAILABLE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
