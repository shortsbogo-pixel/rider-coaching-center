import type { OperationBriefingResult, OperationBriefingSummaryInput } from "../../../src/types/operationBriefing";
import { createTemplateOperationBriefing } from "../../../src/utils/operationBriefingSummary";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e2b";

interface OllamaGenerateResponse {
  response?: string;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeActions(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const actions = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 3);
  return actions.length ? [...actions, ...fallback].slice(0, 3) : fallback;
}

function buildPrompt(weekKey: string, summary: OperationBriefingSummaryInput) {
  return `당신은 CORE PARTNERS 라이더 코칭센터의 AI 운영본부 브리핑 작성자입니다.

아래 JSON은 애플리케이션 코드가 이미 계산한 확정 운영 집계값입니다.
Gemma 4는 숫자를 새로 계산하거나 추정하지 말고, 제공된 숫자와 근거만 사용해 관리자용 운영 문장을 작성하세요.

weekKey: ${weekKey}
summary:
${JSON.stringify(summary, null, 2)}

작성 조건:
- 한국어로 작성
- 숫자는 제공된 JSON 값만 사용
- 새로운 수치, 비율, 순위를 만들지 않음
- 관리자가 오늘 처리할 우선순위가 분명하게 보이게 작성
- 라이더를 비난하지 않는 운영 문체 사용
- priorityActions는 정확히 3개
- 반드시 아래 JSON 형식만 반환하고 마크다운 코드블록은 쓰지 않음
{
  "executiveSummary": "대표 보고용 핵심 요약",
  "managerBriefing": "관리자 상세 브리핑",
  "priorityActions": ["우선 조치 1", "우선 조치 2", "우선 조치 3"],
  "riskFocus": "고위험/관리주의 집중 포인트",
  "messageQueueAdvice": "발송 대기함 처리 조언",
  "dataQualityNotes": "데이터 검수 메모"
}`;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Operation briefing response did not include JSON");
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function parseOllamaOperationBriefing(response: string, weekKey: string, summary: OperationBriefingSummaryInput): OperationBriefingResult {
  const parsed = extractJsonObject(response);
  const fallback = createTemplateOperationBriefing(weekKey, summary);
  return {
    weekKey,
    executiveSummary: cleanText(parsed.executiveSummary, fallback.executiveSummary),
    managerBriefing: cleanText(parsed.managerBriefing, fallback.managerBriefing),
    priorityActions: normalizeActions(parsed.priorityActions, fallback.priorityActions),
    riskFocus: cleanText(parsed.riskFocus, fallback.riskFocus),
    messageQueueAdvice: cleanText(parsed.messageQueueAdvice, fallback.messageQueueAdvice),
    dataQualityNotes: cleanText(parsed.dataQualityNotes, fallback.dataQualityNotes),
    isTemplate: false,
    source: "gemma4",
    createdAt: new Date().toISOString()
  };
}

async function generateWithOllama(weekKey: string, summary: OperationBriefingSummaryInput): Promise<OperationBriefingResult> {
  const controller = new AbortController();
  const timeoutMs = readPositiveInt(process.env.OLLAMA_TIMEOUT_MS, 30000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(weekKey, summary),
      stream: false,
      options: {
        temperature: 0.4,
        num_ctx: readPositiveInt(process.env.OLLAMA_NUM_CTX, 1024),
        num_predict: readPositiveInt(process.env.OLLAMA_NUM_PREDICT, 300)
      }
    }),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama operation briefing request failed with status ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (!data.response) {
    throw new Error("Empty operation briefing response from Ollama");
  }

  return parseOllamaOperationBriefing(data.response, weekKey, summary);
}

export function getDefaultOperationBriefing(weekKey: string, summary: OperationBriefingSummaryInput) {
  return createTemplateOperationBriefing(weekKey, summary);
}

export async function generateOperationBriefing(weekKey: string, summary: OperationBriefingSummaryInput): Promise<OperationBriefingResult> {
  try {
    return await generateWithOllama(weekKey, summary);
  } catch (error) {
    console.warn("[Operation Briefing] Falling back to template.", error instanceof Error ? error.message : error);
    return getDefaultOperationBriefing(weekKey, summary);
  }
}
