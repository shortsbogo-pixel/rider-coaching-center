import type { OperationBriefingResult } from "../../../../src/types/operationBriefing";
import { classifyAIFallbackReason, getAIModeConfig } from "../aiTemplateService";
import { createOllamaProvider } from "./ollamaProvider";
import { createTemplateProvider } from "./templateProvider";
import type {
  AICoachingProviderInput,
  AICoachingProviderOutput,
  AIProvider,
  AIProviderName,
  AIProviderRuntimeConfig,
  AIProviderStatusResult
} from "./types";

const providerValues: AIProviderName[] = ["ollama", "template", "openai", "gemini"];

function normalizeProvider(value: string | undefined): AIProviderName {
  return providerValues.includes(value as AIProviderName) ? (value as AIProviderName) : "ollama";
}

export function getAIProviderConfig(env: Record<string, string | undefined> = process.env): AIProviderRuntimeConfig {
  const modeConfig = getAIModeConfig(env);
  return {
    provider: normalizeProvider(env.AI_PROVIDER),
    mode: modeConfig.mode,
    fallbackEnabled: modeConfig.fallbackEnabled,
    env
  };
}

function withProviderMetadata<T extends { provider?: AIProviderName; aiMode?: string }>(value: T, config: AIProviderRuntimeConfig) {
  return {
    ...value,
    provider: value.provider ?? config.provider,
    aiMode: value.aiMode ?? config.mode
  };
}

function fallbackCoaching(
  input: AICoachingProviderInput,
  config: AIProviderRuntimeConfig,
  error: unknown
): Promise<AICoachingProviderOutput> {
  const templateProvider = createTemplateProvider({ ...config, provider: "template" });
  return templateProvider.generateCoachingMessage(input).then((result) => ({
    ...result,
    provider: config.provider,
    aiMode: config.mode,
    fallbackUsed: true,
    fallbackReason: classifyAIFallbackReason(error)
  }));
}

function fallbackOperationBriefing(
  weekKey: string,
  summary: Parameters<AIProvider["generateOperationBriefing"]>[1],
  config: AIProviderRuntimeConfig,
  error: unknown
): Promise<OperationBriefingResult> {
  const templateProvider = createTemplateProvider({ ...config, provider: "template" });
  return templateProvider.generateOperationBriefing(weekKey, summary).then((result) => ({
    ...result,
    provider: config.provider,
    aiMode: config.mode,
    fallbackUsed: true,
    fallbackReason: classifyAIFallbackReason(error),
    templateVersion: result.templateVersion ?? "v1"
  }));
}

function createStubProvider(config: AIProviderRuntimeConfig, keyName: "OPENAI_API_KEY" | "GEMINI_API_KEY"): AIProvider {
  const label = config.provider === "openai" ? "OpenAI" : "Gemini";
  return {
    name: config.provider,

    async generateCoachingMessage(input) {
      if (!config.env?.[keyName] && !process.env[keyName]) {
        return fallbackCoaching(input, config, new Error(`${label} API key is not configured.`));
      }
      return fallbackCoaching(input, config, new Error(`${label} provider is a safe stub in this phase.`));
    },

    async generateOperationBriefing(weekKey, summary) {
      if (!config.env?.[keyName] && !process.env[keyName]) {
        return fallbackOperationBriefing(weekKey, summary, config, new Error(`${label} API key is not configured.`));
      }
      return fallbackOperationBriefing(weekKey, summary, config, new Error(`${label} provider is a safe stub in this phase.`));
    },

    async checkStatus(): Promise<AIProviderStatusResult> {
      const hasKey = Boolean(config.env?.[keyName] || process.env[keyName]);
      return {
        ollamaConnected: false,
        model: config.provider,
        gemmaResponding: false,
        checkedAt: new Date().toISOString(),
        fallbackUsed: true,
        fallbackReason: "API_ERROR",
        provider: config.provider,
        aiProvider: config.provider,
        aiMode: config.mode,
        fallbackEnabled: config.fallbackEnabled,
        message: hasKey
          ? `${label} provider is configured as a stub and will use template fallback in this phase.`
          : `${label} API key is not configured. Template fallback is available.`
      };
    }
  };
}

function wrapWithFallback(provider: AIProvider, config: AIProviderRuntimeConfig): AIProvider {
  if (provider.name === "template") return provider;
  return {
    ...provider,

    async generateCoachingMessage(input) {
      try {
        return withProviderMetadata(await provider.generateCoachingMessage(input), config);
      } catch (error) {
        if (!config.fallbackEnabled) throw error;
        return fallbackCoaching(input, config, error);
      }
    },

    async generateOperationBriefing(weekKey, summary) {
      try {
        return withProviderMetadata(await provider.generateOperationBriefing(weekKey, summary), config);
      } catch (error) {
        if (!config.fallbackEnabled) throw error;
        return fallbackOperationBriefing(weekKey, summary, config, error);
      }
    }
  };
}

export function createAIProvider(config: AIProviderRuntimeConfig = getAIProviderConfig()): AIProvider {
  if (config.mode === "template" || config.provider === "template") {
    return createTemplateProvider({ ...config, provider: "template" });
  }
  if (config.provider === "openai") return wrapWithFallback(createStubProvider(config, "OPENAI_API_KEY"), config);
  if (config.provider === "gemini") return wrapWithFallback(createStubProvider(config, "GEMINI_API_KEY"), config);
  return wrapWithFallback(createOllamaProvider(config), config);
}
