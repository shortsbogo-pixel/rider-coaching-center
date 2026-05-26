import assert from "node:assert/strict";
import test from "node:test";
import {
  checklistCompletion,
  readManagerActionChecklist,
  saveManagerActionChecklist
} from "./managerActionChecklist";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class FailingStorage extends MemoryStorage {
  override setItem() {
    throw new Error("storage full");
  }
}

test("manager checklist saves by rider and week", () => {
  const storage = new MemoryStorage();

  assert.equal(saveManagerActionChecklist("김라이더", "5월3주차", ["available-time", "send-message"], storage), true);

  const saved = readManagerActionChecklist("김라이더", "5월3주차", storage);
  assert.equal(saved.riderName, "김라이더");
  assert.equal(saved.weekKey, "5월3주차");
  assert.deepEqual(saved.checkedItems, ["available-time", "send-message"]);
  assert.match(saved.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("manager checklist completion status is derived from checked count", () => {
  assert.deepEqual(checklistCompletion([], 5), { checkedCount: 0, totalCount: 5, status: "not-started" });
  assert.deepEqual(checklistCompletion(["available-time", "send-message"], 5), { checkedCount: 2, totalCount: 5, status: "in-progress" });
  assert.deepEqual(
    checklistCompletion(["available-time", "post-lunch-night", "two-week-flow", "mission-fit", "send-message"], 5),
    { checkedCount: 5, totalCount: 5, status: "completed" }
  );
});

test("manager checklist storage failures do not throw", () => {
  const storage = new FailingStorage();

  assert.doesNotThrow(() => saveManagerActionChecklist("김라이더", "5월3주차", ["available-time"], storage));
  assert.equal(saveManagerActionChecklist("김라이더", "5월3주차", ["available-time"], storage), false);
});
