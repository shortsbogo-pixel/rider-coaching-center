import type { UploadHistory } from "../../../src/types/upload";
import { createJsonRepository } from "./storageClient";

const repository = createJsonRepository<UploadHistory>("uploadHistory.json");

export const uploadRepository = {
  ...repository,
  async getByWeek(weekKey: string) {
    return (await repository.getAll()).find((item) => item.weekKey === weekKey);
  },
  async markDeletionCandidates(limit = 8) {
    const uploads = (await repository.getAll()).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
    const overflow = Math.max(uploads.length - limit + 1, 0);
    const candidateIds = new Set(uploads.slice(0, overflow).map((item) => item.id));
    return uploads.map((item) => ({ ...item, deletionCandidate: candidateIds.has(item.id) }));
  }
};
