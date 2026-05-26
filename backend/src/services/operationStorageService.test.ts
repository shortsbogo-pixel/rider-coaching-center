import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createOperationStorageService } from "./operationStorageService";

test("operation storage creates missing files and appends entries", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "operation-storage-"));
  try {
    const service = createOperationStorageService(rootDir);

    const saved = await service.aiCoachingHistory.save({
      id: "history-1",
      riderName: "김라이더",
      weekKey: "5월2주차",
      adminMessage: "admin",
      riderMessage: "rider",
      createdAt: "2026-05-26T00:00:00.000Z"
    });

    assert.equal(saved.id, "history-1");
    assert.equal((await service.aiCoachingHistory.getAll()).length, 1);
    const raw = await readFile(join(rootDir, "ai-coaching-history.json"), "utf8");
    assert.match(raw, /김라이더/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("operation storage recovers corrupted json as an empty list", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "operation-storage-"));
  try {
    await writeFile(join(rootDir, "weekly-briefings.json"), "{ broken", "utf8");
    const service = createOperationStorageService(rootDir);

    assert.deepEqual(await service.weeklyBriefings.getAll(), []);
    await service.weeklyBriefings.save({ id: "briefing-1", weekKey: "5월2주차", createdAt: "2026-05-26T00:00:00.000Z" });

    const saved = await service.weeklyBriefings.getAll();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, "briefing-1");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("operation logs are returned newest first", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "operation-storage-"));
  try {
    const service = createOperationStorageService(rootDir);
    await service.operationLogs.save({
      id: "old",
      actionType: "AI_COACHING_GENERATED",
      actorRole: "admin",
      actorName: "관리자",
      summary: "old",
      createdAt: "2026-05-25T00:00:00.000Z"
    });
    await service.operationLogs.save({
      id: "new",
      actionType: "MONTHLY_REPORT_GENERATED",
      actorRole: "admin",
      actorName: "관리자",
      summary: "new",
      createdAt: "2026-05-26T00:00:00.000Z"
    });

    assert.deepEqual((await service.operationLogs.getLatest()).map((entry) => entry.id), ["new", "old"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
