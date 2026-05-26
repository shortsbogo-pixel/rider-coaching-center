import { createTemplateOperationBriefing } from "../../../../src/utils/operationBriefingSummary";
import type { OperationBriefingResult, OperationBriefingSummaryInput } from "../../../../src/types/operationBriefing";
import type { AICoachingProviderInput, AICoachingProviderOutput, AIProvider, AIProviderRuntimeConfig, AIProviderStatusResult } from "./types";

interface OllamaGenerateResponse {
  response?: string;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function envValue(config: AIProviderRuntimeConfig, key: string, fallback: string) {
  return config.env?.[key] || process.env[key] || fallback;
}

function buildGenerateRequestBody(config: AIProviderRuntimeConfig, prompt: string, temperature = 0.7) {
  return {
    model: envValue(config, "OLLAMA_MODEL", "gemma4:e2b"),
    prompt,
    stream: false,
    options: {
      temperature,
      num_ctx: readPositiveInt(config.env?.OLLAMA_NUM_CTX ?? process.env.OLLAMA_NUM_CTX, 1024),
      num_predict: readPositiveInt(config.env?.OLLAMA_NUM_PREDICT ?? process.env.OLLAMA_NUM_PREDICT, 300)
    }
  };
}

function coachingPrompt(input: AICoachingProviderInput) {
  const analysis = input.analysisContext
    ? `
Calculated analysis:
- trendLabel: ${input.analysisContext.trendLabel}
- riskReasons: ${input.analysisContext.riskReasons.join(" / ") || "none"}
- dataWarnings: ${input.analysisContext.dataWarnings.join(" / ") || "none"}
- fourWeekTrendSummary: ${input.analysisContext.fourWeekTrendSummary}
- recommendedManagerActions: ${input.analysisContext.recommendedManagerActions.join(" / ") || "none"}`
    : "";

  return `Generate two Korean coaching messages for a rider.
Use only the provided numbers. Do not calculate, infer, estimate, or create new numbers.

Rider:
- name: ${input.riderName}
- previousWeekCompleted: ${input.previousWeekCompleted}
- currentWeekCompleted: ${input.currentWeekCompleted}
- changeRate: ${input.changeRate}
- riskLevel: ${input.riskLevel}
${analysis}

Return exactly:
[admin message]---|---[rider message]`;
}

function operationBriefingPrompt(weekKey: string, summary: OperationBriefingSummaryInput) {
  return `Create a Korean operation briefing for CORE PARTNERS.
All numbers are already calculated by application code. Do not calculate or invent numbers.

weekKey: ${weekKey}
summary:
${JSON.stringify(summary, null, 2)}

Return JSON only:
{
  "executiveSummary": "short executive summary",
  "managerBriefing": "manager briefing",
  "priorityActions": ["action 1", "action 2", "action 3"],
  "riskFocus": "risk focus",
  "messageQueueAdvice": "message queue advice",
  "dataQualityNotes": "data quality notes"
}`;
}

function parseCoachingResponse(response: string): Pick<AICoachingProviderOutput, "adminMessage" | "riderMessage"> {
  const parts = response.split("---|---");
  if (parts.length < 2) throw new Error("Invalid response format from Ollama");
  const adminMessage = parts[0].trim();
  const riderMessage = parts[1].trim();
  if (!adminMessage || !riderMessage || adminMessage.length < 10 || riderMessage.length < 20) {
    throw new Error("Ollama response content too short");
  }
  return { adminMessage, riderMessage };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Ollama response did not include JSON");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeActions(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const actions = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3);
  return actions.length ? [...actions, ...fallback].slice(0, 3) : fallback;
}

async function requestOllama(config: AIProviderRuntimeConfig, prompt: string, temperature = 0.7) {
  const baseUrl = envValue(config, "OLLAMA_BASE_URL", "http://localhost:11434").replace(/\/+$/, "");
  const controller = new AbortController();
  const timeoutMs = readPositiveInt(config.env?.OLLAMA_TIMEOUT_MS ?? process.env.OLLAMA_TIMEOUT_MS, 30000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGenerateRequestBody(config, prompt, temperature)),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) throw new Error(`Ollama request failed with status ${response.status}`);
  const data = (await response.json()) as OllamaGenerateResponse;
  if (!data.response) throw new Error("Empty response from Ollama");
  return data.response;
}

export function createOllamaProvider(config: AIProviderRuntimeConfig): AIProvider {
  return {
    name: "ollama",

    async generateCoachingMessage(input) {
      const parsed = parseCoachingResponse(await requestOllama(config, coachingPrompt(input), 0.7));
      return {
        ...parsed,
        isTemplate: false,
        source: "gemma4",
        provider: "ollama",
        aiMode: config.mode,
        fallbackUsed: false
      };
    },

    async generateOperationBriefing(weekKey: string, summary: OperationBriefingSummaryInput): Promise<OperationBriefingResult> {
      const parsed = extractJsonObject(await requestOllama(config, operationBriefingPrompt(weekKey, summary), 0.4));
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
        provider: "ollama",
        aiMode: config.mode,
        fallbackUsed: false,
        createdAt: new Date().toISOString()
      };
    },

    async checkStatus(): Promise<AIProviderStatusResult> {
      const checkedAt = new Date().toISOString();
      try {
        const responseText = await requestOllama(config, "Reply with OK only.", 0);
        const responding = responseText.trim().length > 0;
        return {
          ollamaConnected: true,
          model: envValue(config, "OLLAMA_MODEL", "gemma4:e2b"),
          gemmaResponding: responding,
          checkedAt,
          fallbackUsed: !responding,
          fallbackReason: responding ? undefined : "API_ERROR",
          provider: "ollama",
          aiProvider: "ollama",
          aiMode: config.mode,
          fallbackEnabled: config.fallbackEnabled,
          message: responding ? "Gemma 4 connected through Ollama." : "Ollama responded without model text."
        };
      } catch (error) {
        return {
          ollamaConnected: false,
          model: envValue(config, "OLLAMA_MODEL", "gemma4:e2b"),
          gemmaResponding: false,
          checkedAt,
          fallbackUsed: true,
          fallbackReason: "OLLAMA_UNAVAILABLE",
          provider: "ollama",
          aiProvider: "ollama",
          aiMode: config.mode,
          fallbackEnabled: config.fallbackEnabled,
          message: error instanceof Error ? error.message : "Ollama status check failed."
        };
      }
    }
  };
}
