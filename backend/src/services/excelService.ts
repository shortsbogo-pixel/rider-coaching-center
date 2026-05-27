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
const deliveryTypes: DeliveryType[] = ["단건배달", "멀티배달1", "멀티배달2", "멀티배달3", "멀티배달4", "확인필요"];
const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"] as const;

type RawRow = Record<string, unknown> & { __rowNumber?: number };

const columnAliases: Record<string, string[]> = {
  "성함 또는 이름": [
    "성함 또는 이름",
    "성함",
    "라이더명",
    "라이더",
    "기사명",
    "기사",
    "배달파트너명",
    "배달파트너",
    "파트너명",
    "이름",
    "수행자",
    "배달원명",
    "배달원",
    "riderName",
    "rider_name",
    "driverName",
    "driver_name",
    "courierName",
    "courier_name"
  ],
  픽업지역: ["픽업지역", "픽업 주소", "픽업지"],
  배달지역: ["배달지역", "배달 주소", "도착지", "전달지역"],
  수락시간: ["수락시간", "배달수락일시"],
  배달시간: ["배달시간", "전달시간", "완료시간"],
  배달소요시간: ["배달소요시간", "배달소요시간(시:분)", "소요시간"],
  "해당 구간타임": ["해당 구간타임", "피크타임", "구간타임"],
  배달타입: ["배달타입", "배달 유형"],
  완료건수: [
    "완료건수",
    "수행건수",
    "배달완료",
    "완료 수",
    "완료수",
    "주문수",
    "처리건수",
    "건수",
    "completed",
    "completedCount",
    "complete_count",
    "deliveryCount",
    "delivery_count",
    "완료",
    "총 정산 오더수"
  ]
};

const riderIdentifierAliases = [
  "전화번호",
  "휴대폰",
  "연락처",
  "파트너ID",
  "기사ID",
  "라이더ID",
  "riderId",
  "rider_id",
  "driverId",
  "driver_id",
  "courierId",
  "courier_id"
];

export interface ParsedUpload {
  week: string;
  fileName: string;
  uploadedAt: string;
  sheetName: string;
  columns: string[];
  missingColumns: string[];
  orders: OrderRecord[];
  issues: ValidationIssue[];
  summary?: UploadParseSummary;
}

export interface ValidationIssue {
  rowNumber: number;
  type:
    | "missing_value"
    | "missing_rider_name_column"
    | "missing_rider_name"
    | "invalid_completed_count"
    | "invalid_delivery_type"
    | "invalid_time_segment"
    | "outlier";
  message: string;
  rawValue?: string;
}

