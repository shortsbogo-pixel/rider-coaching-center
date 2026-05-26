import assert from "node:assert/strict";
import test from "node:test";
import { buildRiderMessageSummary, formatKakaoRiderMessage, formatSmsRiderMessage } from "./riderMessageFormatter";

test("formats a soft Kakao copy message while preserving the rider message", () => {
  const message = formatKakaoRiderMessage({
    riderName: "김라이더",
    riderMessage: "이번 주에는 피크 이후 시간대 회복을 먼저 추천드립니다.",
    currentWeekCompleted: 80,
    changeRate: -20,
    riskLevel: "관리주의"
  });

  assert.match(message, /^\[코아파트너스 라이더 코칭 안내\]/);
  assert.match(message, /김라이더님/);
  assert.match(message, /완료 80건/);
  assert.match(message, /-20\.0%/);
  assert.match(message, /이번 주에는 피크 이후 시간대 회복을 먼저 추천드립니다\./);
  assert.match(message, /센터에서 같이 활동 패턴을 확인해드리겠습니다\./);
  assert.doesNotMatch(message, /undefined|null|NaN/);
});

test("builds risk-aware summaries from existing metrics", () => {
  assert.match(buildRiderMessageSummary({ currentWeekCompleted: 70, changeRate: -25, riskLevel: "고위험" }), /관리 확인이 필요한/);
  assert.match(buildRiderMessageSummary({ currentWeekCompleted: 100, changeRate: -12.5, riskLevel: "주의" }), /회복 방향을 같이 잡아볼/);
  assert.match(buildRiderMessageSummary({ currentWeekCompleted: 120, changeRate: 8, riskLevel: "안정" }), /안정적인 활동을 유지/);
  assert.match(buildRiderMessageSummary({ currentWeekCompleted: 0, changeRate: 0, riskLevel: "확인필요" }), /추가 확인이 필요한/);
});

test("formats a concise SMS copy message", () => {
  const message = formatSmsRiderMessage({
    riderName: "김라이더",
    currentWeekCompleted: 70,
    changeRate: -25,
    riskLevel: "고위험"
  });

  assert.match(message, /^김라이더님, 이번 주 활동 흐름 확인 결과/);
  assert.match(message, /다음 주에는 기존 활동 시간대 회복을 우선 추천드립니다\. - 코아파트너스$/);
  assert.ok(message.length < 170);
});
