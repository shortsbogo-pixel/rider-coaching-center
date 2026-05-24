import { AlertCircle, ArrowRight, CheckCircle2, FileSearch, ShieldAlert, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { requiredOrderColumns } from "../utils/excelParser";
import { getLatestWeekKey, sortWeekKeys } from "../utils/weekSelector";

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

const issueLabels: Record<string, string> = {
  missing_value: "빈값/누락",
  invalid_delivery_type: "배달타입 오류",
  invalid_time_segment: "시간대 오류",
  outlier: "이상치"
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function candidateStatusLabel(status: RiderCandidate["status"]) {
  if (status === "MATCHED_EXISTING") return "기존 라이더 매칭";
  if (status === "NAME_REVIEW_RECOMMENDED") return "이름 확인 권장";
  return "자동 분석 대상";
}

function candidateStatusTone(status: RiderCandidate["status"]) {
  if (status === "NAME_REVIEW_RECOMMENDED") return "warning";
  if (status === "MATCHED_EXISTING") return "good";
  return "default";
}

function uploadStatus(upload?: ValidationUpload) {
  if (!upload) {
    return { label: "데이터 없음", tone: "warning" as const };
  }
  if (upload.missingColumns.length) {
    return { label: "필수 컬럼 확인", tone: "danger" as const };
  }
  if (upload.issueCount > 0) {
    return { label: "확인 필요", tone: "warning" as const };
  }
  return { label: "정상", tone: "good" as const };
}

function countIssues(issues: ValidationIssue[]) {
  return {
    emptyValues: issues.filter((issue) => issue.type === "missing_value").length,
    typeErrors: issues.filter((issue) => issue.type === "invalid_delivery_type").length,
    segmentErrors: issues.filter((issue) => issue.type === "invalid_time_segment").length,
    outliers: issues.filter((issue) => issue.type === "outlier").length
  };
}

export function DataValidationPage() {
  const [summary, setSummary] = useState<ValidationSummary>(emptySummary);
  const [activeWeek, setActiveWeek] = useState("");

  useEffect(() => {
    fetch("/api/uploads/validation")
      .then((response) => response.json())
      .then((data) => {
        const nextSummary = data as ValidationSummary;
        setSummary(nextSummary);
        setActiveWeek((current) => current || getLatestWeekKey(nextSummary.uploads.map((upload) => upload.week)));
      })
      .catch(() => setSummary(emptySummary));
  }, []);

  const weekOptions = useMemo(() => sortWeekKeys(summary.uploads.map((upload) => upload.week)), [summary.uploads]);
  const hasUploads = summary.uploads.length > 0;
  const selectedWeek = activeWeek || weekOptions[0] || "";
  const activeUploads = selectedWeek ? summary.uploads.filter((upload) => upload.week === selectedWeek) : [];
  const activeUpload = activeUploads[0];
  const activeIssues = selectedWeek ? summary.issues.filter((issue) => issue.week === selectedWeek) : summary.issues;
  const activeCandidates = selectedWeek ? summary.riderCandidates.filter((candidate) => candidate.week === selectedWeek) : summary.riderCandidates;
  const activeCounts = countIssues(activeIssues);
  const totalCompleted = activeUploads.reduce((sum, upload) => sum + upload.completedTotal, 0);
  const totalRows = activeUploads.reduce((sum, upload) => sum + upload.orderCount, 0);
  const missingColumnCount = activeUploads.reduce((sum, upload) => sum + upload.missingColumns.length, 0);
  const status = uploadStatus(activeUpload);

  return (
    <div className="page-stack">
      <SectionHeader title="데이터 검수" description="업로드된 Excel 데이터를 주차별로 확인하고, 코칭 생성 전에 확인할 항목을 정리합니다." />

      <section className="panel validation-toolbar">
        <div className="analysis-title">
          <div>
            <p className="eyebrow">검수 기준</p>
            <h3>{selectedWeek || "업로드 대기"}</h3>
            <p>{hasUploads ? "최신 업로드 주차를 기본으로 표시합니다." : "먼저 엑셀 파일을 업로드하세요."}</p>
          </div>
          <span className={`status-pill ${status.tone}`}>{status.label}</span>
        </div>

        <label className="field validation-week-field">
          <span>주차 선택</span>
          <select value={selectedWeek} onChange={(event) => setActiveWeek(event.target.value)} disabled={!hasUploads}>
            {weekOptions.map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>
        </label>

        {activeUpload ? (
          <div className="validation-status-line">
            <span>{activeUpload.fileName}</span>
            <span>{activeUpload.sheetName}</span>
            <span>총 {formatNumber(totalRows)}행</span>
          </div>
        ) : null}
      </section>

      <div className="metric-grid">
        <MetricCard label="정상 완료건수" value={`${formatNumber(totalCompleted)}건`} caption={selectedWeek || "주차 없음"} tone="good" />
        <MetricCard label="확인 필요" value={`${formatNumber(activeIssues.length)}건`} caption={`이상치 ${formatNumber(activeCounts.outliers)}건`} tone={activeIssues.length ? "warning" : "default"} />
        <MetricCard label="신규 후보" value={`${formatNumber(activeCandidates.length)}명`} caption="자동 분석 대상 포함" tone={activeCandidates.length ? "warning" : "default"} />
        <MetricCard label="필수 컬럼 누락" value={`${formatNumber(missingColumnCount)}개`} caption="매핑 기준" tone={missingColumnCount ? "danger" : "good"} />
      </div>

      <section className="panel validation-action-panel">
        <div className="analysis-title">
          <div>
            <h3>다음 조치</h3>
            <p>검수 결과가 정상이라면 미션 확인과 코칭 생성으로 이어가세요.</p>
          </div>
          <FileSearch size={22} aria-hidden="true" />
        </div>
        <div className="button-row data-button-row">
          <a className="secondary-link-button icon-button" href="/upload">
            업로드 화면 <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a className="secondary-link-button icon-button" href="/missions">
            미션 확인 <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a className="secondary-link-button icon-button" href={`/coaching?weekKey=${encodeURIComponent(selectedWeek)}`}>
            코칭 생성 <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="panel">
        <h3>필수 컬럼 매핑</h3>
        {hasUploads ? (
          <div className="mapping-grid">
            {activeUploads.flatMap((upload) =>
              requiredOrderColumns.map((column) => {
                const missing = upload.missingColumns.includes(column);
                return (
                  <div className={`mapping-card ${missing ? "warning" : "good"}`} key={`${upload.week}-${column}`}>
                    <strong>{column}</strong>
                    <span>{upload.week}</span>
                    <span className={`status-pill ${missing ? "warning" : "good"}`}>{missing ? "확인 필요" : "정상"}</span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p className="empty-state">아직 업로드된 Excel 데이터가 없습니다.</p>
        )}
      </section>

      <section className="panel">
        <h3>검수 요약</h3>
        <div className="validation-grid">
          <div>
            <strong>{formatNumber(activeCandidates.length)}</strong>
            <span>신규/미매칭 라이더</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.emptyValues)}</strong>
            <span>빈값/누락값</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.typeErrors)}</strong>
            <span>배달타입 오류</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.segmentErrors)}</strong>
            <span>시간대 오류</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>업로드 파일</h3>
        <div className="rider-list">
          {activeUploads.map((upload) => (
            <article className="list-card" key={upload.week}>
              <div>
                <strong>{upload.week}</strong>
                <span>{upload.fileName} · {upload.sheetName}</span>
              </div>
              <div className="list-card-right">
                <b>{formatNumber(upload.completedTotal ?? upload.orderCount)}건</b>
                <span>이슈 {formatNumber(upload.issueCount)}건</span>
              </div>
            </article>
          ))}
          {!hasUploads ? <p className="empty-state">저장된 업로드 파일이 없습니다.</p> : null}
        </div>
      </section>

      {activeCandidates.length ? (
        <section className="panel">
          <div className="analysis-title">
            <h3>신규 라이더 후보</h3>
            <UsersRound size={22} aria-hidden="true" />
          </div>
          <div className="rider-list">
            {activeCandidates.slice(0, 30).map((candidate) => (
              <article className="list-card" key={`${candidate.week}-${candidate.baseName || candidate.riderName}`}>
                <div>
                  <strong>{candidate.baseName || candidate.riderName}</strong>
                  <span>{candidate.description} · 표시명: {candidate.riderName}</span>
                </div>
                <div className="list-card-right">
                  <b>{formatNumber(candidate.completedTotal)}건</b>
                  <span className={`status-pill ${candidateStatusTone(candidate.status)}`}>{candidateStatusLabel(candidate.status)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeIssues.length ? (
        <section className="panel">
          <div className="analysis-title">
            <h3>이상치 및 오류 목록</h3>
            <ShieldAlert size={22} aria-hidden="true" />
          </div>
          <div className="issue-list">
            {activeIssues.slice(0, 30).map((issue) => (
              <article className="issue-card" key={`${issue.week}-${issue.rowNumber}-${issue.message}`}>
                <span className="status-pill warning">{issueLabels[issue.type] ?? issue.type}</span>
                <p>
                  {issue.week} · {issue.rowNumber}행: {issue.message}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        hasUploads ? (
          <section className="panel notice-panel">
            <div className="analysis-title">
              <div>
                <h3>확인 필요 항목 없음</h3>
                <p>{selectedWeek} 기준으로 표시할 오류 항목이 없습니다.</p>
              </div>
              <CheckCircle2 size={22} aria-hidden="true" />
            </div>
          </section>
        ) : null
      )}

      {activeIssues.length > 30 || activeCandidates.length > 30 ? (
        <section className="panel notice-panel">
          <div className="analysis-title">
            <div>
              <h3>일부 항목만 표시 중</h3>
              <p>목록은 화면 확인용으로 상위 30개까지만 표시합니다. 전체 데이터는 업로드 원본과 parsed 데이터 기준으로 유지됩니다.</p>
            </div>
            <AlertCircle size={22} aria-hidden="true" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
