import { createTemplateOperationBriefing } from "../../../../src/utils/operationBriefingSummary";
import { createTemplateCoachingMessages } from "../aiTemplateService";
import type { AICoachingProviderInput, AICoachingProviderOutput, AIProvider, AIProviderRuntimeConfig, AIProviderStatusResult } from "./types";

export function createTemplateProvider(config: AIProviderRuntimeConfig): AIProvider {
  return {
    name: "template",

    async generateCoachingMessage(input: AICoachingProviderInput): Promise<AICoachingProviderOutput> {
      const result = createTemplateCoachingMessages({
        riderName: input.riderName,
        riskLevel: input.riskLevel,
        previousWeekCompleted: input.previousWeekCompleted,
        currentWeekCompleted: input.currentWeekCompleted,
        changeRate: input.changeRate,
        analysisContext: input.analysisContext
      });

      return {
        ...result,
        provider: "template",
        aiMode: config.mode,
        fallbackUsed: false
      };
    },

    async generateOperationBriefing(weekKey, summary) {
      return {
        ...createTemplateOperationBriefing(weekKey, summary),
        provider: "template",
        aiMode: config.mode,
        fallbackUsed: false,
        fallbackReason: undefined,
        templateVersion: "v1"
      };
    },

    async checkStatus(): Promise<AIProviderStatusResult> {
      return {
        ollamaConnected: false,
        model: config.env?.OLLAMA_MODEL || process.env.OLLAMA_MODEL || "template",
        gemmaResponding: false,
        checkedAt: new Date().toISOString(),
        fallbackUsed: false,
        provider: "template",
        aiProvider: "template",
        aiMode: config.mode,
        fallbackEnabled: config.fallbackEnabled,
        message: "기본 템플릿 운영 모드입니다. 외부 AI 연결 없이 안정 운영 가능합니다."
      };
    }
  };
}
