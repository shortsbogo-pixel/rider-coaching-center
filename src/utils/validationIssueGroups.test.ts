import assert from "node:assert/strict";
import test from "node:test";
import { groupValidationIssues } from "./validationIssueGroups";

test("groups validation issues by type and message with row details", () => {
  const groups = groupValidationIssues([
    { week: "5월2주차", rowNumber: 10, type: "invalid_delivery_type", message: "배달타입 확인필요: 원본값 \"퀵\"", rawValue: "퀵" },
    { week: "5월2주차", rowNumber: 12, type: "invalid_delivery_type", message: "배달타입 확인필요: 원본값 \"\"", rawValue: "" },
    { week: "5월2주차", rowNumber: 14, type: "invalid_completed_count", message: "완료건수 숫자 변환 확인필요", rawValue: "bad" }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.type, "invalid_delivery_type");
  assert.equal(groups[0]?.count, 2);
  assert.equal(groups[0]?.rows.map((row) => row.rowNumber).join(","), "10,12");
  assert.equal(groups[0]?.label, "배달타입 확인필요");
  assert.equal(groups[1]?.type, "invalid_completed_count");
  assert.equal(groups[1]?.count, 1);
});
