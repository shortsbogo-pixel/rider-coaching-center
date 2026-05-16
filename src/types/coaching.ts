import type { RiderRiskLevel } from "./rider";

export interface CoachingMessage {
  riderId: string;
  riderName: string;
  basisWeek?: string;
  isFallbackWeek?: boolean;
  riskLevel: RiderRiskLevel;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendedActions: string[];
  profitTips: string[];
  weeklyMission: string;
  adminMemo?: string;
}

export interface CustomCoachingMessage {
  id?: string;
  riderId: string;
  riderName: string;
  weekKey: string;
  autoMessage: string;
  customMessage: string;
  isCustom: boolean;
  updatedAt: string;
  updatedBy?: string;
}
