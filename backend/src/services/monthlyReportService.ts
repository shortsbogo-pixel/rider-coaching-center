import type { MonthlyOperationReport, MonthlyOperationReportSummary } from "../../../src/utils/monthlyOperationReport";

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
    "고위험 라이더의 활동 가능 시간과 회복 구간을 우선 확인",
    "관리 액션 체크리스트 미완료 대상자를 주간 단위로 재점검",
    "하락폭이 큰 라이더 TOP 5를 중심으로 개별 코칭 문구 발송"
  ];
  if (!Array.isArray(value)) return fallback;
  const actions = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 3);
  return actions.length ? [...actions, ...fallback].slice(0, 3) : fallback;
}

export function getDefaultMonthlyOperationReport(summary: MonthlyOperationReportSummary): MonthlyOperationReport {
  return {
    ...summary,
    operationSummary: `${summary.monthKey} 기준 월간 AI 코칭 ${summary.coachingGeneratedCount}건이 생성되었습니다. 고위험 ${summary.highRiskCoachingCount}건, 관리주의/주의 ${summary.cautionCoachingCount}건을 중심으로 다음 달 초반 관리 우선순위를 잡는 것이 좋습니다.`,
    nextMonthActions: [
      "고위험 라이더의 활동 가능 시간과 회복 구간을 우선 확인",
      "관리 액션 체크리스트 미완료 대상자를 주간 단위로 재점검",
      "하락폭이 큰 라이더 TOP 5를 중심으로 개별 코칭 문구 발송"
    ],
    isTemplate: true,
    source: "template",
    createdAt: new Date().toISOString()
  };
}

function buildPrompt(summary: MonthlyOperationReportSummary) {
  return `당신은 라이더 코칭센터의 관리자용 월간 운영 리포트 작성자입니다.

아래 JSON은 시스템 코드가 이미 계산한 월간 운영 요약 데이터입니다. 숫자는 절대 새로 계산하거나 추정하지 말고, 이 JSON에 있는 숫자만 사용하세요.

summary:
${JSON.stringify(summary, null, 2)}

작성 조건:
- 한국어로 작성
- 회사 대표/관리자가 바로 이해할 수 있게 작성
- 너무 장황하지 않게 작성
- 라이더를 비난하는 표현 금지
- 다음 달 관리 제안 3개 포함
- 없는 숫자를 추정하거나 새로 만들지 말 것

반드시 아래 JSON 형식만 반환하세요. 마크다운 코드블록은 쓰지 마세요.
{
  "operationSummary": "이번 달 운영 요약",
  "nextMonthActions": ["다음 달 관리 제안 1", "다음 달 관리 제안 2", "다음 달 관리 제안 3"]
}`;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Monthly report response did not include JSON");
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function parseOllamaMonthlyReport(response: string, summary: MonthlyOperationReportSummary): MonthlyOperationReport {
  const parsed = extractJsonObject(response);
  const fallback = getDefaultMonthlyOperationReport(summary);

  return {
    ...summary,
    operationSummary: cleanText(parsed.operationSummary, fallback.operationSummary),
    nextMonthActions: normalizeActions(parsed.nextMonthActions),
    isTemplate: false,
    source: "gemma4",
    createdAt: new Date().toISOString()
  };
}

async function generateWithOllama(summary: MonthlyOperationReportSummary): Promise<MonthlyOperationReport> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 5000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(summary),
      stream: false,
      temperature: 0.4,
      num_predict: 500
    }),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama monthly report request failed with status ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (!data.response) {
    throw new Error("Empty monthly report response from Ollama");
  }

  return parseOllamaMonthlyReport(data.response, summary);
}

export async function generateMonthlyOperationReport(summary: MonthlyOperationReportSummary): Promise<MonthlyOperationReport> {
  try {
    return await generateWithOllama(summary);
  } catch (error) {
    console.warn("[Monthly Operation Report] Falling back to template.", error instanceof Error ? error.message : error);
    return getDefaultMonthlyOperationReport(summary);
  }
}
