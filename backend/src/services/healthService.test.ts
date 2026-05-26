import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildFullHealthReport, buildHealthSummary } from "./healthService";

test("buildHealthSummary returns public server health fields", () => {
  const summary = buildHealthSummary({ startedAt: Date.now() - 1000, version: "test-version" });

  assert.equal(summary.success, true);
  assert.equal(summary.status, "ok");
  assert.equal(summary.version, "test-version");
  assert.equal(typeof summary.uptime, "number");
  assert.ok(summary.timestamp);
});

test("buildFullHealthReport checks operation files and Ollama status", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "health-report-"));
  try {
    await writeFile(join(rootDir, "operation-logs.json"), "[]", "utf8");

    const report = await buildFullHealthReport({
      dataDir: rootDir,
      operationFileNames: ["operation-logs.json", "message-queue.json"],
      startedAt: Date.now() - 1000,
      version: "test-version",
      checkOllama: async () => ({
        ollamaConnected: true,
        model: "gemma4:e2b",
        gemmaResponding: true,
        checkedAt: "2026-05-26T00:00:00.000Z",
        fallbackUsed: false,
        message: "ok"
      })
    });

    assert.equal(report.success, true);
    assert.equal(report.status, "warning");
    assert.equal(report.version, "test-version");
    assert.equal(report.server.status, "ok");
    assert.equal(report.dataDirectory.accessible, true);
    assert.equal(report.operationDataFiles.find((item) => item.fileName === "operation-logs.json")?.status, "ok");
    assert.equal(report.operationDataFiles.find((item) => item.fileName === "message-queue.json")?.status, "warning");
    assert.equal(report.ollama.connected, true);
    assert.equal(report.ollama.gemmaResponding, true);
    assert.equal(report.ollama.model, "gemma4:e2b");
    assert.equal(report.ollama.fallbackAvailable, true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
