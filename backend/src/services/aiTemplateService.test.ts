import assert from "node:assert/strict";
import test from "node:test";
import type { RiderRiskLevel } from "../../../src/types/rider";
import { classifyAIFallbackReason, createTemplateCoachingMessages, getAIModeConfig } from "./aiTemplateService";

function createInput(overrides: Partial<Parameters<typeof createTemplateCoachingMessages>[0]> = {}) {
  return {
    riderName: "김테스트",
    weekKey: "5월2주차",
    riskLevel: "고위험" as RiderRiskLevel,
    trendLabel: "급락",
    currentWeekCompleted: 20,
    previousWeekCompleted: 40,
    changeRate: -50,
    riskReasons: ["전주 대비 완료건수 50.0% 감소"],
    dataWarnings: [],
    fourWeekTrendSummary: "최근 4주 흐름: 60건 > 50건 > 40건 > 20건",
    recommendedManagerActions: ["기존 활동 시간대 회복 안내"],
    ...overrides
  };
}

test("template service returns high-risk sharp-drop coaching without Gemma", () => {
  const result = createTemplateCoachingMessages(createInput());

  assert.equal(result.isTemplate, true);
  assert.equal(result.source, "template");
  assert.equal(result.templateKey, "high-risk-sharp-drop");
  assert.equal(result.templateVersion, "v1");
  assert.match(result.adminMessage, /김테스트/);
  assert.match(result.riderMessage, /김테스트/);
  assert.match(result.kakaoMessage, /코아파트너스/);
  assert.match(result.smsMessage, /코아파트너스/);
});

test("template service uses data-insufficient wording when comparison data is missing", () => {
  const result = createTemplateCoachingMessages(
    createInput({
      trendLabel: "데이터 부족",
      previousWeekCompleted: 0,
      changeRate: 0,
      dataWarnings: ["전주 데이터가 없습니다."],
      riskReasons: ["전주 데이터 없음으로 확인 필요"]
    })
  );

  assert.equal(result.templateKey, "data-insufficient");
  assert.match(result.adminMessage, /확인/);
  assert.match(result.riderMessage, /확인/);
});

test("AI mode config normalizes template mode and fallback flag", () => {
  const config = getAIModeConfig({ AI_MODE: "template", AI_FALLBACK_ENABLED: "false" });

  assert.equal(config.mode, "template");
  assert.equal(config.fallbackEnabled, false);
});

test("fallback reason classifier separates template mode and timeout", () => {
  assert.equal(classifyAIFallbackReason("template"), "AI_MODE_TEMPLATE");
  assert.equal(classifyAIFallbackReason(new DOMException("timeout", "AbortError")), "GEMMA_TIMEOUT");
});
