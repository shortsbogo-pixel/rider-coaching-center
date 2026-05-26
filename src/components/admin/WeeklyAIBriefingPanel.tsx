import { Clipboard, Sparkles } from "lucide-react";
import type { LocalWeeklyAIBriefingEntry, WeeklyAIBriefingSummary } from "../../types/aiCoaching";

interface WeeklyAIBriefingPanelProps {
  weekKey: string;
  previousWeekKey?: string;
  summary: WeeklyAIBriefingSummary;
  latestBriefing?: LocalWeeklyAIBriefingEntry;
  history: LocalWeeklyAIBriefingEntry[];
  loading: boolean;
  copyStatus?: string;
  errorMessage?: string;
  onGenerate: () => void;
  onCopy: (entry: LocalWeeklyAIBriefingEntry) => void;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Number.isFinite(value) ? value : 0);
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function sourceLabel(entry: LocalWeeklyAIBriefingEntry) {
  return entry.isTemplate ? "기본 템플릿 사용" : "Gemma 4 생성";
}

export function WeeklyAIBriefingPanel({
  weekKey,
  previousWeekKey,
  summary,
  latestBriefing,
  history,
  loading,
  copyStatus,
  errorMessage,
  onGenerate,
  onCopy
}: WeeklyAIBriefingPanelProps) {
  const hasData = summary.totalRiders > 0;
  const metricCards = [
    { label: "전체 라이더", value: `${formatNumber(summary.totalRiders)}명` },
    { label: "고위험", value: `${formatNumber(summary.highRiskCount)}명`, tone: "danger" },
    { label: "관리주의/주의", value: `${formatNumber(summary.cautionCount)}명`, tone: "warning" },
    { label: "하락 라이더", value: `${formatNumber(summary.declinedCount)}명`, tone: "danger" },
    { label: "회복 라이더", value: `${formatNumber(summary.recoveredCount)}명`, tone: "good" },
    { label: "액션 완료율", value: `${formatRate(summary.actionCompletionRate)}` }
  ];

  return (
    <section className="panel weekly-ai-briefing-panel">
      <div className="analysis-title weekly-ai-title">
        <div>
          <h3>주간 AI 브리핑</h3>
          <p>
            {weekKey || "주차 미선택"}
            {previousWeekKey ? ` · ${previousWeekKey} 대비` : ""}
          </p>
        </div>
        {latestBriefing ? (
          <span className={`ai-result-badge ${latestBriefing.isTemplate ? "template" : "generated"}`}>{sourceLabel(latestBriefing)}</span>
        ) : null}
      </div>

      <div className="weekly-ai-summary-grid">
        {metricCards.map((card) => (
          <article className={`weekly-ai-summary-card ${card.tone ?? ""}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="weekly-ai-action-row">
        <button className="ai-coaching-button weekly-ai-generate-button" type="button" disabled={!hasData || loading} onClick={onGenerate}>
          <Sparkles size={16} aria-hidden="true" />
          <span>{loading ? "브리핑 생성 중" : "주간 AI 브리핑 생성"}</span>
        </button>
        <span className="weekly-ai-meta">
          평균 변화율 {formatRate(summary.averageChangeRate)} · AI 코칭 {formatNumber(summary.coachingGeneratedCount)}건
        </span>
      </div>

      {!hasData ? <p className="weekly-ai-empty">브리핑을 생성할 데이터가 없습니다.</p> : null}
      {errorMessage ? <p className="weekly-ai-error">{errorMessage}</p> : null}

      {latestBriefing ? (
        <article className="weekly-ai-result">
          <div className="weekly-ai-result-head">
            <div>
              <h4>{latestBriefing.briefingTitle}</h4>
              <small>{formatDateTime(latestBriefing.createdAt)}</small>
            </div>
            <button className="copy-button weekly-ai-copy-button" type="button" onClick={() => onCopy(latestBriefing)}>
              <Clipboard size={14} aria-hidden="true" />
              <span>브리핑 복사</span>
            </button>
          </div>
          {copyStatus ? <span className="copy-toast weekly-ai-copy-status">{copyStatus}</span> : null}

          <div className="weekly-ai-message-grid">
            <div>
              <strong>핵심 요약</strong>
              <p>{latestBriefing.executiveSummary}</p>
            </div>
            <div>
              <strong>위험 요약</strong>
              <p>{latestBriefing.riskSummary}</p>
            </div>
            <div>
              <strong>이번 주 집중 포인트</strong>
              <p>{latestBriefing.recommendedFocus}</p>
            </div>
            <div>
              <strong>관리자 메시지</strong>
              <p>{latestBriefing.messageForManagers}</p>
            </div>
          </div>

          <div className="weekly-ai-actions">
            <strong>우선 액션</strong>
            <ol>
              {latestBriefing.priorityActions.slice(0, 3).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </div>
        </article>
      ) : (
        <p className="weekly-ai-empty">아직 생성된 주간 브리핑이 없습니다.</p>
      )}

      <details className="weekly-ai-history">
        <summary>이전 브리핑 보기 {history.length ? `(${history.length})` : ""}</summary>
        <div className="weekly-ai-history-list">
          {history.length ? (
            history.map((entry) => (
              <details className="weekly-ai-history-entry" key={entry.id}>
                <summary>
                  <span>{formatDateTime(entry.createdAt)}</span>
                  <b>{sourceLabel(entry)}</b>
                </summary>
                <div>
                  <strong>{entry.briefingTitle}</strong>
                  <p>{entry.executiveSummary}</p>
                  <p>{entry.riskSummary}</p>
                  <ol>
                    {entry.priorityActions.slice(0, 3).map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ol>
                </div>
              </details>
            ))
          ) : (
            <p>저장된 이전 브리핑이 없습니다.</p>
          )}
        </div>
      </details>
    </section>
  );
}
