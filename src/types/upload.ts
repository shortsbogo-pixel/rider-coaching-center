export type UploadStatus = "uploaded" | "parsed" | "failed" | "replaced";

export interface UploadHistory {
  id: string;
  weekKey: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  detectedSheets: string[];
  status: UploadStatus;
  fileSignature?: string;
  memo?: string;
  deletionCandidate?: boolean;
}
