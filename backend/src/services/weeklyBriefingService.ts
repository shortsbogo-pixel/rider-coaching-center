import type { WeeklyAIBriefingResult, WeeklyAIBriefingSummary } from "../../../src/types/aiCoaching";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e2b";

interface OllamaGenerateResponse {
  response?: string;
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeActions(value: unknown) {
  const fallback = [
    "고위험 라이더부터 활동 가능 시간 확인",
    "하락폭이 큰 라이더의 최근 활동 시간대 점검",
    "관리자 액션 체크리스트 미완료 대상 우선 처리"
  ];
  if (!Array.isArray(value)) return fallback;
  const actions = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 3);
  return actions.length ? [...actions, ...fallback].slice(0, 3) : fallback;
}

export function getDefaultWeeklyBriefing(weekKey: string, summary: WeeklyAIBriefingSummary): WeeklyAIBriefingResult {
  return {
    weekKey,
    briefingTitle: "이번 주 라이더 운영 브리핑",
    executiveSummary: `이번 주 ${summary.totalRiders}명 라이더 데이터 기준으로 고위험 ${summary.highRiskCount}명, 관리주의/주의 ${summary.cautionCount}명을 우선 확인해야 합니다.`,
    riskSummary: `하락 라이더 ${summary.declinedCount}명과 고위험 라이더를 중심으로 개별 확인이 필요합니다.`,
    priorityActions: [
      "고위험 라이더부터 활동 가능 시간 확인",
      "하락폭이 큰 라이더의 최근 활동 시간대 점검",
      "관리자 액션 체크리스트 미완료 대상 우선 처리"
    ],
    recommendedFocus: "이번 주는 완료건수 하락 라이더와 미조치 라이더 관리에 집중하는 것이 좋습니다.",
    messageForManagers: "브리핑 숫자는 시스템 계산값 기준입니다. 라이더별 코칭 이력과 액션 체크리스트를 함께 확인해 우선순위를 정리하세요.",
    isTemplate: true,
    source: "template",
    createdAt: new Date().toISOString()
  };
}

function buildPrompt(weekKey: string, summary: WeeklyAIBriefingSummary) {
  return `당신은 라이더 코칭센터의 관리자용 주간 운영 브리핑 작성자입니다.

아래 JSON은 시스템 코드가 이미 계산한 주간 요약 데이터입니다. 숫자는 절대 새로 계산하거나 추정하지 말고, 이 JSON에 있는 숫자만 사용하세요.

weekKey: ${weekKey}
summary:
${JSON.stringify(summary, null, 2)}

작성 조건:
- 한국어로 작성
- 회사 대표/관리자가 바로 이해할 수 있게 작성
- 너무 장황하지 않게 작성
- 실행 가능한 운영 제안 3개 포함
- 라이더를 비난하는 표현 금지
- 없는 숫자를 추정하거나 새로 만들지 말 것

반드시 아래 JSON 형식만 반환하세요. 마크다운 코드블록은 쓰지 마세요.
{
  "briefingTitle": "제목",
  "executiveSummary": "핵심 요약",
  "riskSummary": "위험 요약",
  "priorityActions": ["우선 액션 1", "우선 액션 2", "우선 액션 3"],
  "recommendedFocus": "이번 주 집중 포인트",
  "messageForManagers": "관리자에게 전달할 짧은 메시지"
}`;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Weekly briefing response did not include JSON");
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function parseOllamaWeeklyBriefing(response: string, weekKey: string, summary: WeeklyAIBriefingSummary): WeeklyAIBriefingResult {
  const parsed = extractJsonObject(response);
  const fallback = getDefaultWeeklyBriefing(weekKey, summary);

  return {
    weekKey,
    briefingTitle: cleanText(parsed.briefingTitle, fallback.briefingTitle),
    executiveSummary: cleanText(parsed.executiveSummary, fallback.executiveSummary),
    riskSummary: cleanText(parsed.riskSummary, fallback.riskSummary),
    priorityActions: normalizeActions(parsed.priorityActions),
    recommendedFocus: cleanText(parsed.recommendedFocus, fallback.recommendedFocus),
    messageForManagers: cleanText(parsed.messageForManagers, fallback.messageForManagers),
    isTemplate: false,
    source: "gemma4",
    createdAt: new Date().toISOString()
  };
}

async function generateWithOllama(weekKey: string, summary: WeeklyAIBriefingSummary): Promise<WeeklyAIBriefingResult> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 5000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(weekKey, summary),
      stream: false,
      temperature: 0.4,
      num_predict: 700
    }),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama weekly briefing request failed with status ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (!data.response) {
    throw new Error("Empty weekly briefing response from Ollama");
  }

  return parseOllamaWeeklyBriefing(data.response, weekKey, summary);
}

export async function generateWeeklyAIBriefing(weekKey: string, summary: WeeklyAIBriefingSummary): Promise<WeeklyAIBriefingResult> {
  try {
    return await generateWithOllama(weekKey, summary);
  } catch (error) {
    console.warn("[Weekly AI Briefing] Falling back to template.", error instanceof Error ? error.message : error);
    return getDefaultWeeklyBriefing(weekKey, summary);
  }
}
