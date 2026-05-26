import type { RiderRiskLevel } from "../../../src/types/rider";
import type { AIFallbackReason } from "../../../src/types/aiCoaching";
import type { AICoachingAnalysisContext } from "../../../src/utils/riderTrendAnalysis";

export type AIMode = "auto" | "gemma" | "template";
export type { AIFallbackReason };

export interface AIModeConfig {
  mode: AIMode;
  fallbackEnabled: boolean;
}

export interface AITemplateInput {
  riderName: string;
  weekKey?: string;
  riskLevel: RiderRiskLevel | string;
  trendLabel?: string;
  currentWeekCompleted: number;
  previousWeekCompleted: number;
  changeRate: number;
  riskReasons?: string[];
  dataWarnings?: string[];
  fourWeekTrendSummary?: string;
  recommendedManagerActions?: string[];
  analysisContext?: AICoachingAnalysisContext;
}

export interface AITemplateOutput {
  adminMessage: string;
  riderMessage: string;
  kakaoMessage: string;
  smsMessage: string;
  templateKey: string;
  templateVersion: "v1";
  isTemplate: true;
  source: "template";
}

const TEMPLATE_VERSION: AITemplateOutput["templateVersion"] = "v1";

function includesAny(value: string, patterns: string[]) {
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function compactList(values?: string[]) {
  return (values ?? []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim());
}

function normalizeMode(value: string | undefined): AIMode {
  if (value === "gemma" || value === "template" || value === "auto") return value;
  return "auto";
}

export function getAIModeConfig(env: Record<string, string | undefined> = process.env): AIModeConfig {
  return {
    mode: normalizeMode(env.AI_MODE),
    fallbackEnabled: String(env.AI_FALLBACK_ENABLED ?? "true").toLowerCase() !== "false"
  };
}

function normalizeTemplateInput(input: AITemplateInput) {
  const analysisContext = input.analysisContext;
  return {
    ...input,
    trendLabel: input.trendLabel || analysisContext?.trendLabel || "",
    riskReasons: compactList(input.riskReasons ?? analysisContext?.riskReasons),
    dataWarnings: compactList(input.dataWarnings ?? analysisContext?.dataWarnings),
    fourWeekTrendSummary: input.fourWeekTrendSummary || analysisContext?.fourWeekTrendSummary || "",
    recommendedManagerActions: compactList(input.recommendedManagerActions ?? analysisContext?.recommendedManagerActions)
  };
}

function riskGroup(riskLevel: string) {
  if (includesAny(riskLevel, ["고위험", "怨좎쐞", "high"])) return "high";
  if (includesAny(riskLevel, ["관리주의", "愿由", "caution"])) return "caution";
  if (includesAny(riskLevel, ["주의", "warning"])) return "warning";
  if (includesAny(riskLevel, ["안정", "허용", "?덉젙", "?덉슜", "stable", "safe"])) return "stable";
  if (includesAny(riskLevel, ["예외", "확인", "exception"])) return "exception";
  return "unknown";
}

function trendGroup(trendLabel: string) {
  if (includesAny(trendLabel, ["급락", "湲됰씫", "sharp"])) return "sharp-drop";
  if (includesAny(trendLabel, ["하락", "?섎씫", "decline"])) return "decline";
  if (includesAny(trendLabel, ["회복", "복귀", "?뚮났", "蹂듦", "return"])) return "returning";
  if (includesAny(trendLabel, ["신규", "?좉퇋", "new"])) return "new";
  if (includesAny(trendLabel, ["데이터 부족", "확인 필요", "?곗씠", "?뺤씤", "insufficient", "check"])) return "insufficient";
  if (includesAny(trendLabel, ["안정", "?덉젙", "stable"])) return "stable";
  return "unknown";
}

export function selectTemplateKey(input: AITemplateInput) {
  const normalized = normalizeTemplateInput(input);
  const risk = riskGroup(String(normalized.riskLevel));
  const trend = trendGroup(normalized.trendLabel);
  const hasDataWarnings = normalized.dataWarnings.length > 0;

  if (hasDataWarnings || trend === "insufficient") return "data-insufficient";
  if (trend === "new") return "new-rider";
  if (trend === "returning") return "returning-rider";
  if (risk === "high" && trend === "sharp-drop") return "high-risk-sharp-drop";
  if (risk === "high" && trend === "decline") return "high-risk-decline";
  if (risk === "caution" && trend === "decline") return "caution-decline";
  if (risk === "warning" || risk === "exception") return "warning-check-needed";
  if (risk === "stable" && (trend === "stable" || trend === "unknown")) return "stable";
  return "exception-check";
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "비교 불가";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function firstOrDefault(values: string[], fallback: string) {
  return values[0] || fallback;
}

function actionText(actions: string[]) {
  return actions.length ? actions.slice(0, 2).join(", ") : "기존 활동 시간대와 최근 흐름을 함께 확인";
}

function summaryLine(input: ReturnType<typeof normalizeTemplateInput>) {
  return `${input.currentWeekCompleted}건, 전주 대비 ${formatRate(input.changeRate)}`;
}

function templateCopy(input: ReturnType<typeof normalizeTemplateInput>, templateKey: string) {
  const name = input.riderName.trim() || "라이더";
  const reason = firstOrDefault(input.riskReasons, `${input.trendLabel || input.riskLevel} 흐름 확인`);
  const warning = firstOrDefault(input.dataWarnings, "");
  const action = actionText(input.recommendedManagerActions);
  const summary = summaryLine(input);

  const copyByKey: Record<string, { admin: string; rider: string }> = {
    "high-risk-sharp-drop": {
      admin: `[${name}] 고위험 급락 흐름입니다. ${summary} 기준으로 ${reason} 사유가 있어 우선 연락과 활동 패턴 확인이 필요합니다.`,
      rider: `${name}님, 이번 주 활동 흐름이 이전보다 크게 낮아진 것으로 확인됩니다. 무리하게 늘리기보다 기존에 잘 나오던 시간대부터 천천히 회복해보시면 좋겠습니다. 필요하면 센터에서 함께 패턴을 확인해드리겠습니다.`
    },
    "high-risk-decline": {
      admin: `[${name}] 고위험 하락세가 이어지고 있습니다. ${summary} 기준이며 ${action}을 우선 권장합니다.`,
      rider: `${name}님, 최근 활동 흐름이 조금 내려간 상태로 보입니다. 이번 주에는 부담을 키우기보다 익숙한 시간대부터 안정적으로 회복하는 방향을 추천드립니다.`
    },
    "caution-decline": {
      admin: `[${name}] 관리주의 하락 흐름입니다. ${summary} 기준으로 회복 방향 안내와 다음 주 모니터링이 필요합니다.`,
      rider: `${name}님, 이번 주 활동 흐름이 다소 낮아진 모습입니다. 기존에 잘 맞던 시간대를 중심으로 다시 페이스를 잡아보시면 좋겠습니다.`
    },
    "warning-check-needed": {
      admin: `[${name}] 확인이 필요한 코칭 대상입니다. ${reason} 내용을 먼저 확인한 뒤 문구를 전달하세요.`,
      rider: `${name}님, 이번 주 활동 흐름에서 확인이 필요한 부분이 있어 안내드립니다. 센터에서 활동 패턴을 함께 살펴보고 다음 주 방향을 잡아드리겠습니다.`
    },
    stable: {
      admin: `[${name}] 안정적인 운영 흐름입니다. ${summary} 기준으로 현재 페이스 유지와 격려 중심 안내를 권장합니다.`,
      rider: `${name}님, 이번 주도 안정적인 활동 흐름을 보여주셨습니다. 지금처럼 무리하지 않는 페이스를 유지하면서 좋은 흐름을 이어가시면 좋겠습니다.`
    },
    "new-rider": {
      admin: `[${name}] 신규 라이더로 비교 기준이 부족합니다. 첫 활동 패턴을 확인하며 무리한 위험 분류 없이 안내하세요.`,
      rider: `${name}님, 이번 주 활동 데이터가 새로 확인되었습니다. 처음부터 무리하기보다 잘 맞는 시간대를 찾아 안정적으로 시작해보시면 좋겠습니다.`
    },
    "returning-rider": {
      admin: `[${name}] 복귀 흐름입니다. 이전 활동 공백 이후의 패턴을 확인하고 안정적인 재진입을 안내하세요.`,
      rider: `${name}님, 다시 활동 흐름이 확인되고 있습니다. 바로 무리하기보다 익숙한 구간부터 안정적으로 페이스를 회복해보시면 좋겠습니다.`
    },
    "data-insufficient": {
      admin: `[${name}] 데이터 확인이 먼저 필요합니다. ${warning || reason} 항목 때문에 무리한 위험 판단보다 업로드/주차 데이터를 확인하세요.`,
      rider: `${name}님, 이번 주 활동 흐름을 확인 중이며 일부 데이터는 추가 확인이 필요합니다. 확인 후 필요한 안내를 다시 드리겠습니다.`
    },
    "exception-check": {
      admin: `[${name}] 예외/확인 필요 대상입니다. ${reason} 내용을 기준으로 데이터와 활동 패턴을 먼저 확인하세요.`,
      rider: `${name}님, 이번 주 활동 흐름에서 추가 확인이 필요한 부분이 있습니다. 센터에서 내용을 확인한 뒤 필요한 방향을 안내드리겠습니다.`
    }
  };

  return copyByKey[templateKey] ?? copyByKey["exception-check"];
}

function buildKakaoMessage(input: ReturnType<typeof normalizeTemplateInput>, riderMessage: string) {
  const name = input.riderName.trim() || "라이더";
  return [
    "[코아파트너스 라이더 코칭 안내]",
    `${name}님, 이번 주 활동 흐름을 확인해보니 ${summaryLine(input)} 흐름이 보입니다.`,
    riderMessage,
    "필요하면 센터에서 같이 활동 패턴을 확인해드리겠습니다."
  ].join("\n");
}

function buildSmsMessage(input: ReturnType<typeof normalizeTemplateInput>) {
  const name = input.riderName.trim() || "라이더";
  return `${name}님, 이번 주 활동 흐름 확인 결과 ${summaryLine(input)} 흐름이 보입니다. 다음 주에는 기존 활동 시간대 회복을 우선 추천드립니다. - 코아파트너스`;
}

export function createTemplateCoachingMessages(input: AITemplateInput): AITemplateOutput {
  const normalized = normalizeTemplateInput(input);
  const templateKey = selectTemplateKey(normalized);
  const copy = templateCopy(normalized, templateKey);

  return {
    adminMessage: copy.admin,
    riderMessage: copy.rider,
    kakaoMessage: buildKakaoMessage(normalized, copy.rider),
    smsMessage: buildSmsMessage(normalized),
    templateKey,
    templateVersion: TEMPLATE_VERSION,
    isTemplate: true,
    source: "template"
  };
}

export function classifyAIFallbackReason(error: unknown): AIFallbackReason {
  if (error === "template") return "AI_MODE_TEMPLATE";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (error instanceof Error && error.name === "AbortError") return "GEMMA_TIMEOUT";
  if (includesAny(normalized, ["timeout", "timed out", "abort"])) return "GEMMA_TIMEOUT";
  if (includesAny(normalized, ["memory", "runtime", "num_ctx", "out of memory", "model load"])) return "GEMMA_MEMORY_OR_RUNTIME_ERROR";
  if (includesAny(normalized, ["fetch failed", "econnrefused", "ollama", "unavailable", "connection"])) return "OLLAMA_UNAVAILABLE";
  if (includesAny(normalized, ["manus"])) return "MANUS_DEPLOYMENT_FALLBACK";
  return "API_ERROR";
}
