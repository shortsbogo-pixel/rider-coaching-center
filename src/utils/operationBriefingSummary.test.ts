import assert from "node:assert/strict";
import test from "node:test";
import type { LocalAICoachingHistoryEntry } from "../types/aiCoaching";
import type { MessageQueueItem } from "../types/messageQueue";
import type { RiderRiskLevel } from "../types/rider";
import type { DataQualityWarning, RiderTrendAnalysis } from "./riderTrendAnalysis";
import { managerActionChecklistItems, type ManagerActionChecklistRecord } from "./managerActionChecklist";
import {
  buildOperationBriefingSummary,
  createTemplateOperationBriefing,
  formatExecutiveOperationBriefingText,
  formatManagerOperationBriefingText
} from "./operationBriefingSummary";

function riderInput(
  riderName: string,
  riskLevel: RiderRiskLevel,
  trendLabel: RiderTrendAnalysis["trendLabel"],
  changeRate: number
) {
  return {
    riderName,
    riskLevel,
    currentWeekCompleted: 80,
    changeRate,
    trendLabel,
    riskReasons: [`${riderName} risk reason`],
    recommendedManagerActions: [`${riderName} action`]
  };
}

function queueInput(riderName: string, sendStatus: MessageQueueItem["sendStatus"]): MessageQueueItem {
  return {
    id: `queue-${riderName}-${sendStatus}`,
    riderName,
    weekKey: "5월2주차",
    riskLevel: "고위험",
    trendLabel: "하락세",
    adminMessage: "admin",
    riderMessage: "rider",
    kakaoMessage: "kakao",
    smsMessage: "sms",
    sendStatus,
    sendChannel: "카톡",
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z"
  };
}

test("operation briefing summary calculates stats from prepared admin data", () => {
  const actionRecords: ManagerActionChecklistRecord[] = [
    {
      riderName: "김위험",
      weekKey: "5월2주차",
      checkedItems: [managerActionChecklistItems[0].id],
      updatedAt: "2026-05-20T00:00:00.000Z"
    },
    {
      riderName: "박안정",
      weekKey: "5월2주차",
      checkedItems: managerActionChecklistItems.map((item) => item.id),
      updatedAt: "2026-05-20T00:00:00.000Z"
    }
  ];
  const coachingHistory: LocalAICoachingHistoryEntry[] = [
    {
      id: "coaching-1",
      riderName: "김위험",
      weekKey: "5월2주차",
      riskLevel: "고위험",
      previousWeekCompleted: 100,
      currentWeekCompleted: 60,
      changeRate: -40,
      adminMessage: "admin",
      riderMessage: "rider",
      isTemplate: false,
      source: "gemma4",
      createdAt: "2026-05-20T00:00:00.000Z"
    }
  ];
  const warnings: DataQualityWarning[] = [
    { id: "warning-1", scope: "rider", severity: "warning", riderName: "김위험", message: "전주 데이터 없음" }
  ];

  const summary = buildOperationBriefingSummary({
    weekKey: "5월2주차",
    riders: [
      riderInput("김위험", "고위험", "하락세", -40),
      riderInput("이주의", "관리주의", "급락", -35),
      riderInput("박안정", "안정", "안정", 1),
      riderInput("최회복", "허용", "회복세", 18),
      riderInput("신규", "허용", "신규", 0)
    ],
    messageQueue: [queueInput("김위험", "대기"), queueInput("박안정", "발송완료")],
    actionRecords,
    coachingHistory,
    dataWarnings: warnings
  });

  assert.equal(summary.summaryStats.totalRiderCount, 5);
  assert.equal(summary.summaryStats.highRiskRiderCount, 1);
  assert.equal(summary.summaryStats.cautionRiderCount, 1);
  assert.equal(summary.summaryStats.stableRiderCount, 3);
  assert.equal(summary.summaryStats.decliningRiderCount, 2);
  assert.equal(summary.summaryStats.recoveringRiderCount, 1);
  assert.equal(summary.summaryStats.newOrReturningRiderCount, 1);
  assert.equal(summary.summaryStats.dataWarningCount, 1);
  assert.equal(summary.messageQueueStats.pendingCount, 1);
  assert.equal(summary.messageQueueStats.sentCount, 1);
  assert.equal(summary.actionChecklistStats.incompleteItemCount, managerActionChecklistItems.length * 2 - 1);
  assert.equal(summary.summaryStats.weeklyAICoachingGeneratedCount, 1);
  assert.equal(summary.priorityActionHints.length, 3);
});

test("template operation briefing and copy text use calculated numbers only", () => {
  const summary = buildOperationBriefingSummary({
    weekKey: "5월2주차",
    riders: [riderInput("김위험", "고위험", "하락세", -40)],
    messageQueue: [queueInput("김위험", "대기")],
    actionRecords: [],
    coachingHistory: [],
    dataWarnings: []
  });
  const briefing = createTemplateOperationBriefing("5월2주차", summary);

  assert.equal(briefing.priorityActions.length, 3);
  assert.equal(briefing.isTemplate, true);
  assert.match(briefing.executiveSummary, /고위험 1명/);
  assert.match(formatExecutiveOperationBriefingText(briefing, summary), /라이더 코칭센터 주간 운영 요약/);
  assert.match(formatManagerOperationBriefingText(briefing, summary), /5월2주차 AI 운영본부 브리핑/);
});
