import { resolve } from "node:path";
import type { CustomCoachingMessage } from "../../../src/types/coaching";
import { readJsonArray, writeJsonArray } from "./jsonStore";

const customMessagesPath = resolve(process.cwd(), "backend/src/data/customCoachingMessages.json");

function matchesKey(message: CustomCoachingMessage, riderId: string, weekKey: string) {
  return message.riderId === riderId && message.weekKey === weekKey;
}

export async function getCustomCoachingMessages(weekKey?: string) {
  const messages = await readJsonArray<CustomCoachingMessage>(customMessagesPath);
  return weekKey ? messages.filter((message) => message.weekKey === weekKey) : messages;
}

export async function getCustomCoachingMessage(riderId: string, weekKey: string) {
  const messages = await readJsonArray<CustomCoachingMessage>(customMessagesPath);
  return messages.find((message) => matchesKey(message, riderId, weekKey));
}

export async function saveCustomCoachingMessage(input: {
  riderId: string;
  riderName: string;
  weekKey: string;
  autoMessage: string;
  customMessage: string;
}) {
  const messages = await readJsonArray<CustomCoachingMessage>(customMessagesPath);
  const nextMessage: CustomCoachingMessage = {
    riderId: input.riderId,
    riderName: input.riderName,
    weekKey: input.weekKey,
    autoMessage: input.autoMessage,
    customMessage: input.customMessage,
    isCustom: true,
    updatedAt: new Date().toISOString()
  };

  const next = messages.filter((message) => !matchesKey(message, input.riderId, input.weekKey));
  next.push(nextMessage);
  await writeJsonArray(customMessagesPath, next);
  return nextMessage;
}

export async function resetCustomCoachingMessage(riderId: string, weekKey: string) {
  const messages = await readJsonArray<CustomCoachingMessage>(customMessagesPath);
  await writeJsonArray(
    customMessagesPath,
    messages.filter((message) => !matchesKey(message, riderId, weekKey))
  );
}
