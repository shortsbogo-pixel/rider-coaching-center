import type { DeliveryType, TimeSegment } from "./order";

export type RiderRiskLevel = "고위험" | "관리주의" | "허용" | "안정" | "에이스";
export type RiderProfileSource = "uploaded" | "sample" | "merged";
export type RiderValidationStatus = "AUTO_ANALYSIS_TARGET" | "MATCHED_EXISTING" | "NAME_REVIEW_RECOMMENDED";
export type RiderGrade = "S" | "A" | "B" | "C" | "MANAGEMENT_TARGET";

export interface ScoreBreakdown {
  completedScore: number;
  multiDeliveryScore: number;
  postLunchScore: number;
  postDinnerScore: number;
  consistencyScore: number;
  rejectionScore: number;
}

export interface RiderProfile {
  id: string;
  name: string;
  displayName?: string;
  baseName: string;
  aliases: string[];
  phoneSuffix?: string;
  source?: RiderProfileSource;
  totalCompleted?: number;
  firstActiveWeek?: string;
  lastActiveWeek?: string;
  activeWeeks?: string[];
  validationStatus?: RiderValidationStatus;
}

export interface GradeProgress {
  currentGrade: RiderGrade;
  currentLabel: string;
  nextGrade?: RiderGrade;
  nextLabel?: string;
  nextTarget?: number;
  remainingToNext: number;
}

export interface RiderMetrics {
  riderId: string;
  riderName: string;
  displayName: string;
  baseName: string;
  profileSource: RiderProfileSource;
  validationStatus: RiderValidationStatus;
  totalCompleted: number;
  weeklyCompleted: Record<string, number>;
  weekdayCompleted: Record<string, number>;
  segmentCompleted: Record<TimeSegment, number>;
  deliveryTypeCompleted: Record<DeliveryType, number>;
  multiDeliveryRate: number;
  postLunchRate: number;
  postDinnerRate: number;
  consistencyRate: number;
  rejectionIgnoredRate: number;
  weakSegments: TimeSegment[];
  strongSegment: TimeSegment;
  weakestSegment: TimeSegment;
  dispatchScore: number;
  coachingScore: number;
  scoreBreakdown: ScoreBreakdown;
  missingMetrics: string[];
  riskLevel: RiderRiskLevel;
  riderGrade: RiderGrade;
  gradeProgress: GradeProgress;
}
