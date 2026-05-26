import type { RiderTrendAnalysis } from "../../utils/riderTrendAnalysis";
import { DataQualityWarningPanel } from "./DataQualityWarningPanel";

interface RiderAnalysisReasonPanelProps {
  analysis: RiderTrendAnalysis;
  aiInputPreview: Record<string, unknown>;
}

function formatRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "비교 불가";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCompleted(value: number | null) {
  return value === null ? "데이터 없음" : `${value}건`;
}

export function RiderAnalysisReasonPanel({ analysis, aiInputPreview }: RiderAnalysisReasonPanelProps) {
  return (
    <details className="rider-analysis-reason-panel">
      <summary>분석 근거 보기</summary>
      <div className="rider-analysis-reason-body">
        <div className="trend-flow-grid">
          {analysis.recentFourWeekTrend.map((point) => (
            <article className={point.missing ? "missing" : ""} key={point.weekKey}>
              <span>{point.weekKey}</span>
              <strong>{formatCompleted(point.completed)}</strong>
            </article>
          ))}
        </div>

        <div className="trend-metric-grid">
          <article>
            <span>전주 대비</span>
            <strong>{formatRate(analysis.changeRateFromPreviousWeek)}</strong>
          </article>
          <article>
            <span>전전주 대비</span>
            <strong>{formatRate(analysis.changeRateFromTwoWeeksAgo)}</strong>
          </article>
          <article>
            <span>4주 평균 대비</span>
            <strong>{formatRate(analysis.changeRateFromFourWeekAverage)}</strong>
          </article>
          <article>
            <span>연속 흐름</span>
            <strong>
              하락 {analysis.declineStreakWeeks}주 · 회복 {analysis.recoveryStreakWeeks}주
            </strong>
          </article>
        </div>

        <div className="analysis-reason-list">
          <strong>위험도 판정 근거</strong>
          {analysis.riskReasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>

        <DataQualityWarningPanel warnings={analysis.dataWarnings} compact title="라이더 데이터 검수 경고" />

        <details className="ai-input-preview">
          <summary>AI 코칭 입력값 미리보기</summary>
          <pre>{JSON.stringify(aiInputPreview, null, 2)}</pre>
        </details>
      </div>
    </details>
  );
}
