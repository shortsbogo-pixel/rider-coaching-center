import assert from "node:assert/strict";
import test from "node:test";
import {
  createMessageQueueItem,
  createSendHistoryEntry,
  hasDuplicateMessageQueueItem,
  readMessageQueueItems,
  saveMessageQueueItem,
  updateMessageQueueItem
} from "./messageQueueStorage";
import type { MessageQueueItem } from "../types/messageQueue";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class FailingStorage extends MemoryStorage {
  override setItem() {
    throw new Error("storage full");
  }
}

function createQueueItem(overrides: Partial<MessageQueueItem> = {}) {
  return createMessageQueueItem({
    riderName: overrides.riderName ?? "Test Rider",
    weekKey: overrides.weekKey ?? "2026-W21",
    riskLevel: overrides.riskLevel ?? "고위험",
    trendLabel: overrides.trendLabel ?? "하락세",
    adminMessage: overrides.adminMessage ?? "Admin message",
    riderMessage: overrides.riderMessage ?? "Rider message",
    currentWeekCompleted: 80,
    changeRate: -20,
    createdAt: overrides.createdAt ?? "2026-05-26T00:00:00.000Z"
  });
}

test("message queue item is created with pending status and copy templates", () => {
  const item = createQueueItem();

  assert.equal(item.sendStatus, "대기");
  assert.equal(item.sendChannel, "카톡");
  assert.match(item.kakaoMessage, /Test Rider/);
  assert.match(item.smsMessage, /Test Rider/);
});

test("message queue storage prevents duplicate rider-week-message entries", () => {
  const storage = new MemoryStorage();
  const item = createQueueItem();

  assert.equal(saveMessageQueueItem(item, storage), true);
  assert.equal(hasDuplicateMessageQueueItem(readMessageQueueItems(storage), item), true);
});

test("message queue item can be updated without creating duplicates", () => {
  const storage = new MemoryStorage();
  const item = createQueueItem();

  saveMessageQueueItem(item, storage);
  updateMessageQueueItem({ ...item, sendStatus: "복사완료" }, storage);

  const saved = readMessageQueueItems(storage);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].sendStatus, "복사완료");
});

test("send history entry is created from completed queue item", () => {
  const item = createQueueItem();
  const history = createSendHistoryEntry(item, {
    sendChannel: "문자",
    sentMessage: item.smsMessage,
    sentAt: "2026-05-26T01:00:00.000Z",
    sentBy: "admin",
    memo: "sent"
  });

  assert.equal(history.queueId, item.id);
  assert.equal(history.sendChannel, "문자");
  assert.equal(history.sentMessage, item.smsMessage);
});

test("message queue localStorage failures do not throw", () => {
  const storage = new FailingStorage();

  assert.doesNotThrow(() => saveMessageQueueItem(createQueueItem(), storage));
  assert.equal(saveMessageQueueItem(createQueueItem(), storage), false);
});
