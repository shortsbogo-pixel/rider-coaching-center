import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import XLSX from "xlsx";
import type { DeliveryType, OrderRecord } from "../../../src/types/order";
import type { ParsedUpload } from "./excelService";

const repoRoot = process.cwd();
const servicePath = pathToFileURL(path.join(repoRoot, "backend/src/services/excelService.ts")).href;

async function withTempProject<T>(run: (rootDir: string) => Promise<T>) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "rider-parsed-storage-"));
  const originalCwd = process.cwd();
  await mkdir(path.join(rootDir, "backend/src/data/parsed"), { recursive: true });
  await mkdir(path.join(rootDir, "backend/src/data/uploads"), { recursive: true });
  process.chdir(rootDir);
  try {
    return await run(rootDir);
  } finally {
    process.chdir(originalCwd);
    await rm(rootDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
  }
}

async function importExcelService(caseName: string) {
  return import(`${servicePath}?case=${caseName}-${Date.now()}-${Math.random().toString(36).slice(2)}`) as Promise<{
    getUploadedWeeks: () => Promise<Array<{ week: string; status?: string; issueCount?: number }>>;
    getValidationSummary: () => Promise<{
      uploads: Array<{ week: string; status?: string }>;
      issues: Array<{ type: string; week: string; message: string; fileName?: string; errorType?: string }>;
      parsedStorage?: {
        status: string;
        errorCount: number;
        errors: Array<{ fileName: string; week?: string; errorType: string }>;
      };
    }>;
    loadParsedOrders: () => Promise<OrderRecord[]>;
    saveUploadedExcel: (file: Express.Multer.File | undefined, week: string) => Promise<ParsedUpload>;
    resetParsedUploads?: () => Promise<{ deletedCount: number; deletedFiles: string[]; analysisCachesCleared?: boolean; aiHistoryPreserved?: boolean }>;
    resetAnalysisCaches?: () => Promise<{ analysisCachesCleared: boolean; aiHistoryPreserved: boolean }>;
  }>;
}

function buildOrder(id: string, week: string, riderName: string): OrderRecord {
  return {
    id,
    week,
    riderName,
    baseName: riderName,
    pickupArea: "pickup",
    deliveryArea: "delivery",
    acceptedAt: "2026-05-01T10:00:00.000Z",
    deliveredAt: "2026-05-01T10:20:00.000Z",
    deliveryMinutes: 20,
    timeSegment: "Lunch_Peak",
    deliveryType: "단건배달" as DeliveryType,
    completedCount: 1,
    weekday: "금" as OrderRecord["weekday"]
  };
}

function buildParsedUpload(week: string): ParsedUpload {
  return {
    week,
    fileName: `${week}.xlsx`,
    uploadedAt: "2026-05-01T00:00:00.000Z",
    sheetName: "오더별 상세내역서",
    columns: ["라이더명"],
    missingColumns: [],
    orders: [buildOrder(`${week}-1`, week, "김테스트")],
    issues: [],
    summary: {
      totalRows: 1,
      parsedRows: 1,
      riderNameDetectedRows: 1,
      riderNameMissingRows: 0,
      deliveryTypeParsedRows: 1,
      deliveryTypeReviewRows: 0,
      numberConversionWarningRows: 0,
      duplicateRiderCount: 0,
      warningRows: 0,
      analysisTargetRiderCount: 1,
      issueCount: 0,
      displayedIssueCount: 0
    }
  };
}

async function writeWorkbook(filePath: string) {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ["라이더명", "픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입"],
    ["김테스트", "대전 동구", "대전 중구", "2026-05-01 10:00", "2026-05-01 10:20", "0:20", "Lunch_Peak", "단건배달"]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "오더별 상세내역서");
  XLSX.writeFile(workbook, filePath);
}

test("skips corrupt parsed JSON files and keeps valid parsed uploads available", async () => {
  await withTempProject(async (rootDir) => {
    const parsedDir = path.join(rootDir, "backend/src/data/parsed");
    await writeFile(path.join(parsedDir, "5월2주차.json"), JSON.stringify(buildParsedUpload("5월2주차")), "utf8");
    await writeFile(path.join(parsedDir, "broken.json"), `${JSON.stringify(buildParsedUpload("깨진주차"))}\n{"extra":true}`, "utf8");

    const service = await importExcelService("safe-read");
    const [weeks, orders, validation] = await Promise.all([
      service.getUploadedWeeks(),
      service.loadParsedOrders(),
      service.getValidationSummary()
    ]);

    assert.deepEqual(weeks.map((week) => week.week), ["5월2주차"]);
    assert.equal(orders.length, 1);
    assert.equal(validation.parsedStorage?.status, "needs_reset");
    assert.equal(validation.parsedStorage?.errorCount, 1);
    assert.equal(validation.issues.filter((issue) => issue.type === "parsed_json_error").length, 1);
    assert.match(validation.issues[0]?.message ?? "", /parsed 데이터를 초기화/);
    assert.doesNotMatch(validation.issues[0]?.message ?? "", /Unexpected non-whitespace|SyntaxError|at /);
  });
});

