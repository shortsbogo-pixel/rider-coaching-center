import type { LocalOperationBriefingEntry, OperationBriefingSummaryInput } from "../../types/operationBriefing";
import { PriorityActionCards } from "./PriorityActionCards";

interface OperationBriefingPanelProps {
  weekKey: string;
  summary: OperationBriefingSummaryInput;
  latestBriefing?: LocalOperationBriefingEntry;
  history: LocalOperationBriefingEntry[];
  loading: boolean;
  copyStatus: string;
  copyFailed: boolean;
  manualCopyText: string;
  errorMessage: string;
  onGenerate: () => void;
  onCopyExecutive: () => void;
  onCopyManager: () => void;
  onPriorityActionClick: (action: string, index: number) => void;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function OperationBriefingPanel({
  weekKey,
  summary,
  latestBriefing,
  history,
  loading,
  copyStatus,
  copyFailed,
  manualCopyText,
  errorMessage,
  onGenerate,
  onCopyExecutive,
  onCopyManager,
  onPriorityActionClick
}: OperationBriefingPanelProps) {
  const stats = summary.summaryStats;
  const priorityActions = latestBriefing?.priorityActions ?? summary.priorityActionHints;

  return (
    <section className="panel operation-briefing-panel">
      <div className="operation-panel-title">
        <div>
          <h3>AI 운영본부 브리핑</h3>
          <p>코드가 계산한 운영 지표를 바탕으로 Gemma 4가 관리자용 요약 문장만 생성합니다.</p>
        </div>
        <div className="operation-title-actions">
          <span className={`ai-result-badge ${latestBriefing?.isTemplate ? "template" : latestBriefing ? "generated" : "template"}`}>
            {latestBriefing ? (latestBriefing.isTemplate ? "기본 템플릿 사용" : "Gemma 4 생성") : "브리핑 대기"}
          </span>
          {latestBriefing?.isTemplate ? (
            <small className="ai-fallback-note">템플릿 모드 · {latestBriefing.fallbackReason ?? "fallback"}</small>
          ) : null}
          <button className="ai-coaching-button" type="button" disabled={!weekKey || loading} onClick={onGenerate}>
            {loading ? "브리핑 생성 중…" : latestBriefing ? "AI 운영본부 브리핑 재생성" : "AI 운영본부 브리핑 생성"}
          </button>
        </div>
      </div>

      <div className="operation-briefing-metrics">
        <article>
          <span>고위험/관리주의</span>
          <strong>{formatNumber(stats.highRiskRiderCount + stats.cautionRiderCount)}명</strong>
          <small>고위험 {formatNumber(stats.highRiskRiderCount)}명</small>
        </article>
        <article>
          <span>미조치 라이더</span>
          <strong>{formatNumber(summary.actionChecklistStats.incompleteRiderCount)}명</strong>
          <small>체크리스트 미완료 {formatNumber(stats.incompleteChecklistItemCount)}건</small>
        </article>
        <article>
          <span>미발송 대기</span>
          <strong>{formatNumber(stats.unsentQueueCount)}건</strong>
          <small>발송완료 {formatNumber(stats.sentQueueCount)}건</small>
        </article>
        <article>
          <span>데이터 검수</span>
          <strong>{formatNumber(stats.dataWarningCount)}건</strong>
          <small>하락세 {formatNumber(stats.decliningRiderCount)}명</small>
        </article>
      </div>

      <PriorityActionCards actions={priorityActions} onActionClick={onPriorityActionClick} />

      {latestBriefing ? (
        <div className="operation-briefing-body">
          <article className="operation-briefing-summary">
            <span>대표 보고용 한 줄 요약</span>
            <strong>{latestBriefing.executiveSummary}</strong>
          </article>
          <details className="operation-briefing-details">
            <summary>상세 브리핑 보기</summary>
            <div className="operation-briefing-detail-grid">
              <article>
                <span>관리자 브리핑</span>
                <p>{latestBriefing.managerBriefing}</p>
              </article>
              <article>
                <span>위험 집중 포인트</span>
                <p>{latestBriefing.riskFocus}</p>
              </article>
              <article>
                <span>발송 대기함 조언</span>
                <p>{latestBriefing.messageQueueAdvice}</p>
              </article>
              <article>
                <span>데이터 검수 메모</span>
                <p>{latestBriefing.dataQualityNotes}</p>
              </article>
            </div>
          </details>
          <div className="operation-button-grid">
            <button className="copy-button" type="button" onClick={onCopyExecutive}>
              대표 보고용 복사
            </button>
            <button className="copy-button" type="button" onClick={onCopyManager}>
              관리자 공유용 복사
            </button>
          </div>
        </div>
      ) : (
        <p className="operation-empty-message">AI 운영본부 브리핑을 생성하면 대표 보고용 요약과 오늘의 우선 조치가 이곳에 표시됩니다.</p>
      )}

      {copyStatus ? <p className="operation-success-message">{copyStatus}</p> : null}
      {copyFailed && manualCopyText ? (
        <label className="field">
          <span>수동 복사용 텍스트</span>
          <textarea readOnly value={manualCopyText} />
        </label>
      ) : null}
      {errorMessage ? <p className="operation-error-message">{errorMessage}</p> : null}

      {history.length > 1 ? (
        <details className="operation-briefing-history">
          <summary>이전 AI 운영본부 브리핑 보기</summary>
          <div className="operation-log-list">
            {history.slice(1, 6).map((entry) => (
              <article className="operation-log-card" key={entry.id}>
                <strong>{entry.executiveSummary}</strong>
                <small>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}</small>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
