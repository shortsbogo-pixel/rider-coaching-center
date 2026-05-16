import type { CustomCoachingMessage } from "../../../src/types/coaching";
import { coachingMessageRepository } from "../repositories/coachingMessageRepository";

export async function getCustomCoachingMessages(weekKey?: string) {
  const messages = await coachingMessageRepository.getAll();
  return weekKey ? messages.filter((message) => message.weekKey === weekKey) : messages;
}

export async function getCustomCoachingMessage(riderId: string, weekKey: string) {
  const message = await coachingMessageRepository.getByRiderWeek(riderId, weekKey);
  return message?.isCustom ? message : undefined;
}

export async function saveCustomCoachingMessage(input: {
  riderId: string;
  riderName: string;
  weekKey: string;
  autoMessage: string;
  customMessage: string;
  updatedBy?: string;
}) {
  const nextMessage: CustomCoachingMessage = {
    id: coachingMessageRepository.idFor(input.riderId, input.weekKey),
    riderId: input.riderId,
    riderName: input.riderName,
    weekKey: input.weekKey,
    autoMessage: input.autoMessage,
    customMessage: input.customMessage,
    isCustom: true,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy || "admin"
  };

  await coachingMessageRepository.saveForRiderWeek(nextMessage);
  return nextMessage;
}

export async function resetCustomCoachingMessage(riderId: string, weekKey: string) {
  const existing = await coachingMessageRepository.getByRiderWeek(riderId, weekKey);
  if (!existing) return;
  await coachingMessageRepository.saveForRiderWeek({
    ...existing,
    customMessage: "",
    isCustom: false,
    updatedAt: new Date().toISOString()
  });
}
