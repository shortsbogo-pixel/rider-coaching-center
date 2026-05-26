import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

test("operation logs keep the newest 100 entries by default", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "operation-storage-"));
  try {
    const service = createOperationStorageService(rootDir);
    for (let index = 0; index < 105; index += 1) {
      await service.operationLogs.save({
        id: `log-${index}`,
        actionType: "AI_COACHING_GENERATED",
        actorRole: "admin",
        actorName: "관리자",
        summary: `log ${index}`,
        createdAt: new Date(Date.UTC(2026, 4, 26, 0, index)).toISOString()
      });
    }

    const latest = await service.operationLogs.getLatest();

    assert.equal(latest.length, 100);
    assert.equal(latest[0].id, "log-104");
    assert.equal(latest.at(-1)?.id, "log-5");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("operation logs rename corrupted json before recreating an empty list", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "operation-storage-"));
  try {
    await writeFile(join(rootDir, "operation-logs.json"), "{ broken", "utf8");
    const service = createOperationStorageService(rootDir);

    assert.deepEqual(await service.operationLogs.getAll(), []);

    const files = await readdir(rootDir);
    assert.ok(files.some((file) => file.startsWith("operation-logs.corrupt-") && file.endsWith(".json")));
    assert.equal(await readFile(join(rootDir, "operation-logs.json"), "utf8"), "[]\n");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("operation storage supports message queue and send history collections", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "operation-storage-"));
  try {
    const service = createOperationStorageService(rootDir);

    await service.messageQueue.save({
      id: "queue-1",
      riderName: "Test Rider",
      weekKey: "2026-W21",
      sendStatus: "대기",
      createdAt: "2026-05-26T00:00:00.000Z"
    });
    await service.messageSendHistory.save({
      id: "history-1",
      queueId: "queue-1",
      riderName: "Test Rider",
      sentAt: "2026-05-26T01:00:00.000Z"
    });

    assert.equal((await service.messageQueue.getAll()).length, 1);
    assert.equal((await service.messageSendHistory.getAll()).length, 1);
    assert.equal(await service.messageQueue.delete("queue-1"), true);
    assert.deepEqual(await service.messageQueue.getAll(), []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("operation storage supports AI operation briefing collection", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "operation-storage-"));
  try {
    const service = createOperationStorageService(rootDir);

    await service.operationBriefings.save({
      id: "operation-briefing-1",
      weekKey: "5월2주차",
      executiveSummary: "고위험 2명 확인",
      createdAt: "2026-05-26T00:00:00.000Z"
    });

    const saved = await service.operationBriefings.getAll();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, "operation-briefing-1");
    assert.match(await readFile(join(rootDir, "operation-briefings.json"), "utf8"), /operation-briefing-1/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
