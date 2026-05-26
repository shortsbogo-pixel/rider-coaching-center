import type { RiderRiskLevel } from "./rider";
import type { RiderTrendLabel } from "../utils/riderTrendAnalysis";
import type { AICoachingSource, AIFallbackReason, AIProviderName } from "./aiCoaching";

export type MessageSendStatus = "대기" | "복사완료" | "발송완료" | "보류" | "실패";
export type MessageSendChannel = "카톡" | "문자" | "전화" | "직접상담" | "기타";

export interface MessageQueueItem {
  id: string;
  riderName: string;
  weekKey: string;
  riskLevel: RiderRiskLevel;
  trendLabel?: RiderTrendLabel;
  adminMessage: string;
  riderMessage: string;
  isTemplate?: boolean;
  source?: AICoachingSource;
  fallbackReason?: AIFallbackReason;
  provider?: AIProviderName;
  aiMode?: "auto" | "gemma" | "template";
  templateKey?: string;
  templateVersion?: string;
  kakaoMessage: string;
  smsMessage: string;
  sendStatus: MessageSendStatus;
  sendChannel: MessageSendChannel;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  sentBy?: string;
  memo?: string;
}

export interface MessageSendHistoryEntry {
  id: string;
  queueId: string;
  riderName: string;
  weekKey: string;
  riskLevel: RiderRiskLevel;
  sendChannel: MessageSendChannel;
  sentMessage: string;
  sentAt: string;
  sentBy: string;
  memo?: string;
}

export interface CreateMessageQueueItemInput {
  riderName: string;
  weekKey: string;
  riskLevel: RiderRiskLevel;
  trendLabel?: RiderTrendLabel;
  adminMessage: string;
  riderMessage: string;
  isTemplate?: boolean;
  source?: AICoachingSource;
  fallbackReason?: AIFallbackReason;
  provider?: AIProviderName;
  aiMode?: "auto" | "gemma" | "template";
  templateKey?: string;
  templateVersion?: string;
  currentWeekCompleted: number;
  changeRate: number;
  createdAt?: string;
}
