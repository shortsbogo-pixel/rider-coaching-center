import type { AICoachingHistoryEntry } from "../../../src/types/aiCoaching";
import { createJsonRepository } from "./storageClient";

export const aiCoachingHistoryRepository = createJsonRepository<AICoachingHistoryEntry>("aiCoachingHistory.json");
