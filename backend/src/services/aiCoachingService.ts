import type { RiderRiskLevel } from "../../../src/types/rider";
import type { AICoachingAnalysisContext } from "../../../src/utils/riderTrendAnalysis";

interface AICoachingInput {
  riderName: string;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: RiderRiskLevel;
  analysisContext?: AICoachingAnalysisContext;
}

interface AICoachingOutput {
  adminMessage: string;
  riderMessage: string;
  isTemplate: boolean;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e2b";
const OLLAMA_NUM_CTX = readPositiveInt(process.env.OLLAMA_NUM_CTX, 1024);
const OLLAMA_NUM_PREDICT = readPositiveInt(process.env.OLLAMA_NUM_PREDICT, 300);

export interface OllamaStatusResult {
  ollamaConnected: boolean;
  model: string;
  gemmaResponding: boolean;
  checkedAt: string;
  fallbackUsed: boolean;
  message: string;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function buildOllamaGenerateRequestBody(prompt: string) {
  return {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: {
      temperature: 0.7,
      num_ctx: OLLAMA_NUM_CTX,
      num_predict: OLLAMA_NUM_PREDICT
    }
  };
}

export function buildOllamaStatusRequestBody() {
  return {
    model: OLLAMA_MODEL,
    prompt: "Reply with OK only.",
    stream: false,
    options: {
      temperature: 0,
      num_ctx: OLLAMA_NUM_CTX,
      num_predict: 8
    }
  };
}

// 기본 템플릿 메시지 생성
function getTemplateMessages(input: AICoachingInput): AICoachingOutput {
  const { riderName, previousWeekCompleted, currentWeekCompleted, changeRate, riskLevel, analysisContext } = input;
  const trend = changeRate > 0 ? "증가" : changeRate < 0 ? "감소" : "유지";
  const trendLabel = analysisContext?.trendLabel ? ` · 추세 ${analysisContext.trendLabel}` : "";
  const firstRiskReason = analysisContext?.riskReasons[0] ? ` (${analysisContext.riskReasons[0]})` : "";

  const adminMessages: Record<RiderRiskLevel, (name: string, prev: number, curr: number, rate: number) => string> = {
    고위험: () => `⚠️ [${riderName}] 위험 수준 확대 추세${trendLabel}. 전주 대비 ${trend}. 즉시 개입 필요${firstRiskReason}`,
    관리주의: () => `📊 [${riderName}] 관리 주의 대상${trendLabel}. 주간 ${trend} 패턴 모니터링${firstRiskReason}`,
    허용: () => `✓ [${riderName}] 일반 수준${trendLabel}. 지속적인 성과 관리${firstRiskReason}`,
    안정: () => `📈 [${riderName}] 안정적 운영 중${trendLabel}. 성과 유지 지도${firstRiskReason}`,
    에이스: () => `⭐ [${riderName}] 우수 운영자${trendLabel}. 스스로 성과 관리 중${firstRiskReason}`
  };

  const riderMessages: Record<RiderRiskLevel, (name: string, prev: number, curr: number, rate: number) => string> = {
    고위험: (name, prev, curr, rate) =>
      `${name}님, 이번주 완료 건수(${curr}건)를 살펴보니 선제적인 개선이 필요해 보입니다. 우리 팀이 함께 원인을 분석해 드릴 테니 언제든 연락 주세요.`,
    관리주의: (name, prev, curr, rate) =>
      `${name}님, 이번주 성과(${curr}건)를 응원합니다. 앞으로도 꾸준한 노력으로 좋은 결과 만들어 가요!`,
    허용: (name, prev, curr, rate) =>
      `${name}님, 이번주도 성실한 운영 감사합니다(${curr}건). 앞으로도 페이스 조절하며 함께 성장해요!`,
    안정: (name, prev, curr, rate) =>
      `${name}님, 안정적인 성과 유지 감사합니다(${curr}건). 이 수준을 유지하며 함께 목표 달성해요!`,
    에이스: (name, prev, curr, rate) =>
      `${name}님, 우수한 성과 계속해 주셔서 감사합니다(${curr}건). 우리 팀의 모범입니다!`
  };

  return {
    adminMessage: adminMessages[riskLevel](riderName, previousWeekCompleted, currentWeekCompleted, changeRate),
    riderMessage: riderMessages[riskLevel](riderName, previousWeekCompleted, currentWeekCompleted, changeRate),
    isTemplate: true
  };
}

// Ollama에서 AI 코칭 메시지 생성
async function generateWithOllama(input: AICoachingInput): Promise<AICoachingOutput> {
  const prompt = buildPrompt(input);

  // apply a short timeout so batch requests don't hang when Ollama is unreachable
  const controller = new AbortController();
  const timeoutMs = readPositiveInt(process.env.OLLAMA_TIMEOUT_MS, 30000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOllamaGenerateRequestBody(prompt)),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { response?: string };
  if (!data.response) {
    throw new Error("Empty response from Ollama");
  }

  // parseOllamaResponse may choose to throw or return a parsed value
  const parsed = parseOllamaResponse(data.response, input);
  if (!parsed) {
    throw new Error("Failed to parse Ollama response");
  }

  return parsed;
}

// 프롬프트 생성
function buildPrompt(input: AICoachingInput): string {
  const { riderName, previousWeekCompleted, currentWeekCompleted, changeRate, riskLevel, analysisContext } = input;
  const trend = changeRate > 0 ? "증가" : changeRate < 0 ? "감소" : "유지";
  const changePercent = Math.abs(changeRate).toFixed(1);
  const analysisSection = analysisContext
    ? `
Calculated Analysis Context:
- Trend Label: ${analysisContext.trendLabel}
- Risk Reasons: ${analysisContext.riskReasons.join(" / ") || "none"}
- Data Warnings: ${analysisContext.dataWarnings.join(" / ") || "none"}
- Four Week Trend Summary: ${analysisContext.fourWeekTrendSummary}
- Recommended Manager Actions: ${analysisContext.recommendedManagerActions.join(" / ") || "none"}`
    : "";

  return `You are a supportive delivery coaching assistant. Generate TWO coaching messages based on the following rider performance data:

Rider Information:
- Name: ${riderName}
- Previous Week Completions: ${previousWeekCompleted}
- Current Week Completions: ${currentWeekCompleted}
- Change Rate: ${changePercent}% (${trend})
- Risk Level: ${riskLevel}
${analysisSection}

IMPORTANT:
- Use only the provided numbers and analysis results.
- Do not calculate, infer, estimate, or create any new numbers.
- Gemma 4 must explain and summarize only; the application code already calculated the metrics.
- Do NOT calculate or provide monetary amounts.

Generate exactly two messages separated by ---|---:

1. Admin Message (1-2 sentences): Short, direct coaching point for the admin team. Start with an appropriate emoji (⚠️📊✓📈⭐).

2. Rider Message (2-3 sentences): Warm, encouraging message for the rider in Korean. Always address the rider by name.

Format your response exactly as:
[Admin Message here]---|---[Rider message here in Korean]`;
}

// Ollama 응답 파싱
function parseOllamaResponse(response: string, input: AICoachingInput): AICoachingOutput {
  const parts = response.split("---|---");

  if (parts.length < 2) {
    throw new Error("Invalid response format from Ollama");
  }

  const adminMessage = parts[0].trim();
  const riderMessage = parts[1].trim();

  if (!adminMessage || !riderMessage) {
    throw new Error("Empty admin or rider message in Ollama response");
  }

  if (adminMessage.length < 10 || riderMessage.length < 20) {
    throw new Error("Ollama response content too short");
  }

  return {
    adminMessage,
    riderMessage,
    isTemplate: false
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// 공개 인터페이스
export async function generateAICoachingMessages(input: AICoachingInput): Promise<AICoachingOutput> {
  // 입력값 검증
  if (!input.riderName || input.riderName.trim().length === 0) {
    throw new Error("라이더 이름이 필요합니다.");
  }
  if (typeof input.previousWeekCompleted !== "number" || input.previousWeekCompleted < 0) {
    throw new Error("전주 완료건수는 0 이상이어야 합니다.");
  }
  if (typeof input.currentWeekCompleted !== "number" || input.currentWeekCompleted < 0) {
    throw new Error("이번주 완료건수는 0 이상이어야 합니다.");
  }
  if (typeof input.changeRate !== "number" || isNaN(input.changeRate)) {
    throw new Error("변화율은 유효한 숫자여야 합니다.");
  }
  if (!["고위험", "관리주의", "허용", "안정", "에이스"].includes(input.riskLevel)) {
    throw new Error("위험유형이 유효하지 않습니다.");
  }

  // 재시도 설정
  const retries = Math.max(1, Number(process.env.OLLAMA_RETRY_COUNT ?? 3));
  const baseBackoffMs = Math.max(100, Number(process.env.OLLAMA_RETRY_BASE_MS ?? 500));
  const maxBackoffMs = Math.max(baseBackoffMs, Number(process.env.OLLAMA_RETRY_MAX_MS ?? 5000));

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastError: unknown = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await generateWithOllama(input);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const willRetry = attempt < retries - 1;

      if (isAbortError(err)) {
        console.warn(`[AI Coaching] Ollama attempt ${attempt + 1} timed out after ${process.env.OLLAMA_TIMEOUT_MS ?? 3000}ms`);
      } else {
        console.warn(`[AI Coaching] Ollama attempt ${attempt + 1} failed:`, message);
      }

      if (!willRetry) {
        break;
      }

      const backoff = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, attempt));
      console.info(`[AI Coaching] retrying in ${backoff}ms (attempt ${attempt + 2}/${retries})`);
      await sleep(backoff);
    }
  }

