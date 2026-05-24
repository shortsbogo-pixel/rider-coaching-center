import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import type { DeliveryType, OrderRecord, TimeSegment } from "../../../src/types/order";
import type { RiderProfile } from "../../../src/types/rider";
import riders from "../../../src/data/sampleRiders.json";
import { requiredOrderColumns } from "../../../src/utils/excelParser";
import { extractBaseName, matchRiderByName } from "../../../src/utils/riderMatcher";
import { analysisRepository } from "../repositories/analysisRepository";
import { riderRepository } from "../repositories/riderRepository";
import { uploadRepository } from "../repositories/uploadRepository";

const parsedDir = path.join(process.cwd(), "backend", "src", "data", "parsed");
const riderData = riders as RiderProfile[];

const sheetCandidates = ["오더별 상세내역서", "오더별 상세 내역서", "오더별상세내역서"];
const timeSegments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];
const deliveryTypes: DeliveryType[] = ["단건배달", "멀티배달1", "멀티배달2", "멀티배달3", "멀티배달4"];
const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"] as const;

type RawRow = Record<string, unknown> & { __rowNumber?: number };

const columnAliases: Record<string, string[]> = {
  "성함 또는 이름": ["성함 또는 이름", "성함", "이름", "기사명", "라이더명"],
  픽업지역: ["픽업지역", "픽업 주소", "픽업지"],
  배달지역: ["배달지역", "배달 주소", "도착지", "전달지역"],
  수락시간: ["수락시간", "배달수락일시"],
  배달시간: ["배달시간", "전달시간", "완료시간"],
  배달소요시간: ["배달소요시간", "배달소요시간(시:분)", "소요시간"],
  "해당 구간타임": ["해당 구간타임", "피크타임", "구간타임"],
  배달타입: ["배달타입", "배달 유형"],
  완료건수: ["완료건수", "완료", "총 정산 오더수"]
};

export interface ParsedUpload {
  week: string;
  fileName: string;
  uploadedAt: string;
  sheetName: string;
  columns: string[];
  missingColumns: string[];
  orders: OrderRecord[];
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  rowNumber: number;
  type: "missing_value" | "invalid_delivery_type" | "invalid_time_segment" | "outlier";
  message: string;
}

export interface UploadPreview {
  week: string;
  fileName: string;
  sheetName: string;
  status: "ready" | "blocked";
  columns: string[];
  missingColumns: string[];
  previewRows: OrderRecord[];
  issues: ValidationIssue[];
}

function safeWeekFileName(week: string) {
  return `${week.replace(/[\\/:*?"<>|.\s]/g, "_")}.json`;
}

function parsedPathForWeek(week: string) {
  return path.join(parsedDir, safeWeekFileName(week));
}

