import type { AIFallbackReason, AIProviderName } from "../../../../src/types/aiCoaching";
import type { OperationBriefingResult, OperationBriefingSummaryInput } from "../../../../src/types/operationBriefing";
import type { RiderRiskLevel } from "../../../../src/types/rider";
import type { AICoachingAnalysisContext } from "../../../../src/utils/riderTrendAnalysis";
import type { AIMode } from "../aiTemplateService";

export type { AIProviderName };

export interface AIProviderRuntimeConfig {
  provider: AIProviderName;
  mode: AIMode;
  fallbackEnabled: boolean;
  env?: Record<string, string | undefined>;
}

export interface AICoachingProviderInput {
  riderName: string;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: RiderRiskLevel;
  analysisContext?: AICoachingAnalysisContext;
}

export interface AICoachingProviderOutput {
  adminMessage: string;
  riderMessage: string;
  kakaoMessage?: string;
  smsMessage?: string;
  isTemplate: boolean;
  source: "gemma4" | "template" | "local-template";
  fallbackUsed: boolean;
  fallbackReason?: AIFallbackReason;
  provider: AIProviderName;
  aiMode: AIMode;
  templateKey?: string;
  templateVersion?: string;
}

export interface AIProviderStatusResult {
  ollamaConnected: boolean;
  model: string;
  gemmaResponding: boolean;
  checkedAt: string;
  fallbackUsed: boolean;
  fallbackReason?: AIFallbackReason;
  provider: AIProviderName;
  aiProvider: AIProviderName;
  aiMode: AIMode;
  fallbackEnabled: boolean;
  message: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  generateCoachingMessage(input: AICoachingProviderInput): Promise<AICoachingProviderOutput>;
  generateOperationBriefing(weekKey: string, summary: OperationBriefingSummaryInput): Promise<OperationBriefingResult>;
  checkStatus(): Promise<AIProviderStatusResult>;
}
