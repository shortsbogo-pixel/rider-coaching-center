import type { RiderRiskLevel } from "./rider";

export type AICoachingSource = "gemma4" | "template" | "local-template" | "server-history";
export type AIProviderName = "ollama" | "template" | "openai" | "gemini";
export type AIFallbackReason =
  | "AI_MODE_TEMPLATE"
  | "OLLAMA_UNAVAILABLE"
  | "GEMMA_TIMEOUT"
  | "GEMMA_MEMORY_OR_RUNTIME_ERROR"
  | "API_ERROR"
  | "MANUS_DEPLOYMENT_FALLBACK";

export interface AICoachingHistoryEntry {
  id: string;
  riderId: string;
  riderName: string;
  weekKey?: string;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: RiderRiskLevel;
  adminMessage: string;
  riderMessage: string;
  isTemplate: boolean;
  source?: AICoachingSource;
  fallbackUsed?: boolean;
  fallbackReason?: AIFallbackReason;
  provider?: AIProviderName;
  aiMode?: "auto" | "gemma" | "template";
  templateKey?: string;
  templateVersion?: string;
  generatedAt: string;
}

export interface LocalAICoachingHistoryEntry {
  id: string;
  riderName: string;
  weekKey: string;
  riskLevel: RiderRiskLevel;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
  adminMessage: string;
  riderMessage: string;
  isTemplate: boolean;
  source: AICoachingSource;
  fallbackUsed?: boolean;
  fallbackReason?: AIFallbackReason;
  provider?: AIProviderName;
  aiMode?: "auto" | "gemma" | "template";
  templateKey?: string;
  templateVersion?: string;
  createdAt: string;
}

export interface WeeklyAIBriefingRiderSummary {
  riderName: string;
  riskLevel: string;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
}

export interface WeeklyAIBriefingSummary {
  totalRiders: number;
  highRiskCount: number;
  cautionCount: number;
  stableCount: number;
  declinedCount: number;
  recoveredCount: number;
  averageChangeRate: number;
  topDeclinedRiders: WeeklyAIBriefingRiderSummary[];
  topRecoveredRiders: WeeklyAIBriefingRiderSummary[];
  actionCompletionRate: number;
  coachingGeneratedCount: number;
}

export type WeeklyAIBriefingSource = "gemma4" | "template";

export interface WeeklyAIBriefingResult {
  weekKey: string;
  briefingTitle: string;
  executiveSummary: string;
  riskSummary: string;
  priorityActions: string[];
  recommendedFocus: string;
  messageForManagers: string;
  isTemplate: boolean;
  source: WeeklyAIBriefingSource;
  fallbackUsed?: boolean;
  fallbackReason?: AIFallbackReason;
  templateVersion?: string;
  createdAt: string;
}

export interface LocalWeeklyAIBriefingEntry extends WeeklyAIBriefingResult {
  id: string;
  summary: WeeklyAIBriefingSummary;
}
