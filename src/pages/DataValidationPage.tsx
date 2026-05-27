import { AlertCircle, ArrowRight, CheckCircle2, FileSearch, ShieldAlert, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { getAuthHeader } from "../utils/authStore";
import { requiredOrderColumns } from "../utils/excelParser";
import { groupValidationIssues } from "../utils/validationIssueGroups";
import { getLatestWeekKey, sortWeekKeys } from "../utils/weekSelector";

interface ValidationIssue {
  rowNumber: number;
  week: string;
  type: string;
  message: string;
  rawValue?: string;
  fileName?: string;
  errorType?: string;
}

interface UploadParseSummary {
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

interface ValidationUpload {
  week: string;
  fileName: string;
  sheetName: string;
  columns: string[];
  missingColumns: string[];
  orderCount: number;
  completedTotal: number;
  issueCount: number;
  summary?: UploadParseSummary;
}

interface ParsedStorageStatus {
  status: "ok" | "needs_reset";
  message: string;
  errorCount: number;
  errors: Array<{
    fileName: string;
    week?: string;
    errorType: string;
  }>;
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
  parsedStorage?: ParsedStorageStatus;
  riderCandidates: RiderCandidate[];
  counts: {
    unmatched: number;
    emptyValues: number;
    nameColumnMissing?: number;
    riderNameMissing?: number;
    numberConversionWarnings?: number;
    typeErrors: number;
    segmentErrors: number;
    outliers: number;
  };
}

const emptySummary: ValidationSummary = {
  uploads: [],
  issues: [],
  parsedStorage: {
    status: "ok",
    message: "parsed 데이터가 정상입니다.",
    errorCount: 0,
    errors: []
  },
  riderCandidates: [],
  counts: {
    unmatched: 0,
    emptyValues: 0,
    nameColumnMissing: 0,
    riderNameMissing: 0,
    numberConversionWarnings: 0,
    typeErrors: 0,
    segmentErrors: 0,
    outliers: 0
  }
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
    nameColumnMissing: issues.filter((issue) => issue.type === "missing_rider_name_column").length,
    riderNameMissing: issues.filter((issue) => issue.type === "missing_rider_name").length,
    numberConversionWarnings: issues.filter((issue) => issue.type === "invalid_completed_count").length,
    typeErrors: issues.filter((issue) => issue.type === "invalid_delivery_type").length,
    segmentErrors: issues.filter((issue) => issue.type === "invalid_time_segment").length,
    outliers: issues.filter((issue) => issue.type === "outlier").length
  };
}

function emptyParseSummary(): UploadParseSummary {
  return {
    totalRows: 0,
    parsedRows: 0,
    riderNameDetectedRows: 0,
    riderNameMissingRows: 0,
    deliveryTypeParsedRows: 0,
    deliveryTypeReviewRows: 0,
    numberConversionWarningRows: 0,
    duplicateRiderCount: 0,
    warningRows: 0,
    analysisTargetRiderCount: 0,
    issueCount: 0,
    displayedIssueCount: 0
  };
}

function sumUploadSummaries(uploads: ValidationUpload[]) {
  return uploads.reduce<UploadParseSummary>((acc, upload) => {
    const summary = upload.summary ?? {
      ...emptyParseSummary(),
      totalRows: upload.orderCount + upload.issueCount,
      parsedRows: upload.orderCount,
      riderNameDetectedRows: upload.orderCount,
      riderNameMissingRows: 0,
      deliveryTypeParsedRows: upload.orderCount,
      deliveryTypeReviewRows: 0,
      numberConversionWarningRows: 0,
      warningRows: upload.issueCount,
      issueCount: upload.issueCount,
      displayedIssueCount: Math.min(upload.issueCount, 30)
    };

    return {
      totalRows: acc.totalRows + summary.totalRows,
      parsedRows: acc.parsedRows + summary.parsedRows,
      riderNameDetectedRows: acc.riderNameDetectedRows + summary.riderNameDetectedRows,
      riderNameMissingRows: acc.riderNameMissingRows + (summary.riderNameMissingRows ?? 0),
      deliveryTypeParsedRows: acc.deliveryTypeParsedRows + (summary.deliveryTypeParsedRows ?? 0),
      deliveryTypeReviewRows: acc.deliveryTypeReviewRows + summary.deliveryTypeReviewRows,
      numberConversionWarningRows: acc.numberConversionWarningRows + (summary.numberConversionWarningRows ?? 0),
      duplicateRiderCount: acc.duplicateRiderCount + summary.duplicateRiderCount,
      warningRows: acc.warningRows + summary.warningRows,
      analysisTargetRiderCount: acc.analysisTargetRiderCount + summary.analysisTargetRiderCount,
      issueCount: acc.issueCount + summary.issueCount,
      displayedIssueCount: acc.displayedIssueCount + summary.displayedIssueCount
    };
  }, emptyParseSummary());
}

export function DataValidationPage() {
  const [summary, setSummary] = useState<ValidationSummary>(emptySummary);
  const [activeWeek, setActiveWeek] = useState("");
  const [isResettingParsed, setIsResettingParsed] = useState(false);
  const [parsedResetMessage, setParsedResetMessage] = useState("");

  async function loadValidationSummary() {
    return fetch("/api/uploads/validation")
      .then((response) => response.json())
      .then((data) => {
        const nextSummary = data as ValidationSummary;
        setSummary(nextSummary);
        setActiveWeek((current) => current || getLatestWeekKey(nextSummary.uploads.map((upload) => upload.week)));
      })
      .catch(() => setSummary(emptySummary));
  }

  useEffect(() => {
    void loadValidationSummary();
  }, []);

  async function handleResetParsedData() {
    const confirmed = window.confirm("기존 parsed 데이터만 초기화합니다. 원본 업로드 파일은 삭제하지 않습니다. 계속할까요?");
    if (!confirmed) return;

    setIsResettingParsed(true);
    setParsedResetMessage("");
    try {
      const response = await fetch("/api/uploads/parsed/reset", {
        method: "POST",
        headers: getAuthHeader()
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "parsed 데이터를 초기화하지 못했습니다.");
      setParsedResetMessage(result.message ?? "기존 parsed 데이터가 초기화되었습니다. 엑셀을 다시 업로드해주세요.");
      await loadValidationSummary();
      setActiveWeek("");
    } catch (error) {
      setParsedResetMessage(error instanceof Error ? error.message : "parsed 데이터를 초기화하지 못했습니다.");
    } finally {
      setIsResettingParsed(false);
    }
  }

  const weekOptions = useMemo(() => sortWeekKeys(summary.uploads.map((upload) => upload.week)), [summary.uploads]);
  const hasUploads = summary.uploads.length > 0;
  const selectedWeek = activeWeek || weekOptions[0] || "";
  const activeUploads = selectedWeek ? summary.uploads.filter((upload) => upload.week === selectedWeek) : [];
  const activeUpload = activeUploads[0];
  const activeIssues = selectedWeek ? summary.issues.filter((issue) => issue.week === selectedWeek) : summary.issues;
  const activeIssueGroups = groupValidationIssues(activeIssues);
  const activeCandidates = selectedWeek ? summary.riderCandidates.filter((candidate) => candidate.week === selectedWeek) : summary.riderCandidates;
  const activeCounts = countIssues(activeIssues);
  const totalCompleted = activeUploads.reduce((sum, upload) => sum + upload.completedTotal, 0);
  const uploadSummary = sumUploadSummaries(activeUploads);
  const totalRows = uploadSummary.totalRows || activeUploads.reduce((sum, upload) => sum + upload.orderCount, 0);
  const missingColumnCount = activeUploads.reduce((sum, upload) => sum + upload.missingColumns.length, 0);
  const status = uploadStatus(activeUpload);
  const parsedStorage = summary.parsedStorage ?? emptySummary.parsedStorage!;

  return (
    <div className="page-stack validation-page">
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

      <section className="panel validation-action-panel">
        <div className="analysis-title">
          <div>
            <p className="eyebrow">parsed 데이터 관리</p>
            <h3>{parsedStorage.errorCount ? `JSON 파싱 오류 ${formatNumber(parsedStorage.errorCount)}건 / 재파싱 필요` : "재업로드 안내"}</h3>
            <p>
              {parsedStorage.errorCount
                ? parsedStorage.message
                : "15차-1 파서 안정화 이후 기존 주차 데이터는 재업로드가 필요할 수 있습니다. 분석 결과가 어색하면 초기화 후 엑셀을 다시 업로드하세요."}
            </p>
          </div>
          <ShieldAlert size={22} aria-hidden="true" />
        </div>
        <div className="button-row data-button-row">
          <button className="secondary-link-button icon-button" type="button" onClick={handleResetParsedData} disabled={isResettingParsed}>
            기존 parsed 데이터 초기화
          </button>
          <a className="secondary-link-button icon-button" href="/upload">
            엑셀 재업로드 <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        {parsedResetMessage ? <p className="empty-state">{parsedResetMessage}</p> : null}
        {parsedStorage.errorCount ? (
          <details className="issue-card">
            <summary>
              <span className="status-pill warning">상세보기</span>
              <strong>상위 {formatNumber(parsedStorage.errors.length)}건</strong>
            </summary>
            <div className="issue-detail-list">
              {parsedStorage.errors.map((error) => (
                <p key={`${error.fileName}-${error.errorType}`}>
                  {error.week ?? "-"} · {error.fileName} · {error.errorType}
                </p>
              ))}
              {parsedStorage.errorCount > parsedStorage.errors.length ? (
                <p>상세 목록은 상위 {formatNumber(parsedStorage.errors.length)}개까지만 표시합니다.</p>
              ) : null}
            </div>
          </details>
        ) : null}
      </section>

      <div className="metric-grid">
        <MetricCard label="총 행 수" value={`${formatNumber(totalRows)}행`} caption={selectedWeek || "주차 없음"} />
        <MetricCard label="정상 파싱" value={`${formatNumber(uploadSummary.parsedRows)}행`} caption={`${formatNumber(totalCompleted)}건`} tone="good" />
        <MetricCard label="라이더명 인식" value={`${formatNumber(uploadSummary.riderNameDetectedRows)}행`} caption="실제 이름 기준" tone="good" />
        <MetricCard label="라이더명 누락" value={`${formatNumber(uploadSummary.riderNameMissingRows)}행`} caption="임시 표시명 부여" tone={uploadSummary.riderNameMissingRows ? "warning" : "default"} />
        <MetricCard label="배달타입 정상" value={`${formatNumber(uploadSummary.deliveryTypeParsedRows)}행`} caption="단건/멀티 인식" tone="good" />
        <MetricCard
          label="배달타입 확인필요"
          value={`${formatNumber(uploadSummary.deliveryTypeReviewRows)}행`}
          caption={`그룹 ${formatNumber(activeIssueGroups.length)}개`}
          tone={uploadSummary.deliveryTypeReviewRows ? "warning" : "default"}
        />
        <MetricCard label="숫자 변환 경고" value={`${formatNumber(uploadSummary.numberConversionWarningRows)}행`} caption="완료건수 확인" tone={uploadSummary.numberConversionWarningRows ? "warning" : "default"} />
        <MetricCard label="분석 대상" value={`${formatNumber(uploadSummary.analysisTargetRiderCount || activeCandidates.length)}명`} caption="실제 라이더 기준" tone="good" />
        <MetricCard label="중복 라이더" value={`${formatNumber(uploadSummary.duplicateRiderCount)}명`} caption="동일 baseName 변형" tone={uploadSummary.duplicateRiderCount ? "warning" : "default"} />
        <MetricCard label="필수 컬럼 누락" value={`${formatNumber(missingColumnCount)}개`} caption="매핑 기준" tone={missingColumnCount ? "danger" : "good"} />
      </div>

      <section className="panel validation-action-panel action-panel">
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

      <section className="panel mapping-panel">
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

      <section className="panel validation-summary-panel">
        <h3>업로드 결과 요약</h3>
        <div className="validation-grid">
          <div>
            <strong>{formatNumber(totalRows)}</strong>
            <span>총 행 수</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.parsedRows)}</strong>
            <span>정상 파싱 행</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.riderNameDetectedRows)}</strong>
            <span>라이더명 인식</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.riderNameMissingRows)}</strong>
            <span>라이더명 누락</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.deliveryTypeParsedRows)}</strong>
            <span>배달타입 정상 인식</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.deliveryTypeReviewRows)}</strong>
            <span>배달타입 확인필요</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.numberConversionWarningRows)}</strong>
            <span>숫자 변환 경고</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.duplicateRiderCount)}</strong>
            <span>중복 라이더</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.warningRows)}</strong>
            <span>제외/경고 행</span>
          </div>
          <div>
            <strong>{formatNumber(uploadSummary.analysisTargetRiderCount || activeCandidates.length)}</strong>
            <span>실제 분석 대상</span>
          </div>
        </div>
      </section>

      <section className="panel validation-summary-panel">
        <h3>검수 경고 카운트</h3>
        <div className="validation-grid">
          <div>
            <strong>{formatNumber(activeCandidates.length)}</strong>
            <span>신규/미매칭 라이더</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.nameColumnMissing)}</strong>
            <span>라이더명 컬럼 누락</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.riderNameMissing)}</strong>
            <span>라이더명 누락</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.emptyValues)}</strong>
            <span>빈값/누락값</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.numberConversionWarnings)}</strong>
            <span>숫자 변환</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.typeErrors)}</strong>
            <span>배달타입 확인</span>
          </div>
          <div>
            <strong>{formatNumber(activeCounts.segmentErrors)}</strong>
            <span>시간대 오류</span>
          </div>
        </div>
      </section>

      <section className="panel upload-file-panel">
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
                <span>정상 {formatNumber(upload.summary?.parsedRows ?? upload.orderCount)}행 · 이슈 {formatNumber(upload.issueCount)}건</span>
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
            <div>
              <h3>검수 경고 요약</h3>
              <p>동일 유형 경고는 그룹화했고, 상세보기에서 행 번호와 원본값을 확인할 수 있습니다.</p>
            </div>
            <ShieldAlert size={22} aria-hidden="true" />
          </div>
          <div className="issue-list">
            {activeIssueGroups.map((group) => (
              <details className="issue-card" key={group.type}>
                <summary>
                  <span className="status-pill warning">{group.label}</span>
                  <strong>{formatNumber(group.count)}건</strong>
                </summary>
                <div className="issue-detail-list">
                  {group.rows.map((row) => (
                    <p key={`${group.type}-${row.week}-${row.rowNumber}-${row.rawValue ?? row.message}`}>
                      {row.week} · {row.rowNumber}행
                      {row.rawValue !== undefined ? ` · 원본값: ${row.rawValue || "빈 값"}` : ""} · {row.message}
                    </p>
                  ))}
                  {group.count > group.rows.length ? <p>상세 행은 상위 {formatNumber(group.rows.length)}개까지만 표시합니다.</p> : null}
                </div>
              </details>
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
              <p>상세 행은 그룹별 상위 30개까지만 표시합니다. 전체 오류 수는 요약 카운트에 반영됩니다.</p>
            </div>
            <AlertCircle size={22} aria-hidden="true" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
