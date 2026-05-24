import type { TimeSegment } from "./order";

export interface UploadedWeekSummary {
  week: string;
  weekKey?: string;
  fileName: string;
  uploadedAt: string;
  orderCount: number;
  completedTotal: number;
  issueCount: number;
  status: string;
}

export interface KeyChangeItem {
  label: string;
  value: string;
  tone: "good" | "warning" | "default";
}

export interface ActionRequiredItem {
  segment: TimeSegment;
  reason: string;
  recommendation: string;
}

export interface LunchMissionBrief {
  tenPlusCount: number;
  fourteenPlusCount: number;
  estimatedBudget: number;
  recommendation: string;
}
