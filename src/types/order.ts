export type TimeSegment =
  | "Breakfast"
  | "Lunch_Peak"
  | "Post_Lunch"
  | "Dinner_Peak"
  | "Post_Dinner";

export type DeliveryType =
  | "단건배달"
  | "멀티배달1"
  | "멀티배달2"
  | "멀티배달3"
  | "멀티배달4";

export interface OrderRecord {
  id: string;
  week: string;
  riderName: string;
  baseName: string;
  pickupArea: string;
  deliveryArea: string;
  acceptedAt: string;
  deliveredAt: string;
  deliveryMinutes: number;
  timeSegment: TimeSegment;
  deliveryType: DeliveryType;
  completedCount: number;
  weekday: "월" | "화" | "수" | "목" | "금" | "토" | "일";
  rejectionRate?: number;
  ignoredRate?: number;
}