  console.warn("[AI Coaching] All Ollama attempts failed, falling back to template.", lastError);
  return getTemplateMessages(input);
}

// 테스트용: 기본 템플릿만 반환
export function getDefaultCoachingMessages(input: AICoachingInput): AICoachingOutput {
  return getTemplateMessages(input);
}

export async function checkOllamaStatus(): Promise<OllamaStatusResult> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeoutMs = readPositiveInt(process.env.OLLAMA_STATUS_TIMEOUT_MS, 30000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildOllamaStatusRequestBody()),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return {
        ollamaConnected: true,
        model: OLLAMA_MODEL,
        gemmaResponding: false,
        checkedAt,
        fallbackUsed: true,
        message: `Ollama responded with status ${response.status}`
      };
    }

    const data = (await response.json()) as { response?: string };
    return {
      ollamaConnected: true,
      model: OLLAMA_MODEL,
      gemmaResponding: typeof data.response === "string" && data.response.trim().length > 0,
      checkedAt,
      fallbackUsed: !(typeof data.response === "string" && data.response.trim().length > 0),
      message: typeof data.response === "string" && data.response.trim().length > 0 ? "Gemma 4 연결 정상" : "Gemma 4 응답이 비어 있습니다."
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      ollamaConnected: false,
      model: OLLAMA_MODEL,
      gemmaResponding: false,
      checkedAt,
      fallbackUsed: true,
      message: error instanceof Error ? error.message : "Ollama status check failed"
    };
  }
}
