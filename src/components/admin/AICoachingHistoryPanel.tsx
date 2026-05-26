import { useState } from "react";
import type { LocalAICoachingHistoryEntry } from "../../types/aiCoaching";

interface AICoachingHistoryPanelProps {
  history: LocalAICoachingHistoryEntry[];
  latestCreatedAt?: string;
}

function formatHistoryDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatChangeRate(value: number) {
  if (!Number.isFinite(value)) return "비교 불가";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function sourceLabel(source: LocalAICoachingHistoryEntry["source"]) {
  if (source === "gemma4") return "Gemma 4";
  if (source === "server-history") return "서버 이력";
  if (source === "local-template") return "로컬 템플릿";
  return "기본 템플릿";
}

export function AICoachingHistoryPanel({ history, latestCreatedAt }: AICoachingHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const latestLabel = latestCreatedAt || history[0]?.createdAt;

  return (
    <div className="ai-history-panel">
      {latestLabel ? <span className="ai-history-latest">최근 생성: {formatHistoryDate(latestLabel)}</span> : null}
      <button className="copy-button ai-history-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        이전 코칭 보기 {history.length ? `(${history.length})` : ""}
      </button>

      {open ? (
        <div className="ai-history-accordion">
          {history.length ? (
            history.map((entry) => (
              <details className="ai-history-entry" key={entry.id}>
                <summary>
                  <span>{formatHistoryDate(entry.createdAt)}</span>
                  <b>{entry.riskLevel}</b>
                  <em>{formatChangeRate(entry.changeRate)}</em>
                </summary>
                <div className="ai-history-entry-body">
                  <span className={`ai-result-badge ${entry.isTemplate ? "template" : "generated"}`}>{sourceLabel(entry.source)}</span>
                  <div>
                    <strong>관리자용 문구</strong>
                    <p>{entry.adminMessage}</p>
                  </div>
                  <div>
                    <strong>라이더 전달용 문구</strong>
                    <p>{entry.riderMessage}</p>
                  </div>
                </div>
              </details>
            ))
          ) : (
            <p className="ai-history-empty">AI 코칭을 생성하면 같은 라이더의 이전 코칭 메시지를 여기서 다시 확인할 수 있습니다.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