export interface UploadParseSummary {
  totalRows: number;
  parsedRows: number;
  riderNameDetectedRows: number;
  riderNameMissingRows: number;
  deliveryTypeParsedRows: number;
  deliveryTypeReviewRows: number;
  numberConversionWarningRows: number;
  duplicateRiderCount: number;
  warningRows: number;
  analysisTargetRiderCount: number;
  issueCount: number;
  displayedIssueCount: number;
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
  summary: UploadParseSummary;
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

function asOptionalRate(value: unknown): number | undefined {
  const raw = asString(value)
    .replace(/,/g, "")
    .replace(/[％%]/g, "%")
    .replace(/\s+/g, "")
    .trim();
  if (!raw || raw === "-") return undefined;

  const percentValue = raw.endsWith("%") ? Number(raw.slice(0, -1)) : Number(raw);
  if (!Number.isFinite(percentValue)) return undefined;

  if (Math.abs(percentValue) > 1) {
    return percentValue / 100;
  }

  return percentValue;
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

function normalizeColumnName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function resolveHeader(row: RawRow, candidates: string[]): string | undefined {
  const normalizedCandidates = candidates.map(normalizeColumnName);
  const keys = Object.keys(row).map((key) => key.trim());
  return keys.find((key) => normalizedCandidates.includes(normalizeColumnName(key)));
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
  const normalizedColumns = columns.map(normalizeColumnName);
  const missing = requiredOrderColumns.filter((column) => {
    if (column === "완료건수") return false;
    const aliases = columnAliases[column] ?? [column];
    return !aliases.some((alias) => normalizedColumns.includes(normalizeColumnName(alias)));
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
      return sum + (aliases.some((alias) => headers.some((header) => normalizeColumnName(header) === normalizeColumnName(alias))) ? 1 : 0);
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

export interface NormalizedDeliveryType {
  deliveryType: DeliveryType;
  needsReview: boolean;
  rawValue: string;
}

export function normalizeDeliveryType(value: unknown): NormalizedDeliveryType {
  const rawValue = asString(value);
  const compact = rawValue.replace(/[\s_-]/g, "").toUpperCase();

  if (!compact || ["-", "N/A", "NA", "없음", "NULL", "UNDEFINED"].includes(compact)) {
    return { deliveryType: "확인필요", needsReview: true, rawValue };
  }

  if (["단건", "단건배달", "단일", "SINGLE", "1건", "일반", "일반배달"].includes(compact)) {
    return { deliveryType: "단건배달", needsReview: false, rawValue };
  }

  if (compact === "멀티" || compact === "멀티배달" || compact === "MULTI") {
    return { deliveryType: "멀티배달1", needsReview: false, rawValue };
  }

  const multiMatch = compact.match(/^(?:멀티배달|멀티|M|MULTI)([1-4])$/);
  if (multiMatch?.[1]) {
    return { deliveryType: `멀티배달${multiMatch[1]}` as DeliveryType, needsReview: false, rawValue };
  }

  if (/^[2-4]$/.test(compact)) {
    return { deliveryType: `멀티배달${compact}` as DeliveryType, needsReview: false, rawValue };
  }

  const exact = deliveryTypes.find((type) => type !== "확인필요" && normalizeColumnName(type) === normalizeColumnName(rawValue));
  if (exact) {
    return { deliveryType: exact, needsReview: false, rawValue };
  }

  return { deliveryType: "확인필요", needsReview: true, rawValue };
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

function formatRawValue(value: string) {
  return value.trim() ? value : "빈 값";
}

interface RowParseContext {
  unknownRiderCount: number;
}

function maskIdentifier(rawValue: string) {
  const compact = rawValue.replace(/\s/g, "");
  if (!compact) return "";
  const suffix = compact.slice(-4);
  return `식별 라이더 ****${suffix}`;
}

function resolveRiderName(row: RawRow, rowNumber: number, issues: ValidationIssue[], context: RowParseContext) {
  const riderName = asString(getCell(row, columnAliases["성함 또는 이름"]));
  if (riderName) {
    return { riderName, isFallback: false };
  }

  const identifier = asString(getCell(row, riderIdentifierAliases));
  if (identifier) {
    const fallbackName = maskIdentifier(identifier);
    issues.push({
      rowNumber,
      type: "missing_rider_name",
      rawValue: identifier,
      message: `라이더명 누락으로 ${fallbackName}로 임시 표시했습니다.`
    });
    return { riderName: fallbackName, isFallback: true };
  }

  context.unknownRiderCount += 1;
  const fallbackName = `미확인 라이더 #${context.unknownRiderCount}`;
  issues.push({
    rowNumber,
    type: "missing_rider_name",
    rawValue: "",
    message: `라이더명 누락으로 ${fallbackName}로 임시 표시했습니다.`
  });
  return { riderName: fallbackName, isFallback: true };
}

function parseCompletedCount(value: unknown, rowNumber: number, issues: ValidationIssue[]) {
  const raw = asString(value);
  if (!raw || raw === "-") return 1;
  const normalized = raw.replace(/,/g, "");
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;

  issues.push({
    rowNumber,
    type: "invalid_completed_count",
    rawValue: raw,
    message: `완료건수 숫자 변환 확인필요: 원본값 "${formatRawValue(raw)}"을 1건으로 처리했습니다.`
  });
  return 1;
}

function rowToOrder(row: RawRow, week: string, index: number, issues: ValidationIssue[], context: RowParseContext): OrderRecord | undefined {
  const pickupArea = asString(getCell(row, columnAliases["픽업지역"]));
  const deliveryArea = asString(getCell(row, columnAliases["배달지역"]));
  const acceptedAtRaw = getCell(row, columnAliases["수락시간"]);
  const deliveredAtRaw = getCell(row, columnAliases["배달시간"]);
  const deliveryMinutes = asDurationMinutes(getCell(row, columnAliases["배달소요시간"]));
  const timeSegment = normalizeTimeSegment(getCell(row, columnAliases["해당 구간타임"]));
  const deliveryType = normalizeDeliveryType(getCell(row, columnAliases["배달타입"]));
  const rowNumber = row.__rowNumber ?? index + 2;

  if (!pickupArea && !deliveryArea && !acceptedAtRaw && !deliveredAtRaw) return undefined;

  const { riderName } = resolveRiderName(row, rowNumber, issues, context);
  const completedCount = parseCompletedCount(getCell(row, columnAliases["완료건수"]), rowNumber, issues);

  if (!pickupArea || !deliveryArea) {
    issues.push({ rowNumber, type: "missing_value", message: "이름, 픽업지역, 배달지역 중 빈값이 있습니다." });
  }

  if (!timeSegment) {
    issues.push({ rowNumber, type: "invalid_time_segment", message: "해당 구간타임을 Breakfast/Lunch_Peak/Post_Lunch/Dinner_Peak/Post_Dinner 중 하나로 해석할 수 없습니다." });
  }

  if (deliveryType.needsReview) {
    issues.push({
      rowNumber,
      type: "invalid_delivery_type",
      rawValue: deliveryType.rawValue,
      message: `배달타입 확인필요: 원본값 "${formatRawValue(deliveryType.rawValue)}"을 단건/멀티 기준으로 해석하지 못했습니다.`
    });
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
    deliveryType: deliveryType.deliveryType,
    completedCount,
    weekday: getWeekday(acceptedAtRaw),
    rejectionRate: asOptionalRate(getCell(row, ["거절율", "거절률"])),
    ignoredRate: asOptionalRate(getCell(row, ["무시율", "무시률"]))
  };
}

function buildColumnIssues(missingColumns: string[]): ValidationIssue[] {
  if (!missingColumns.includes("성함 또는 이름")) return [];
  return [
    {
      rowNumber: 0,
      type: "missing_rider_name_column",
      message: "라이더명 컬럼을 찾지 못했습니다. 엑셀의 컬럼명을 확인해주세요."
    }
  ];
}

function buildParseSummary(rows: RawRow[], orders: OrderRecord[], issues: ValidationIssue[]): UploadParseSummary {
  const warningRowNumbers = new Set(issues.map((issue) => issue.rowNumber).filter((rowNumber) => rowNumber > 0));
  const riderNameMissingRows = new Set(issues.filter((issue) => issue.type === "missing_rider_name").map((issue) => issue.rowNumber));
  const numberConversionWarningRows = new Set(issues.filter((issue) => issue.type === "invalid_completed_count").map((issue) => issue.rowNumber));
  const baseNameGroups = orders.reduce<Record<string, Set<string>>>((acc, order) => {
    const key = order.baseName || order.riderName;
    if (!key) return acc;
    acc[key] = acc[key] ?? new Set<string>();
    acc[key].add(order.riderName);
    return acc;
  }, {});
  const analysisTargetRiderKeys = new Set(orders.map((order) => order.baseName || order.riderName).filter(Boolean));

  return {
    totalRows: rows.length,
    parsedRows: orders.length,
    riderNameDetectedRows: Math.max(orders.length - riderNameMissingRows.size, 0),
    riderNameMissingRows: riderNameMissingRows.size,
    deliveryTypeParsedRows: orders.filter((order) => order.deliveryType !== "확인필요").length,
    deliveryTypeReviewRows: orders.filter((order) => order.deliveryType === "확인필요").length,
    numberConversionWarningRows: numberConversionWarningRows.size,
    duplicateRiderCount: Object.values(baseNameGroups).filter((names) => names.size > 1).length,
    warningRows: warningRowNumbers.size,
    analysisTargetRiderCount: analysisTargetRiderKeys.size,
    issueCount: issues.length,
    displayedIssueCount: Math.min(issues.length, 30)
  };
}

function normalizeUploadSummary(summary: UploadParseSummary | undefined, upload: ParsedUpload): UploadParseSummary {
  const warningRowNumbers = new Set(upload.issues.map((issue) => issue.rowNumber).filter((rowNumber) => rowNumber > 0));
  const riderNameMissingRows = new Set(upload.issues.filter((issue) => issue.type === "missing_rider_name").map((issue) => issue.rowNumber));
  const numberConversionWarningRows = new Set(upload.issues.filter((issue) => issue.type === "invalid_completed_count").map((issue) => issue.rowNumber));

  return {
    totalRows: summary?.totalRows ?? upload.orders.length + warningRowNumbers.size,
    parsedRows: summary?.parsedRows ?? upload.orders.length,
    riderNameDetectedRows: summary?.riderNameDetectedRows ?? Math.max(upload.orders.length - riderNameMissingRows.size, 0),
    riderNameMissingRows: summary?.riderNameMissingRows ?? riderNameMissingRows.size,
    deliveryTypeParsedRows: summary?.deliveryTypeParsedRows ?? upload.orders.filter((order) => order.deliveryType !== "확인필요").length,
    deliveryTypeReviewRows: summary?.deliveryTypeReviewRows ?? upload.orders.filter((order) => order.deliveryType === "확인필요").length,
    numberConversionWarningRows: summary?.numberConversionWarningRows ?? numberConversionWarningRows.size,
    duplicateRiderCount: summary?.duplicateRiderCount ?? 0,
    warningRows: summary?.warningRows ?? warningRowNumbers.size,
    analysisTargetRiderCount: summary?.analysisTargetRiderCount ?? new Set(upload.orders.map((order) => order.baseName || order.riderName).filter(Boolean)).size,
    issueCount: summary?.issueCount ?? upload.issues.length,
    displayedIssueCount: summary?.displayedIssueCount ?? Math.min(upload.issues.length, 30)
  };
}

function getUploadSummary(upload: ParsedUpload): UploadParseSummary {
  if (upload.summary) return normalizeUploadSummary(upload.summary, upload);

  const warningRowNumbers = new Set(upload.issues.map((issue) => issue.rowNumber).filter((rowNumber) => rowNumber > 0));
  const riderNameMissingRows = new Set(upload.issues.filter((issue) => issue.type === "missing_rider_name").map((issue) => issue.rowNumber));
  const numberConversionWarningRows = new Set(upload.issues.filter((issue) => issue.type === "invalid_completed_count").map((issue) => issue.rowNumber));
  const baseNameGroups = upload.orders.reduce<Record<string, Set<string>>>((acc, order) => {
    const key = order.baseName || order.riderName;
    if (!key) return acc;
    acc[key] = acc[key] ?? new Set<string>();
    acc[key].add(order.riderName);
    return acc;
  }, {});
  const analysisTargetRiderKeys = new Set(upload.orders.map((order) => order.baseName || order.riderName).filter(Boolean));

  return {
    totalRows: upload.orders.length + warningRowNumbers.size,
    parsedRows: upload.orders.length,
    riderNameDetectedRows: Math.max(upload.orders.length - riderNameMissingRows.size, 0),
    riderNameMissingRows: riderNameMissingRows.size,
    deliveryTypeParsedRows: upload.orders.filter((order) => order.deliveryType !== "확인필요").length,
    deliveryTypeReviewRows: upload.orders.filter((order) => order.deliveryType === "확인필요").length,
    numberConversionWarningRows: numberConversionWarningRows.size,
    duplicateRiderCount: Object.values(baseNameGroups).filter((names) => names.size > 1).length,
    warningRows: warningRowNumbers.size,
    analysisTargetRiderCount: analysisTargetRiderKeys.size,
    issueCount: upload.issues.length,
    displayedIssueCount: Math.min(upload.issues.length, 30)
  };
}

async function parseWorkbook(filePath: string, week: string, fileName: string): Promise<UploadPreview> {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = findOrderSheet(workbook);

  if (!sheetName) {
    const issues: ValidationIssue[] = [{ rowNumber: 0, type: "missing_value", message: "오더별 상세내역서 시트를 찾을 수 없습니다." }];
    return {
      week,
      fileName,
      sheetName: "",
      status: "blocked",
      columns: [],
      missingColumns: requiredOrderColumns,
      previewRows: [],
      issues,
      summary: buildParseSummary([], [], issues)
    };
  }

  const { rows, columns } = rowsFromSheet(workbook.Sheets[sheetName]);
  const missingColumns = getMissingColumns(columns);
  const issues: ValidationIssue[] = [...buildColumnIssues(missingColumns)];
  const context: RowParseContext = { unknownRiderCount: 0 };
  const orders = rows
    .map((row, index) => rowToOrder(row, week, index, issues, context))
    .filter((order): order is OrderRecord => Boolean(order));
  const summary = buildParseSummary(rows, orders, issues);

  return {
    week,
    fileName,
    sheetName,
    status: missingColumns.length ? "blocked" : "ready",
    columns,
    missingColumns,
    previewRows: orders.slice(0, 10),
    issues: issues.slice(0, 30),
    summary
  };
}

export async function getUploadedWeeks() {
  const files = await readdir(parsedDir);
  const parsedUploads = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const parsed = JSON.parse(await readFile(path.join(parsedDir, file), "utf-8")) as ParsedUpload;
        const summary = getUploadSummary(parsed);
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
          deletionCandidate: false,
          summary
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
    const context: RowParseContext = { unknownRiderCount: 0 };
    const orders = rows
      .map((row, index) => rowToOrder(row, normalizedWeek, index, issues, context))
      .filter((order): order is OrderRecord => Boolean(order));
    const summary = buildParseSummary(rows, orders, issues);

    const parsed: ParsedUpload = {
      week: normalizedWeek,
      fileName,
      uploadedAt: new Date().toISOString(),
      sheetName: preview.sheetName,
      columns: preview.columns,
      missingColumns: [],
      orders,
      issues,
      summary
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
      issueCount: upload.issues.length,
      summary: getUploadSummary(upload)
    })),
    issues,
    riderCandidates,
    counts: {
      unmatched: riderCandidates.length,
      emptyValues: issues.filter((issue) => issue.type === "missing_value").length,
      nameColumnMissing: issues.filter((issue) => issue.type === "missing_rider_name_column").length,
      riderNameMissing: issues.filter((issue) => issue.type === "missing_rider_name").length,
      numberConversionWarnings: issues.filter((issue) => issue.type === "invalid_completed_count").length,
      typeErrors: issues.filter((issue) => issue.type === "invalid_delivery_type").length,
      segmentErrors: issues.filter((issue) => issue.type === "invalid_time_segment").length,
      outliers: issues.filter((issue) => issue.type === "outlier").length
    }
  };
}
