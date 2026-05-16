import { useEffect, useState } from "react";
import { RiskBadge } from "../components/admin/RiskBadge";
import { SectionHeader } from "../components/common/SectionHeader";
import { requiredOrderColumns } from "../utils/excelParser";

interface ValidationIssue {
  rowNumber: number;
  week: string;
  type: string;
  message: string;
}

interface ValidationUpload {
  week: string;
  fileName: string;
  sheetName: string;
  columns: string[];
  missingColumns: string[];
  orderCount: number;
  completedTotal: number;
  issueCount: number;
}

interface RiderCandidate {
  week: string;
  riderName: string;
  baseName: string;
  completedTotal: number;
  rowCount: number;
  status: "AUTO_ANALYSIS_TARGET" | "MATCHED_EXISTING" | "NAME_REVIEW_RECOMMENDED";
  description: string;
}

interface ValidationSummary {
  uploads: ValidationUpload[];
  issues: ValidationIssue[];
  riderCandidates: RiderCandidate[];
  counts: {
    unmatched: number;
    emptyValues: number;
    typeErrors: number;
    segmentErrors: number;
    outliers: number;
  };
}

const emptySummary: ValidationSummary = {
  uploads: [],
  issues: [],
  riderCandidates: [],
  counts: {
    unmatched: 0,
    emptyValues: 0,
    typeErrors: 0,
    segmentErrors: 0,
    outliers: 0
  }
};

export function DataValidationPage() {
  const [summary, setSummary] = useState<ValidationSummary>(emptySummary);

  useEffect(() => {
    fetch("/api/uploads/validation")
      .then((response) => response.json())
      .then((data) => setSummary(data as ValidationSummary))
      .catch(() => setSummary(emptySummary));
  }, []);

  const hasUploads = summary.uploads.length > 0;

  return (
    <div className="page-stack">
      <SectionHeader title="데이터 검수" description="업로드된 Excel 데이터의 컬럼, 매칭, 이상치를 확인합니다." />

      <section className="panel">
        <h3>컬럼 매핑 상태</h3>
        {hasUploads ? (
          <div className="mapping-grid">
            {summary.uploads.flatMap((upload) =>
              requiredOrderColumns.map((column) => {
                const missing = upload.missingColumns.includes(column);
                return (
                  <div className="mapping-card" key={`${upload.week}-${column}`}>
                    <strong>{column}</strong>
                    <span>{upload.week}</span>
                    <RiskBadge level={missing ? "관리주의" : "안정"} />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p>아직 업로드된 Excel 데이터가 없습니다. 업로드 화면에서 파일을 저장하면 검수 결과가 표시됩니다.</p>
        )}
      </section>

      <section className="panel">
        <h3>검수 요약</h3>
        <div className="validation-grid">
          <div><strong>{summary.counts.unmatched}</strong><span>미매칭 라이더</span></div>
          <div><strong>{summary.counts.emptyValues}</strong><span>빈값/누락값</span></div>
          <div><strong>{summary.counts.typeErrors}</strong><span>배달타입 오류</span></div>
          <div><strong>{summary.counts.segmentErrors}</strong><span>시간대 오류</span></div>
        </div>
      </section>

      <section className="panel">
        <h3>업로드 파일</h3>
        <div className="rider-list">
          {summary.uploads.map((upload) => (
            <article className="list-card" key={upload.week}>
              <div>
                <strong>{upload.week}</strong>
                <span>{upload.fileName} · {upload.sheetName}</span>
              </div>
              <div className="list-card-right">
                <b>{upload.completedTotal ?? upload.orderCount}건</b>
                <span>이슈 {upload.issueCount}건</span>
              </div>
            </article>
          ))}
          {!hasUploads ? <p>저장된 업로드 파일이 없습니다.</p> : null}
        </div>
      </section>

      {summary.riderCandidates.length ? (
        <section className="panel">
          <h3>신규 라이더 후보</h3>
          <div className="rider-list">
            {summary.riderCandidates.slice(0, 30).map((candidate) => (
              <article className="list-card" key={candidate.baseName || candidate.riderName}>
                <div>
                  <strong>{candidate.baseName || candidate.riderName}</strong>
                  <span>{candidate.description} · 대표 표기: {candidate.riderName}</span>
                </div>
                <div className="list-card-right">
                  <b>{candidate.completedTotal}건</b>
                  <span>{candidate.status === "NAME_REVIEW_RECOMMENDED" ? "확인 권장" : "자동 분석 대상"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {summary.issues.length ? (
        <section className="panel">
          <h3>이상치 및 오류 목록</h3>
          <div className="issue-list">
            {summary.issues.slice(0, 30).map((issue) => (
              <p key={`${issue.week}-${issue.rowNumber}-${issue.message}`}>
                {issue.week} · 행 {issue.rowNumber}: {issue.message}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
