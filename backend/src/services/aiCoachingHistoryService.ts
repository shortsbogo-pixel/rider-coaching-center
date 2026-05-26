import type { AICoachingHistoryEntry } from "../../../src/types/aiCoaching";
import { aiCoachingHistoryRepository } from "../repositories/aiCoachingHistoryRepository";

export async function saveAICoachingHistory(entry: AICoachingHistoryEntry) {
  return aiCoachingHistoryRepository.save(entry);
}

export async function getAICoachingHistory(weekKey?: string, riderId?: string) {
  const all = await aiCoachingHistoryRepository.getAll();
  return all
    .filter((entry) => (weekKey ? entry.weekKey === weekKey : true) && (riderId ? entry.riderId === riderId : true))
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}
