import type { RiderRiskLevel } from "./rider";

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
  generatedAt: string;
}