test("saveUploadedExcel writes a single parseable parsed JSON file", async () => {
  await withTempProject(async (rootDir) => {
    const sourceFile = path.join(rootDir, "upload.xlsx");
    await writeWorkbook(sourceFile);
    const service = await importExcelService("safe-write");

    const parsed = await service.saveUploadedExcel({ path: sourceFile, originalname: "upload.xlsx" } as Express.Multer.File, "5월4주차");
    const parsedPath = path.join(rootDir, "backend/src/data/parsed/5월4주차.json");
    const raw = await readFile(parsedPath, "utf8");

    assert.equal(parsed.week, "5월4주차");
    assert.equal(JSON.parse(raw).week, "5월4주차");
    assert.doesNotMatch(raw.trimEnd(), /\}\s*\{/);
    await assert.rejects(stat(sourceFile));
  });
});

test("resetParsedUploads removes only parsed result files", async () => {
  await withTempProject(async (rootDir) => {
    const parsedDir = path.join(rootDir, "backend/src/data/parsed");
    const uploadPath = path.join(rootDir, "backend/src/data/uploads/original.xlsx");
    await writeFile(path.join(parsedDir, "5월2주차.json"), JSON.stringify(buildParsedUpload("5월2주차")), "utf8");
    await writeFile(path.join(parsedDir, ".gitkeep"), "", "utf8");
    await writeFile(uploadPath, "source", "utf8");

    const service = await importExcelService("reset");
    assert.equal(typeof service.resetParsedUploads, "function");
    const result = await service.resetParsedUploads!();

    assert.equal(result.deletedCount, 1);
    assert.deepEqual(result.deletedFiles, ["5월2주차.json"]);
    assert.equal(result.analysisCachesCleared, true);
    assert.equal(result.aiHistoryPreserved, true);
    assert.equal(await readFile(uploadPath, "utf8"), "source");
    await assert.rejects(readFile(path.join(parsedDir, "5월2주차.json"), "utf8"));
    assert.equal(await readFile(path.join(parsedDir, ".gitkeep"), "utf8"), "");
  });
});

test("resetAnalysisCaches clears analysis and rider caches without removing parsed or AI history data", async () => {
  await withTempProject(async (rootDir) => {
    const parsedDir = path.join(rootDir, "backend/src/data/parsed");
    await writeFile(path.join(parsedDir, "5월2주차.json"), JSON.stringify(buildParsedUpload("5월2주차")), "utf8");
    await writeFile(path.join(rootDir, "backend/src/data/analysisCache.json"), JSON.stringify([{ id: "all", weekKey: "all" }]), "utf8");
    await writeFile(path.join(rootDir, "backend/src/data/riderProfileCache.json"), JSON.stringify([{ id: "uploaded-old", riderId: "uploaded-old" }]), "utf8");
    await mkdir(path.join(rootDir, "backend/data"), { recursive: true });
    await writeFile(path.join(rootDir, "backend/data/ai-coaching-history.json"), JSON.stringify([{ id: "history-1", riderName: "uploaded-old" }]), "utf8");

    const service = await importExcelService("analysis-cache-reset");
    assert.equal(typeof service.resetAnalysisCaches, "function");
    const result = await service.resetAnalysisCaches!();

    assert.equal(result.analysisCachesCleared, true);
    assert.equal(result.aiHistoryPreserved, true);
    assert.equal(JSON.parse(await readFile(path.join(rootDir, "backend/src/data/analysisCache.json"), "utf8")).length, 0);
    assert.equal(JSON.parse(await readFile(path.join(rootDir, "backend/src/data/riderProfileCache.json"), "utf8")).length, 0);
    assert.equal(JSON.parse(await readFile(path.join(rootDir, "backend/data/ai-coaching-history.json"), "utf8")).length, 1);
    assert.equal(JSON.parse(await readFile(path.join(parsedDir, "5월2주차.json"), "utf8")).week, "5월2주차");
  });
});
