import assert from "node:assert/strict";
import test from "node:test";
import { buildRiderMessageSummary, formatKakaoRiderMessage, formatSmsRiderMessage } from "./riderMessageFormatter";

test("formats a rider coaching message for Kakao or SMS copy", () => {
  const message = formatKakaoRiderMessage({
    riderName: "김라이더",
    riderMessage: "이번 주 완료건수가 조금 줄었습니다. 잘 나오던 시간대부터 다시 회복해보시면 좋겠습니다.",
    currentWeekCompleted: 80,
    changeRate: -20,
    riskLevel: "관리주의"
  });

  assert.match(message, /^\[코아파트너스 라이더 코칭 안내\]/);
  assert.match(message, /김라이더님/);
  assert.match(message, /이번 주 완료건수가 조금 줄었습니다/);
  assert.match(message, /센터에서 같이 활동 패턴을 확인/);
});

test("uses a safe fallback when rider message is empty", () => {
  const message = formatKakaoRiderMessage({ riderName: "김라이더", riderMessage: "", currentWeekCompleted: 0, changeRate: 0, riskLevel: "확인필요" });

  assert.match(message, /이번 주 활동 흐름을 확인했습니다/);
  assert.doesNotMatch(message, /undefined|null/);
});

test("builds risk-aware summary without recalculating source metrics", () => {
  assert.match(buildRiderMessageSummary({ currentWeekCompleted: 70, changeRate: -25, riskLevel: "고위험" }), /완료 70건/);
  assert.match(buildRiderMessageSummary({ currentWeekCompleted: 120, changeRate: 8, riskLevel: "안정" }), /안정적/);
});

test("formats a concise SMS message", () => {
  const message = formatSmsRiderMessage({
    riderName: "김라이더",
    currentWeekCompleted: 70,
    changeRate: -25,
    riskLevel: "고위험"
  });

  assert.match(message, /^김라이더님/);
  assert.match(message, /코아파트너스$/);
  assert.ok(message.length < 160);
});
