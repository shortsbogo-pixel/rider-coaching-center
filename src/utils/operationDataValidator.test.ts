import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationDataCheckItems } from "./operationDataValidator";

test("builds operation data check cards with warning and normal statuses", () => {
  const items = buildOperationDataCheckItems({
    currentRiderCount: 3,
    aiCoachingHistory: [
      { riderName: "김라이더", weekKey: "5월2주차", createdAt: "2026-05-26T00:00:00.000Z" },
      { riderName: "박라이더", weekKey: "5월2주차", createdAt: "2026-05-25T00:00:00.000Z" }
    ],
    managerActions: [
      { riderName: "김라이더", weekKey: "5월2주차", checkedItems: ["available-time"], updatedAt: "2026-05-26T00:00:00.000Z" },
      {
        riderName: "박라이더",
        weekKey: "5월2주차",
        checkedItems: ["available-time", "post-lunch-night", "two-week-flow", "mission-fit", "send-message"],
        updatedAt: "2026-05-26T00:00:00.000Z"
      }
    ],
    weeklyBriefings: [{ id: "week-1" }],
    monthlyReports: [],
    hasLocalStorageData: true
  });

  assert.equal(items.find((item) => item.id === "current-riders")?.value, "3명");
  assert.equal(items.find((item) => item.id === "coached-riders")?.value, "2명");
  assert.equal(items.find((item) => item.id === "completed-actions")?.value, "1명");
  assert.equal(items.find((item) => item.id === "monthly-report")?.tone, "warning");
  assert.equal(items.find((item) => item.id === "latest-ai")?.value, "2026. 5. 26.");
});
