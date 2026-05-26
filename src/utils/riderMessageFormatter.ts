interface RiderMessageMetricInput {
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: string;
}

interface FormatKakaoRiderMessageInput extends RiderMessageMetricInput {
  riderName: string;
  riderMessage: string;
}

interface FormatSmsRiderMessageInput extends RiderMessageMetricInput {
  riderName: string;
}

function recipientName(riderName: string) {
  const trimmed = riderName.trim() || "라이더";
  return trimmed.endsWith("님") ? trimmed : `${trimmed}님`;
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatRate(value: number) {
  const safeValue = safeNumber(value);
  const sign = safeValue > 0 ? "+" : "";
  return `${sign}${safeValue.toFixed(1)}%`;
}

function isHighRisk(riskLevel: string) {
  return riskLevel === "고위험";
}

function isCautionRisk(riskLevel: string) {
  return riskLevel === "관리주의" || riskLevel === "주의";
}

function isStableRisk(riskLevel: string) {
  return riskLevel === "안정" || riskLevel === "활용" || riskLevel === "세이프";
}

export function buildRiderMessageSummary({ currentWeekCompleted, changeRate, riskLevel }: RiderMessageMetricInput) {
  const completed = safeNumber(currentWeekCompleted);
  const rateLabel = formatRate(changeRate);

  if (isHighRisk(riskLevel)) {
    return `완료 ${completed}건, 전주 대비 ${rateLabel}로 활동 회복과 관리 확인이 필요한`;
  }
  if (isCautionRisk(riskLevel)) {
    return `완료 ${completed}건, 전주 대비 ${rateLabel}로 회복 방향을 같이 잡아볼`;
  }
  if (isStableRisk(riskLevel)) {
    return `완료 ${completed}건, 전주 대비 ${rateLabel}로 안정적인 활동을 유지하고 있는`;
  }
  return `완료 ${completed}건 기준으로 추가 확인이 필요한`;
}

export function formatKakaoRiderMessage({
  riderName,
  riderMessage,
  currentWeekCompleted,
  changeRate,
  riskLevel
}: FormatKakaoRiderMessageInput) {
  const summary = buildRiderMessageSummary({ currentWeekCompleted, changeRate, riskLevel });
  const body = riderMessage.trim();

  return [
    "[코아파트너스 라이더 코칭 안내]",
    `${recipientName(riderName)}, 이번 주 활동 흐름을 확인해보니 ${summary} 흐름이 보입니다.`,
    body,
    "무리하게 늘리기보다는 기존에 잘 나오던 시간대부터 다시 안정적으로 회복해보시면 좋겠습니다.",
    "필요하면 센터에서 같이 활동 패턴을 확인해드리겠습니다."
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatSmsRiderMessage({ riderName, currentWeekCompleted, changeRate, riskLevel }: FormatSmsRiderMessageInput) {
  const summary = buildRiderMessageSummary({ currentWeekCompleted, changeRate, riskLevel });
  return `${recipientName(riderName)}, 이번 주 활동 흐름 확인 결과 ${summary} 흐름이 보입니다. 다음 주에는 기존 활동 시간대 회복을 우선 추천드립니다. - 코아파트너스`;
}
