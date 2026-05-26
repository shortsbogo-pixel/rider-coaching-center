import type { RiderRiskLevel } from "./rider";
import type { RiderTrendLabel } from "../utils/riderTrendAnalysis";

export type OperationBriefingSource = "gemma4" | "template";

export interface OperationBriefingRiderSummary {
  riderName: string;
  riskLevel: string;
  currentWeekCompleted: number;
  changeRate: number;
  trendLabel?: RiderTrendLabel | string;
  riskReasons: string[];
  recommendedManagerActions: string[];
}

export interface OperationBriefingSummaryStats {
  totalRiderCount: number;
  highRiskRiderCount: number;
  cautionRiderCount: number;
  stableRiderCount: number;
  decliningRiderCount: number;
  recoveringRiderCount: number;
  newOrReturningRiderCount: number;
  dataWarningCount: number;
  unsentQueueCount: number;
  sentQueueCount: number;
  incompleteChecklistItemCount: number;
  weeklyAICoachingGeneratedCount: number;
}

export interface OperationBriefingMessageQueueStats {
  totalCount: number;
  pendingCount: number;
  sentCount: number;
  heldCount: number;
  highRiskPendingCount: number;
}

export interface OperationBriefingActionChecklistStats {
  targetRiderCount: number;
  incompleteRiderCount: number;
  incompleteItemCount: number;
}

export interface OperationBriefingSummaryInput {
  weekKey: string;
  summaryStats: OperationBriefingSummaryStats;
  riskRiderSummaries: OperationBriefingRiderSummary[];
  messageQueueStats: OperationBriefingMessageQueueStats;
  actionChecklistStats: OperationBriefingActionChecklistStats;
  dataWarnings: string[];
  priorityActionHints: string[];
  monthlyReportSummary?: string;
}

export interface OperationBriefingResult {
  weekKey: string;
  executiveSummary: string;
  managerBriefing: string;
  priorityActions: string[];
  riskFocus: string;
  messageQueueAdvice: string;
  dataQualityNotes: string;
  isTemplate: boolean;
  source: OperationBriefingSource;
  createdAt: string;
}

export interface LocalOperationBriefingEntry extends OperationBriefingResult {
  id: string;
  createdBy: string;
  summary: OperationBriefingSummaryInput;
}

export interface BuildOperationBriefingSummaryInput {
  weekKey: string;
  riders: Array<{
    riderName: string;
    riskLevel: RiderRiskLevel | "주의" | string;
    currentWeekCompleted: number;
    changeRate: number;
    trendLabel?: RiderTrendLabel | string;
    riskReasons?: string[];
    recommendedManagerActions?: string[];
  }>;
  messageQueue: Array<{
    riderName: string;
    weekKey: string;
    riskLevel: RiderRiskLevel | string;
    sendStatus: string;
  }>;
  actionRecords: Array<{
    riderName: string;
    weekKey: string;
    checkedItems: string[];
  }>;
  coachingHistory: Array<{
    weekKey: string;
  }>;
  dataWarnings: Array<{
    message: string;
  }>;
  monthlyReportSummary?: string;
}
