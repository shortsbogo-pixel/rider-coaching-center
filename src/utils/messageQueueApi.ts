import type { OperationApiResponse } from "../types/operation";
import type { MessageQueueItem, MessageSendHistoryEntry } from "../types/messageQueue";
import { getAuthHeader } from "./authStore";
import { buildOperationApiUrl } from "./operationApi";

async function readPayload<T>(response: Response): Promise<OperationApiResponse<T>> {
  const payload = (await response.json()) as OperationApiResponse<T>;
  if (!payload || typeof payload.success !== "boolean") {
    throw new Error("invalid operation api response");
  }
  return payload;
}

async function requestMessageQueue<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildOperationApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {})
    }
  });
  const payload = await readPayload<T>(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "message queue api failed");
  }
  return payload.data;
}

export const messageQueueApi = {
  getQueue: () => requestMessageQueue<MessageQueueItem[]>("/message-queue"),
  saveQueueItem: (item: MessageQueueItem) =>
    requestMessageQueue<MessageQueueItem>("/message-queue", {
      method: "POST",
      body: JSON.stringify(item)
    }),
  updateQueueItem: (item: MessageQueueItem) =>
    requestMessageQueue<MessageQueueItem>(`/message-queue/${encodeURIComponent(item.id)}`, {
      method: "PUT",
      body: JSON.stringify(item)
    }),
  deleteQueueItem: (id: string) =>
    requestMessageQueue<{ deleted: boolean }>(`/message-queue/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }),
  getSendHistory: () => requestMessageQueue<MessageSendHistoryEntry[]>("/message-send-history"),
  saveSendHistory: (entry: MessageSendHistoryEntry) =>
    requestMessageQueue<MessageSendHistoryEntry>("/message-send-history", {
      method: "POST",
      body: JSON.stringify(entry)
    })
};