function decodeFileName(fileName: string) {
  const decoded = Buffer.from(fileName, "latin1").toString("utf8");
  return decoded.includes("�") ? fileName : decoded;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const normalized = asString(value).replace(/,/g, "");
  if (!normalized || normalized === "-") return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  const raw = asString(value);
  if (!raw || raw === "-") return undefined;
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asDurationMinutes(value: unknown): number {
  const raw = asString(value);
  if (/^\d+:\d{1,2}$/.test(raw)) {
    const [hours, minutes] = raw.split(":").map(Number);
    return hours * 60 + minutes;
  }
  if (/^\d+:\d{1,2}:\d{1,2}$/.test(raw)) {
    const [hours, minutes] = raw.split(":").map(Number);
    return hours * 60 + minutes;
  }
  return asNumber(value);
}

function resolveHeader(row: RawRow, candidates: string[]): string | undefined {
  const normalizedCandidates = candidates.map((candidate) => candidate.replace(/\s/g, ""));
  const keys = Object.keys(row).map((key) => key.trim());
  return keys.find((key) => normalizedCandidates.includes(key.replace(/\s/g, "")));
}

function getCell(row: RawRow, candidates: string[]) {
  const key = resolveHeader(row, candidates);
  return key ? row[key] : undefined;
}

function findOrderSheet(workbook: XLSX.WorkBook) {
  const exact = workbook.SheetNames.find((name) => sheetCandidates.includes(name.trim()));
  if (exact) return exact;
  return workbook.SheetNames.find((name) => {
    const normalized = name.replace(/\s/g, "");
    return normalized.includes("오더") && normalized.includes("상세") && normalized.includes("내역");
  });
}

function getMissingColumns(columns: string[]) {
  const normalizedColumns = columns.map((column) => column.replace(/\s/g, ""));
  const missing = requiredOrderColumns.filter((column) => {
    if (column === "완료건수") return false;
    const aliases = columnAliases[column] ?? [column];
    return !aliases.some((alias) => normalizedColumns.includes(alias.replace(/\s/g, "")));
  });
  return missing;
}

function normalizeHeaderValue(value: unknown): string {
  return asString(value).replace(/\s+/g, " ").trim();
}

function findHeaderRowIndex(rows: unknown[][]) {
  let bestIndex = -1;
  let bestScore = 0;

  rows.slice(0, 40).forEach((row, index) => {
    const headers = row.map(normalizeHeaderValue).filter(Boolean);
    const score = requiredOrderColumns.reduce((sum, column) => {
      if (column === "완료건수") return sum;
      const aliases = columnAliases[column] ?? [column];
      return sum + (aliases.some((alias) => headers.some((header) => header.replace(/\s/g, "") === alias.replace(/\s/g, ""))) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 5 ? bestIndex : -1;
}

function rowsFromSheet(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  const headerIndex = findHeaderRowIndex(matrix);
  if (headerIndex < 0) {
    return { columns: [], rows: [] as RawRow[], headerRowNumber: 0 };
  }

  const columns = matrix[headerIndex].map(normalizeHeaderValue);
  const rows = matrix.slice(headerIndex + 1).map((values, rowOffset) => {
    const row: RawRow = { __rowNumber: headerIndex + rowOffset + 2 };
    columns.forEach((column, columnIndex) => {
      if (column) row[column] = values[columnIndex];
    });
    return row;
  });

  return { columns, rows, headerRowNumber: headerIndex + 1 };
}

function normalizeTimeSegment(value: unknown): TimeSegment | undefined {
  const raw = asString(value);
  return timeSegments.find((segment) => segment === raw);
}

function normalizeDeliveryType(value: unknown): DeliveryType | undefined {
  const raw = asString(value).replace(/\s/g, "");
  if (!raw) return "단건배달";
  return deliveryTypes.find((type) => type === raw);
}

function normalizeDateString(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return asString(value);
}

function getWeekday(value: unknown): OrderRecord["weekday"] {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return weekdayNames[value.getDay()];
  const raw = asString(value);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return weekdayNames[parsed.getDay()];
  return "월";
}

function rowToOrder(row: RawRow, week: string, index: number, issues: ValidationIssue[]): OrderRecord | undefined {
  const riderName = asString(getCell(row, columnAliases["성함 또는 이름"]));
  const pickupArea = asString(getCell(row, columnAliases["픽업지역"]));
  const deliveryArea = asString(getCell(row, columnAliases["배달지역"]));
  const acceptedAtRaw = getCell(row, columnAliases["수락시간"]);
  const deliveredAtRaw = getCell(row, columnAliases["배달시간"]);
  const deliveryMinutes = asDurationMinutes(getCell(row, columnAliases["배달소요시간"]));
  const timeSegment = normalizeTimeSegment(getCell(row, columnAliases["해당 구간타임"]));
  const deliveryType = normalizeDeliveryType(getCell(row, columnAliases["배달타입"]));
  const completedCount = asNumber(getCell(row, columnAliases["완료건수"]), 1);
  const rowNumber = row.__rowNumber ?? index + 2;

  if (!riderName && !pickupArea && !deliveryArea) return undefined;
  if (!pickupArea && !deliveryArea && !acceptedAtRaw && !deliveredAtRaw) return undefined;

  if (!riderName || !pickupArea || !deliveryArea) {
    issues.push({ rowNumber, type: "missing_value", message: "이름, 픽업지역, 배달지역 중 빈값이 있습니다." });
  }

  if (!timeSegment) {
    issues.push({ rowNumber, type: "invalid_time_segment", message: "해당 구간타임을 Breakfast/Lunch_Peak/Post_Lunch/Dinner_Peak/Post_Dinner 중 하나로 해석할 수 없습니다." });
  }

  if (!deliveryType) {
    issues.push({ rowNumber, type: "invalid_delivery_type", message: "배달타입을 단건배달 또는 멀티배달1~4 중 하나로 해석할 수 없습니다." });
  }

  if (deliveryMinutes < 0 || deliveryMinutes > 120) {
    issues.push({ rowNumber, type: "outlier", message: `배달소요시간 ${deliveryMinutes}분은 이상치일 수 있습니다.` });
  }

  return {
    id: `${week}-${index + 1}`,
    week,
    riderName,
    baseName: extractBaseName(riderName),
    pickupArea,
    deliveryArea,
    acceptedAt: normalizeDateString(acceptedAtRaw),
    deliveredAt: normalizeDateString(deliveredAtRaw),
    deliveryMinutes,
    timeSegment: timeSegment ?? "Lunch_Peak",
    deliveryType: deliveryType ?? "단건배달",
    completedCount,
    weekday: getWeekday(acceptedAtRaw),
    rejectionRate: asOptionalNumber(getCell(row, ["거절율", "거절률"])),
    ignoredRate: asOptionalNumber(getCell(row, ["무시율", "무시률"]))
  };
}

async function parseWorkbook(filePath: string, week: string, fileName: string): Promise<UploadPreview> {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = findOrderSheet(workbook);

  if (!sheetName) {
    return {
      week,
      fileName,
      sheetName: "",
      status: "blocked",
      columns: [],
      missingColumns: requiredOrderColumns,
      previewRows: [],
      issues: [{ rowNumber: 0, type: "missing_value", message: "오더별 상세내역서 시트를 찾을 수 없습니다." }]
    };
  }

  const { rows, columns } = rowsFromSheet(workbook.Sheets[sheetName]);
  const missingColumns = getMissingColumns(columns);
  const issues: ValidationIssue[] = [];
  const orders = rows
    .map((row, index) => rowToOrder(row, week, index, issues))
    .filter((order): order is OrderRecord => Boolean(order));

  return {
    week,
    fileName,
    sheetName,
    status: missingColumns.length ? "blocked" : "ready",
    columns,
    missingColumns,
    previewRows: orders.slice(0, 10),
    issues: issues.slice(0, 30)
  };
}

export async function getUploadedWeeks() {
  const files = await readdir(parsedDir);
  const parsedUploads = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const parsed = JSON.parse(await readFile(path.join(parsedDir, file), "utf-8")) as ParsedUpload;
        const existing = await uploadRepository.getByWeek(parsed.week);
        if (!existing) {
          await uploadRepository.save({
            id: parsed.week,
            weekKey: parsed.week,
            fileName: parsed.fileName,
            uploadedAt: parsed.uploadedAt,
            uploadedBy: "admin",
            totalRows: parsed.orders.length + parsed.issues.length,
            validRows: parsed.orders.length,
            invalidRows: parsed.issues.length,
            detectedSheets: [parsed.sheetName].filter(Boolean),
            status: "parsed",
            fileSignature: `${parsed.fileName}:${parsed.orders.length}:${parsed.uploadedAt}`
          });
        }
        return {
          week: parsed.week,
          weekKey: parsed.week,
          fileName: parsed.fileName,
          uploadedAt: parsed.uploadedAt,
          orderCount: parsed.orders.length,
          completedTotal: parsed.orders.reduce((sum, order) => sum + order.completedCount, 0),
          issueCount: parsed.issues.length,
          status: existing?.status ?? "parsed",
          deletionCandidate: false
        };
      })
  );
  const candidates = await uploadRepository.markDeletionCandidates(8);
  const candidateWeeks = new Set(candidates.filter((item) => item.deletionCandidate).map((item) => item.weekKey));
  return parsedUploads
    .map((upload) => ({
      ...upload,
      deletionCandidate: candidateWeeks.has(upload.weekKey),
      analysisScope: candidateWeeks.has(upload.weekKey) ? "archive_candidate" : "active"
    }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function receiveUploadPreview(file: Express.Multer.File | undefined, week: string) {
  if (!file) throw new Error("엑셀 파일이 필요합니다.");
  const normalizedWeek = week.trim();
  if (!normalizedWeek) throw new Error("weekKey is required.");
  try {
    return await parseWorkbook(file.path, normalizedWeek, decodeFileName(file.originalname));
  } finally {
    await unlink(file.path).catch(() => undefined);
  }
}

export async function saveUploadedExcel(file: Express.Multer.File | undefined, week: string) {
  if (!file) throw new Error("엑셀 파일이 필요합니다.");
  const normalizedWeek = week.trim();
  if (!normalizedWeek) {
    await unlink(file.path).catch(() => undefined);
    throw new Error("weekKey is required.");
  }
  const uploads = await getUploadedWeeks();
  if (uploads.some((upload) => upload.week === normalizedWeek || upload.weekKey === normalizedWeek)) {
    await unlink(file.path).catch(() => undefined);
    throw new Error(`${normalizedWeek} 데이터가 이미 업로드되어 있습니다.`);
  }
  try {
    const fileName = decodeFileName(file.originalname);
    const preview = await parseWorkbook(file.path, normalizedWeek, fileName);
    if (preview.missingColumns.length) {
      throw new Error(`필수 컬럼 누락: ${preview.missingColumns.join(", ")}`);
    }

    const workbook = XLSX.readFile(file.path, { cellDates: true });
    const { rows } = rowsFromSheet(workbook.Sheets[preview.sheetName]);
    const issues: ValidationIssue[] = [];
    const orders = rows
      .map((row, index) => rowToOrder(row, week, index, issues))
      .filter((order): order is OrderRecord => Boolean(order));

    const parsed: ParsedUpload = {
      week: normalizedWeek,
      fileName,
      uploadedAt: new Date().toISOString(),
      sheetName: preview.sheetName,
      columns: preview.columns,
      missingColumns: [],
      orders,
      issues
    };

    await writeFile(parsedPathForWeek(normalizedWeek), JSON.stringify(parsed, null, 2), "utf-8");
    await uploadRepository.save({
      id: normalizedWeek,
      weekKey: normalizedWeek,
      fileName,
      uploadedAt: parsed.uploadedAt,
      uploadedBy: "admin",
      totalRows: orders.length + issues.length,
      validRows: orders.length,
      invalidRows: issues.length,
      detectedSheets: [preview.sheetName],
      status: "parsed",
      fileSignature: `${fileName}:${orders.length}:${parsed.uploadedAt}`
    });
    await analysisRepository.invalidateWeek(normalizedWeek);
    await analysisRepository.invalidateWeek("all");
    await riderRepository.clear();
    return parsed;
  } finally {
    await unlink(file.path).catch(() => undefined);
  }
}

export async function loadParsedOrders() {
  const files = await readdir(parsedDir);
  const uploads = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(path.join(parsedDir, file), "utf-8")) as ParsedUpload)
  );
  return uploads.flatMap((upload) => upload.orders);
}

export async function getValidationSummary() {
  const files = await readdir(parsedDir);
  const uploads = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(path.join(parsedDir, file), "utf-8")) as ParsedUpload)
  );
  const issues = uploads.flatMap((upload) => upload.issues.map((issue) => ({ ...issue, week: upload.week })));
  const riderCandidates = Object.values(
    uploads
      .flatMap((upload) =>
        upload.orders
          .filter((order) => !matchRiderByName(order.riderName, riderData))
          .map((order) => ({
            week: upload.week,
            riderName: order.riderName,
            baseName: order.baseName,
            completedCount: order.completedCount
          }))
      )
      .reduce<Record<string, { week: string; riderName: string; baseName: string; completedTotal: number; rowCount: number }>>(
        (acc, item) => {
          const key = `${item.week}::${item.baseName || item.riderName}`;
          const current = acc[key] ?? {
            week: item.week,
            riderName: item.riderName,
            baseName: item.baseName,
            completedTotal: 0,
            rowCount: 0
          };
          current.completedTotal += item.completedCount;
          current.rowCount += 1;
          acc[key] = current;
          return acc;
        },
        {}
      )
  )
    .map((candidate) => ({
      ...candidate,
      status: candidate.rowCount > candidate.completedTotal ? "NAME_REVIEW_RECOMMENDED" : "AUTO_ANALYSIS_TARGET",
      description: "업로드 데이터에서 발견되어 자동 분석에 포함됩니다."
    }))
    .sort((a, b) => b.completedTotal - a.completedTotal);

  return {
    uploads: uploads.map((upload) => ({
      week: upload.week,
      fileName: upload.fileName,
      sheetName: upload.sheetName,
      columns: upload.columns,
      missingColumns: upload.missingColumns,
      orderCount: upload.orders.length,
      completedTotal: upload.orders.reduce((sum, order) => sum + order.completedCount, 0),
      issueCount: upload.issues.length
    })),
    issues,
    riderCandidates,
    counts: {
      unmatched: riderCandidates.length,
      emptyValues: issues.filter((issue) => issue.type === "missing_value").length,
      typeErrors: issues.filter((issue) => issue.type === "invalid_delivery_type").length,
      segmentErrors: issues.filter((issue) => issue.type === "invalid_time_segment").length,
      outliers: issues.filter((issue) => issue.type === "outlier").length
    }
  };
}
