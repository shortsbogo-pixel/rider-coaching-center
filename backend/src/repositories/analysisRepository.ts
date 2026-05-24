import type { AnalysisCache } from "../../../src/types/analysis";
import { createJsonRepository } from "./storageClient";

const repository = createJsonRepository<AnalysisCache>("analysisCache.json");

function isCorruptCache(error: unknown) {
  return error instanceof SyntaxError;
}

export const analysisRepository = {
  ...repository,
  async getAll() {
    try {
      return await repository.getAll();
    } catch (error) {
      if (!isCorruptCache(error)) throw error;
      await repository.clear();
      return [];
    }
  },
  async save(cache: AnalysisCache) {
    try {
      return await repository.save(cache);
    } catch (error) {
      if (!isCorruptCache(error)) throw error;
      await repository.clear();
      return repository.save(cache);
    }
  },
  async getByWeek(weekKey: string) {
    try {
      return await repository.getById(weekKey);
    } catch (error) {
      if (!isCorruptCache(error)) throw error;
      await repository.clear();
      return undefined;
    }
  },
  async invalidateWeek(weekKey: string) {
    try {
      await repository.remove(weekKey);
    } catch (error) {
      if (!isCorruptCache(error)) throw error;
      await repository.clear();
    }
  }
};
