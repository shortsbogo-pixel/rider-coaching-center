import type { DeliveryType, TimeSegment } from "./order";

export interface AnalysisCache {
  id: string;
  weekKey: string;
  generatedAt: string;
  totalRiders: number;
  totalCompleted: number;
  averageCompleted: number;
  segmentSummary: Record<TimeSegment, number>;
  multiDeliverySummary: Record<DeliveryType, number>;
  riderRankings: Array<{
    riderId: string;
    riderName: string;
    totalCompleted: number;
    coachingScore: number;
  }>;
  weakSegments: TimeSegment[];
  topRiders: string[];
  riskRiders: string[];
}
