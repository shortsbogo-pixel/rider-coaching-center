import { Clipboard } from "lucide-react";
import type { MonthlyOperationReport, MonthlyOperationReportSummary } from "../../utils/monthlyOperationReport";
import type { LocalMonthlyReportEntry } from "../../utils/monthlyReportHistory";

interface MonthlyOperationReportPanelProps {
  summary: MonthlyOperationReportSummary;
  report?: MonthlyOperationReport;
  history: LocalMonthlyReportEntry[];
  loading: boolean;
  copyStatus?: string;
  copyFailed?: boolean;
  manualCopyText?: string;
  errorMessage?: string;
  operationMemo: string;
  onMemoChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Number.isFinite(value) ? value : 0);
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function MonthlyOperationReportPanel({
  summary,
  report,
  history,
  loading,
  copyStatus,
  copyFailed,
  manualCopyText,
  errorMessage,
  operationMemo,
  onMemoChange,
  onGenerate,
  onCopy
}: MonthlyOperationReportPanelProps) {
  const metricCards = [
    { label: "총 코칭 생성", value: `${formatNumber(summary.coachingGeneratedCount)}건` },
    { label: "고위험 코칭", value: `${formatNumber(summary.highRiskCoachingCount)}건`, tone: "danger" },
    { label: "액션 완료율", value: formatRate(summary.actionCompletionRate), tone: "good" },
    { label: "관리 필요 라이더", value: `${formatNumber(summary.managementNeededRiderCount)}명`, tone: "warning" }
  ];

  return (
    <section className="panel monthly-operation-report">
      <div className="analysis-title monthly-report-title">
        <div>
          <h3>월간 운영 리포트</h3>
          <p>{summary.monthKey} 기준</p>
        </div>
        <div className="monthly-report-button-row">
          <button className="ai-coaching-button monthly-report-generate-button" type="button" disabled={loading} onClick={onGenerate}>
            {loading ? "리포트 생성 중" : "월간 리포트 생성"}
          </button>
          <button className="copy-button monthly-report-copy-button" type="button" disabled={!report} onClick={onCopy}>
            <Clipboard size={14} aria-hidden="true" />
            <span>리포트 텍스트 복사</span>
          </button>
        </div>
      </div>
      {copyStatus ? <span className="copy-toast monthly-report-copy-status">{copyStatus}</span> : null}
      {errorMessage ? <p className="monthly-report-error">{errorMessage}</p> : null}
      {copyFailed ? <textarea className="manual-copy-box" value={manualCopyText ?? ""} readOnly /> : null}

      <div className="monthly-report-metric-grid">
        {metricCards.map((card) => (
          <article className={`monthly-report-metric ${card.tone ?? ""}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="monthly-report-split">
        <div className="monthly-report-list">
          <strong>가장 많이 코칭된 라이더 TOP 5</strong>
          {summary.topCoachedRiders.length ? (
            summary.topCoachedRiders.map((rider) => (
              <span key={rider.riderName}>
                {rider.riderName} <b>{formatNumber(rider.count)}건</b>
              </span>
            ))
          ) : (
            <p>이번 달 저장된 코칭 이력이 없습니다.</p>
          )}
        </div>

        <div className="monthly-report-list">
          <strong>하락폭이 컸던 라이더 TOP 5</strong>
          {summary.topDeclinedRiders.length ? (
            summary.topDeclinedRiders.map((rider) => (
              <span key={rider.riderName}>
                {rider.riderName} <b>{formatRate(rider.changeRate)} / {formatNumber(rider.currentWeekCompleted)}건</b>
              </span>
            ))
          ) : (
            <p>현재 선택 주차에 하락 라이더가 없습니다.</p>
          )}
        </div>
      </div>

      <div className="monthly-report-ai-summary">
        <div className="monthly-report-ai-head">
          <strong>AI 운영 요약</strong>
          {report ? <span className={`ai-result-badge ${report.isTemplate ? "template" : "generated"}`}>{report.isTemplate ? "기본 템플릿 사용" : "Gemma 4 생성"}</span> : null}
        </div>
        {report ? (
          <>
            <p>{report.operationSummary}</p>
            <strong>다음 달 관리 제안</strong>
            <ol>
              {report.nextMonthActions.slice(0, 3).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
            <small>{formatDateTime(report.createdAt)}</small>
          </>
        ) : (
          <p>아직 생성된 월간 운영 리포트가 없습니다.</p>
        )}
      </div>

      <label className="monthly-report-memo">
        <span>운영 메모</span>
        <textarea
          value={operationMemo}
          onChange={(event) => onMemoChange(event.target.value)}
          rows={3}
          placeholder="이번 달 관리 포인트를 입력하세요."
        />
      </label>

      <details className="monthly-report-history">
        <summary>이전 월간 리포트 보기 {history.length ? `(${history.length})` : ""}</summary>
        <div className="monthly-report-history-list">
          {history.length ? (
            history.map((entry) => (
              <details className="monthly-report-history-entry" key={entry.id}>
                <summary>
                  <span>{formatDateTime(entry.createdAt)}</span>
                  <b>{entry.isTemplate ? "기본 템플릿" : "Gemma 4"}</b>
                </summary>
                <div>
                  <p>{entry.operationSummary}</p>
                  <ol>
                    {entry.nextMonthActions.slice(0, 3).map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ol>
                </div>
              </details>
            ))
          ) : (
            <p>저장된 이전 월간 리포트가 없습니다.</p>
          )}
        </div>
      </details>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
