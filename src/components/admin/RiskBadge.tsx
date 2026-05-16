import type { RiderRiskLevel } from "../../types/rider";

export function RiskBadge({ level }: { level: RiderRiskLevel }) {
  const tone = level === "고위험" ? "danger" : level === "관리주의" ? "warning" : level === "에이스" ? "good" : "default";
  return <span className={`risk-badge ${tone}`}>{level}</span>;
}
