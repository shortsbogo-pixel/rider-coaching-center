import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  caption,
  tone = "default"
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  return (
    <section className={`metric-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {caption ? <span>{caption}</span> : null}
    </section>
  );
}
