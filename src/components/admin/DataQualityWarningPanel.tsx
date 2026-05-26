import type { DataQualityWarning } from "../../utils/riderTrendAnalysis";

interface DataQualityWarningPanelProps {
  warnings: DataQualityWarning[];
  title?: string;
  compact?: boolean;
}

export function DataQualityWarningPanel({ warnings, title = "데이터 검수 경고", compact = false }: DataQualityWarningPanelProps) {
  if (!warnings.length) return null;

  return (
    <section className={compact ? "data-quality-warning-panel compact" : "panel data-quality-warning-panel"}>
      <div className="data-quality-title">
        <strong>{title}</strong>
        <span>{warnings.length}건</span>
      </div>
      <div className="data-quality-list">
        {warnings.slice(0, compact ? 4 : 10).map((warning) => (
          <p className={`data-quality-warning ${warning.severity}`} key={warning.id}>
            {warning.weekKey ? <b>{warning.weekKey}</b> : null}
            {warning.riderName ? <b>{warning.riderName}</b> : null}
            <span>{warning.message}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
