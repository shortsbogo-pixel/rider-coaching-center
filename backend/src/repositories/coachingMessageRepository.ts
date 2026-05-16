import type { CustomCoachingMessage } from "../../../src/types/coaching";
import { createJsonRepository } from "./storageClient";

const repository = createJsonRepository<CustomCoachingMessage & { id: string }>("customCoachingMessages.json");

function messageId(riderId: string, weekKey: string) {
  return `${weekKey}::${riderId}`;
}

export const coachingMessageRepository = {
  ...repository,
  idFor: messageId,
  async getByRiderWeek(riderId: string, weekKey: string) {
    return repository.getById(messageId(riderId, weekKey));
  },
  async saveForRiderWeek(message: CustomCoachingMessage) {
    return repository.save({ ...message, id: message.id ?? messageId(message.riderId, message.weekKey) });
  },
  async removeByRiderWeek(riderId: string, weekKey: string) {
    await repository.remove(messageId(riderId, weekKey));
  }
};
