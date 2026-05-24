import type { RiderMetrics } from "../../../src/types/rider";
import { createJsonRepository } from "./storageClient";

export interface RiderProfileCache extends RiderMetrics {
  id: string;
  cacheWeekKey: string;
  updatedAt: string;
}

const repository = createJsonRepository<RiderProfileCache>("riderProfileCache.json");

function isCorruptCache(error: unknown) {
  return error instanceof SyntaxError;
}

export const riderRepository = {
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
  async replaceCache(metrics: RiderMetrics[], cacheWeekKey: string) {
    await repository.clear();
    return repository.saveMany(
      metrics.map((metric) => ({
        ...metric,
        id: metric.riderId,
        cacheWeekKey,
        updatedAt: new Date().toISOString()
      }))
    );
  }
};
