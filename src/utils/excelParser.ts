export interface UploadPreviewRow {
  rowNumber: number;
  values: Record<string, string | number | null>;
}

export interface UploadValidationResult {
  missingColumns: string[];
  previewRows: UploadPreviewRow[];
}

export const requiredOrderColumns = [
  "성함 또는 이름",
  "픽업지역",
  "배달지역",
  "수락시간",
  "배달시간",
  "배달소요시간",
  "해당 구간타임",
  "배달타입",
  "완료건수"
];

export function validateRequiredColumns(columns: string[]): string[] {
  return requiredOrderColumns.filter((column) => !columns.includes(column));
}
