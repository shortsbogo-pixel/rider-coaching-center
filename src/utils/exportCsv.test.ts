import assert from "node:assert/strict";
import test from "node:test";
import { createAICoachingHistoryCsv, createManagerActionsCsv } from "./exportCsv";

test("exports AI coaching history as UTF-8 BOM CSV", () => {
  const csv = createAICoachingHistoryCsv([
    {
      id: "1",
      riderName: "김라이더",
      weekKey: "5월2주차",
      riskLevel: "고위험",
      previousWeekCompleted: 100,
      currentWeekCompleted: 70,
      changeRate: -30,
      adminMessage: "관리 필요",
      riderMessage: "안내, 문구",
      isTemplate: false,
      source: "gemma4",
      createdAt: "2026-05-26T00:00:00.000Z"
    }
  ]);

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /riderName,weekKey,riskLevel/);
  assert.match(csv, /김라이더/);
  assert.match(csv, /"안내, 문구"/);
});

test("exports manager action checklist records as CSV", () => {
  const csv = createManagerActionsCsv([
    {
      riderName: "김라이더",
      weekKey: "5월2주차",
      checkedItems: ["available-time", "send-message"],
      updatedAt: "2026-05-26T00:00:00.000Z"
    }
  ]);

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /riderName,weekKey,checkedItems,checkedCount,status,updatedAt/);
  assert.match(csv, /in-progress/);
});
