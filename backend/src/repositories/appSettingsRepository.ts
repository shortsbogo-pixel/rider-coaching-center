import type { AppSettings } from "../../../src/types/appSettings";
import { createJsonRepository } from "./storageClient";

const repository = createJsonRepository<AppSettings>("appSettings.json");

export const appSettingsRepository = {
  ...repository,
  async getSettings() {
    const existing = await repository.getById("default");
    if (existing) return existing;
    return repository.save({ id: "default", retentionWeeks: 8, updatedAt: new Date().toISOString() });
  },
  async markBackupCreated() {
    const settings = await this.getSettings();
    const now = new Date().toISOString();
    return repository.save({ ...settings, lastBackupAt: now, updatedAt: now });
  }
};
