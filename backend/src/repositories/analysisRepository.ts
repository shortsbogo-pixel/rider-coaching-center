import type { AnalysisCache } from "../../../src/types/analysis";
import { createJsonRepository } from "./storageClient";

const repository = createJsonRepository<AnalysisCache>("analysisCache.json");

export const analysisRepository = {
  ...repository,
  async getByWeek(weekKey: string) {
    return repository.getById(weekKey);
  },
  async invalidateWeek(weekKey: string) {
    await repository.remove(weekKey);
  }
};
