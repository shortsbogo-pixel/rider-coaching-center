import type { CreateMessageQueueItemInput, MessageQueueItem, MessageSendChannel, MessageSendHistoryEntry } from "../types/messageQueue";
import { formatKakaoRiderMessage, formatSmsRiderMessage } from "./riderMessageFormatter";

const MESSAGE_QUEUE_STORAGE_KEY = "rider-coaching-message-queue";
const MESSAGE_SEND_HISTORY_STORAGE_KEY = "rider-coaching-message-send-history";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

function readJsonArray<T>(key: string, storage = getStorage()): T[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // localStorage cleanup should not block the admin workflow.
    }
    return [];
  }
}

function writeJsonArray<T>(key: string, items: T[], storage = getStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function createId(prefix: string, createdAt = new Date().toISOString()) {
  return `${prefix}-${createdAt}-${Math.random().toString(36).slice(2)}`;
}

export function readMessageQueueItems(storage?: StorageLike) {
  return readJsonArray<MessageQueueItem>(MESSAGE_QUEUE_STORAGE_KEY, storage).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function readMessageSendHistoryEntries(storage?: StorageLike) {
  return readJsonArray<MessageSendHistoryEntry>(MESSAGE_SEND_HISTORY_STORAGE_KEY, storage).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export function hasDuplicateMessageQueueItem(items: MessageQueueItem[], candidate: Pick<MessageQueueItem, "riderName" | "weekKey" | "riderMessage">) {
  return items.some(
    (item) =>
      item.riderName.trim() === candidate.riderName.trim() &&
      item.weekKey.trim() === candidate.weekKey.trim() &&
      item.riderMessage.trim() === candidate.riderMessage.trim() &&
      item.sendStatus !== "발송완료"
  );
}

export function createMessageQueueItem(input: CreateMessageQueueItemInput): MessageQueueItem {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: createId("message-queue", createdAt),
    riderName: input.riderName,
    weekKey: input.weekKey,
    riskLevel: input.riskLevel,
    trendLabel: input.trendLabel,
    adminMessage: input.adminMessage,
    riderMessage: input.riderMessage,
    isTemplate: input.isTemplate,
    source: input.source,
    fallbackReason: input.fallbackReason,
    provider: input.provider,
    aiMode: input.aiMode,
    templateKey: input.templateKey,
    templateVersion: input.templateVersion,
    kakaoMessage: formatKakaoRiderMessage({
      riderName: input.riderName,
      riderMessage: input.riderMessage,
      currentWeekCompleted: input.currentWeekCompleted,
      changeRate: input.changeRate,
      riskLevel: input.riskLevel
    }),
    smsMessage: formatSmsRiderMessage({
      riderName: input.riderName,
      currentWeekCompleted: input.currentWeekCompleted,
      changeRate: input.changeRate,
      riskLevel: input.riskLevel
    }),
    sendStatus: "대기",
    sendChannel: "카톡",
    createdAt,
    updatedAt: createdAt,
    memo: ""
  };
}

export function saveMessageQueueItem(item: MessageQueueItem, storage?: StorageLike) {
  const current = readMessageQueueItems(storage);
  const next = [...current.filter((entry) => entry.id !== item.id), item];
  return writeJsonArray(MESSAGE_QUEUE_STORAGE_KEY, next, storage);
}

export function updateMessageQueueItem(item: MessageQueueItem, storage?: StorageLike) {
  return saveMessageQueueItem({ ...item, updatedAt: item.updatedAt || new Date().toISOString() }, storage);
}

export function deleteMessageQueueItem(id: string, storage?: StorageLike) {
  const current = readMessageQueueItems(storage);
  return writeJsonArray(
    MESSAGE_QUEUE_STORAGE_KEY,
    current.filter((item) => item.id !== id),
    storage
  );
}

export function createSendHistoryEntry(
  item: MessageQueueItem,
  input: {
    sendChannel: MessageSendChannel;
    sentMessage: string;
    sentAt?: string;
    sentBy: string;
    memo?: string;
  }
): MessageSendHistoryEntry {
  const sentAt = input.sentAt ?? new Date().toISOString();
  return {
    id: createId("message-send-history", sentAt),
    queueId: item.id,
    riderName: item.riderName,
    weekKey: item.weekKey,
    riskLevel: item.riskLevel,
    sendChannel: input.sendChannel,
    sentMessage: input.sentMessage,
    sentAt,
    sentBy: input.sentBy,
    memo: input.memo
  };
}

export function saveMessageSendHistoryEntry(entry: MessageSendHistoryEntry, storage?: StorageLike) {
  const current = readMessageSendHistoryEntries(storage);
  const next = [...current.filter((item) => item.id !== entry.id), entry];
  return writeJsonArray(MESSAGE_SEND_HISTORY_STORAGE_KEY, next, storage);
}
