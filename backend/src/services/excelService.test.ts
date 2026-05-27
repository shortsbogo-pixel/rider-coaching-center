import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import XLSX from "xlsx";
import { normalizeDeliveryType, receiveUploadPreview } from "./excelService";

function writeWorkbook(rows: unknown[][], fileName = "upload-parser-test.xlsx") {
  return mkdtemp(path.join(tmpdir(), "rider-upload-")).then((dir) => {
    const filePath = path.join(dir, fileName);
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "오더별 상세 내역서");
    XLSX.writeFile(workbook, filePath);
    return { dir, filePath };
  });
}

function uploadFile(filePath: string, originalname = "upload-parser-test.xlsx") {
  return {
    path: filePath,
    originalname
  } as Parameters<typeof receiveUploadPreview>[0];
}

test("maps rider name candidate columns from real-world upload headers", async () => {
  const { dir, filePath } = await writeWorkbook([
    ["메타", "값"],
    ["배달파트너명", "픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입"],
    ["김수환7172", "대전 동구", "대전 중구", "2026-05-01 10:00", "2026-05-01 10:20", "0:20", "Lunch_Peak", "단건 배달"]
  ]);

  try {
    const preview = await receiveUploadPreview(uploadFile(filePath), "테스트1주차");

    assert.equal(preview.status, "ready");
    assert.equal(preview.previewRows[0]?.riderName, "김수환7172");
    assert.equal(preview.previewRows[0]?.baseName, "김수환");
    assert.equal(preview.missingColumns.includes("성함 또는 이름"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("maps article rider name candidate columns", async () => {
  const { dir, filePath } = await writeWorkbook([
    ["기사", "픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입"],
    ["이현수4321", "대전 동구", "대전 중구", "2026-05-01 10:00", "2026-05-01 10:20", "0:20", "Lunch_Peak", "단건"]
  ]);

  try {
    const preview = await receiveUploadPreview(uploadFile(filePath), "테스트1-2주차");

    assert.equal(preview.status, "ready");
    assert.equal(preview.previewRows[0]?.riderName, "이현수4321");
    assert.equal(preview.missingColumns.includes("성함 또는 이름"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("maps courierName rider name candidate columns", async () => {
  const { dir, filePath } = await writeWorkbook([
    ["courierName", "픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입"],
    ["박정우9876", "대전 동구", "대전 중구", "2026-05-01 11:00", "2026-05-01 11:20", "0:20", "Lunch_Peak", "M2"]
  ]);

  try {
    const preview = await receiveUploadPreview(uploadFile(filePath), "테스트1-2-2주차");

    assert.equal(preview.status, "ready");
    assert.equal(preview.previewRows[0]?.riderName, "박정우9876");
    assert.equal(preview.previewRows[0]?.deliveryType, "멀티배달2");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("maps completed count candidate columns without changing completed count logic", async () => {
  const { dir, filePath } = await writeWorkbook([
    ["라이더명", "픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입", "수행건수"],
    ["김수환7172", "대전 동구", "대전 중구", "2026-05-01 10:00", "2026-05-01 10:20", "0:20", "Lunch_Peak", "단건", "3"],
    ["박종관1234", "대전 동구", "대전 중구", "2026-05-01 11:00", "2026-05-01 11:20", "0:20", "Lunch_Peak", "M2", "bad"]
  ]);

  try {
    const preview = await receiveUploadPreview(uploadFile(filePath), "테스트1-3주차");

    assert.equal(preview.status, "ready");
    assert.equal(preview.previewRows[0]?.completedCount, 3);
    assert.equal(preview.previewRows[1]?.completedCount, 1);
    assert.equal(preview.summary.numberConversionWarningRows, 1);
    assert.ok(preview.issues.some((issue) => issue.type === "invalid_completed_count" && issue.rawValue === "bad"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("normalizes single and multi delivery type variants", () => {
  assert.equal(normalizeDeliveryType("단건").deliveryType, "단건배달");
  assert.equal(normalizeDeliveryType("단건 배달").deliveryType, "단건배달");
  assert.equal(normalizeDeliveryType("SINGLE").deliveryType, "단건배달");
  assert.equal(normalizeDeliveryType("단일").deliveryType, "단건배달");
  assert.equal(normalizeDeliveryType("일반").deliveryType, "단건배달");
  assert.equal(normalizeDeliveryType("일반배달").deliveryType, "단건배달");

  assert.equal(normalizeDeliveryType("멀티1").deliveryType, "멀티배달1");
  assert.equal(normalizeDeliveryType("멀티 1").deliveryType, "멀티배달1");
  assert.equal(normalizeDeliveryType("멀티배달 1").deliveryType, "멀티배달1");
  assert.equal(normalizeDeliveryType("M1").deliveryType, "멀티배달1");
  assert.equal(normalizeDeliveryType("2").deliveryType, "멀티배달2");
  assert.equal(normalizeDeliveryType("MULTI").deliveryType, "멀티배달1");
  assert.equal(normalizeDeliveryType("1").deliveryType, "확인필요");
  assert.equal(normalizeDeliveryType("N/A").deliveryType, "확인필요");
});

test("keeps upload preview usable when delivery type is blank or unknown", async () => {
  const { dir, filePath } = await writeWorkbook([
    ["라이더명", "픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입"],
    ["김수환7172", "대전 동구", "대전 중구", "2026-05-01 10:00", "2026-05-01 10:20", "0:20", "Lunch_Peak", ""],
    ["박종관1234", "대전 동구", "대전 중구", "2026-05-01 11:00", "2026-05-01 11:20", "0:20", "Lunch_Peak", "퀵"]
  ]);

  try {
    const preview = await receiveUploadPreview(uploadFile(filePath), "테스트2주차");
    const deliveryTypeIssues = preview.issues.filter((issue) => issue.type === "invalid_delivery_type");

    assert.equal(preview.status, "ready");
    assert.equal(preview.previewRows.length, 2);
    assert.equal(preview.previewRows[0]?.deliveryType, "확인필요");
    assert.equal(preview.previewRows[1]?.deliveryType, "확인필요");
    assert.equal(deliveryTypeIssues.length, 2);
    assert.match(deliveryTypeIssues[0]?.message ?? "", /원본값/);
    assert.equal(preview.summary.deliveryTypeParsedRows, 0);
    assert.equal(preview.summary.deliveryTypeReviewRows, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("uses unidentified rider fallback and keeps row in analysis when rider name is blank", async () => {
  const { dir, filePath } = await writeWorkbook([
    ["라이더명", "픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입"],
    ["", "대전 동구", "대전 중구", "2026-05-01 10:00", "2026-05-01 10:20", "0:20", "Lunch_Peak", "단건"]
  ]);

  try {
    const preview = await receiveUploadPreview(uploadFile(filePath), "테스트2-2주차");

    assert.equal(preview.status, "ready");
    assert.equal(preview.previewRows[0]?.riderName, "미확인 라이더 #1");
    assert.equal(preview.summary.parsedRows, 1);
    assert.equal(preview.summary.riderNameMissingRows, 1);
    assert.ok(preview.issues.some((issue) => issue.message.includes("미확인 라이더 #1")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("warns clearly when rider name column is missing", async () => {
  const { dir, filePath } = await writeWorkbook([
    ["픽업지역", "배달지역", "수락시간", "배달시간", "배달소요시간", "피크타임", "배달타입"],
    ["대전 동구", "대전 중구", "2026-05-01 10:00", "2026-05-01 10:20", "0:20", "Lunch_Peak", "단건"]
  ]);

  try {
    const preview = await receiveUploadPreview(uploadFile(filePath), "테스트3주차");

    assert.equal(preview.status, "blocked");
    assert.equal(preview.missingColumns.includes("성함 또는 이름"), true);
    assert.ok(preview.issues.some((issue) => issue.message.includes("라이더명 컬럼을 찾지 못했습니다")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
