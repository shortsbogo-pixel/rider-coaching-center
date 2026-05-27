import assert from "node:assert/strict";
import test from "node:test";
import {
  filterHistoryForVisibleRiders,
  getBatchBlockReason,
  getBatchFailure,
  isSuccessfulBatchResult
} from "./adminBatchCoaching";

test("blocks batch generation when parsed storage has JSON errors", () => {
  assert.equal(
    getBatchBlockReason({ selectedWeekKey: "5월3주차", itemCount: 12, parsedErrorCount: 2 }),
    "JSON 파싱 오류 2건이 있어 전체 AI 코칭 생성에서 제외했습니다. parsed 초기화 후 엑셀을 다시 업로드하세요."
  );
});

test("does not treat JSON parse error batch results as successful coaching output", () => {
  const result = {
    riderId: "uploaded-old",
    adminMessage: "error",
    riderMessage: "error",
    isTemplate: true,
    error: "Unexpected non-whitespace character after JSON at position 731"
  };

  assert.equal(isSuccessfulBatchResult(result), false);
  assert.deepEqual(getBatchFailure(result, { riderId: "uploaded-old", riderName: "박종관" }), {
    riderId: "uploaded-old",
    riderName: "박종관",
    error: "재업로드 필요: JSON 파싱 오류가 남아 있습니다."
  });
});

test("filters local AI coaching history to currently visible riders and week", () => {
  const history = [
    { id: "1", riderName: "김라이더", weekKey: "5월3주차", adminMessage: "a", riderMessage: "b", createdAt: "2026-05-01T00:00:00.000Z" },
    { id: "2", riderName: "uploaded-박종관", weekKey: "5월3주차", adminMessage: "a", riderMessage: "b", createdAt: "2026-05-01T00:00:00.000Z" },
    { id: "3", riderName: "김라이더", weekKey: "5월2주차", adminMessage: "a", riderMessage: "b", createdAt: "2026-05-01T00:00:00.000Z" }
  ];

  assert.deepEqual(filterHistoryForVisibleRiders(history, "5월3주차", ["김라이더"]).map((entry) => entry.id), ["1"]);
});
