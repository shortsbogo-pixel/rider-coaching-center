import { useEffect, useMemo, useState } from "react";
import orders from "../data/sampleOrders.json";
import riders from "../data/sampleRiders.json";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { RiskBadge } from "../components/admin/RiskBadge";
import type { OrderRecord, TimeSegment } from "../types/order";
import type { RiderGrade, RiderMetrics, RiderProfile } from "../types/rider";
import { getAuthHeader } from "../utils/authStore";
import { buildRiderMetrics, getGradeLabel } from "../utils/scoring";

const fallbackMetrics = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[]);
const segments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];
const gradeOrder: RiderGrade[] = ["S", "A", "B", "C", "MANAGEMENT_TARGET"];

function mergeWeeklyTotals(metrics: RiderMetrics[]) {
  return Object.entries(
    metrics.reduce<Record<string, number>>((acc, metric) => {
      Object.entries(metric.weeklyCompleted).forEach(([week, total]) => {
        acc[week] = (acc[week] ?? 0) + total;
      });
      return acc;
    }, {})
  ).filter(([, total]) => total > 0);
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<RiderMetrics[]>(fallbackMetrics);

  useEffect(() => {
    fetch("/api/riders", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => setMetrics(data as RiderMetrics[]))
      .catch(() => setMetrics(fallbackMetrics));
  }, []);

  const totalCompleted = metrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const activeRiderCount = metrics.filter((metric) => metric.totalCompleted > 0).length;
  const multiCompleted = metrics.reduce((sum, metric) => {
    return sum + Object.entries(metric.deliveryTypeCompleted)
      .filter(([type]) => type.startsWith("멀티배달"))
      .reduce((innerSum, [, count]) => innerSum + count, 0);
  }, 0);
  const avgMultiRatio = totalCompleted ? (multiCompleted / totalCompleted) * 100 : 0;
  const sClassCount = metrics.filter((metric) => metric.riderGrade === "S").length;
  const sClassRatio = activeRiderCount ? (sClassCount / activeRiderCount) * 100 : 0;
  const managementCount = metrics.filter((metric) => metric.riderGrade === "MANAGEMENT_TARGET").length;
  const autoTargetCount = metrics.filter((metric) => metric.validationStatus === "AUTO_ANALYSIS_TARGET").length;
  const weeklyTotals = mergeWeeklyTotals(metrics);
  const maxWeekTotal = Math.max(...weeklyTotals.map(([, value]) => value), 1);

  const segmentTotals = useMemo(
    () =>
      segments.map((segment) => ({
        segment,
        total: metrics.reduce((sum, metric) => sum + metric.segmentCompleted[segment], 0)
      })),
    [metrics]
  );
  const weakestSegment = [...segmentTotals].sort((a, b) => a.total - b.total)[0];
  const maxSegmentTotal = Math.max(...segmentTotals.map((item) => item.total), 1);
  const gradeCounts = Object.fromEntries(
    gradeOrder.map((grade) => [grade, metrics.filter((metric) => metric.riderGrade === grade).length])
  ) as Record<RiderGrade, number>;

  return (
    <div className="page-stack">
      <SectionHeader title="관리자 대시보드" description="캔버스 기획 기준을 반영해 실제 운행 라이더 등급과 취약 구간을 요약합니다." />

      <div className="metric-grid">
        <MetricCard label="전체 운행 라이더" value={`${activeRiderCount}명`} caption="완료 기록 기준" />
        <MetricCard label="전체 완료건수" value={`${totalCompleted}건`} caption="업로드 데이터 합산" tone="good" />
        <MetricCard label="멀티배달 비율" value={`${avgMultiRatio.toFixed(1)}%`} caption={`${multiCompleted}건`} tone="good" />
        <MetricCard label="S급 라이더 비율" value={`${sClassRatio.toFixed(1)}%`} caption={`${sClassCount}명`} />
        <MetricCard label="관리대상" value={`${managementCount}명`} tone={managementCount ? "warning" : "default"} />
        <MetricCard label="자동 분석 대상" value={`${autoTargetCount}명`} caption="업로드에서 발견" tone="warning" />
        <MetricCard label="취약 구간" value={weakestSegment?.segment ?? "-"} caption={`${weakestSegment?.total ?? 0}건`} />
        <MetricCard label="평균 점수" value={`${Math.round(metrics.reduce((sum, item) => sum + item.dispatchScore, 0) / Math.max(metrics.length, 1))}점`} />
      </div>

      <section className="panel">
        <h3>라이더 등급 분포</h3>
        <div className="grade-grid">
          {gradeOrder.map((grade) => (
            <div className={`grade-card ${grade === "MANAGEMENT_TARGET" ? "warning" : ""}`} key={grade}>
              <span>{getGradeLabel(grade)}</span>
              <strong>{gradeCounts[grade]}명</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>주차별 전체 오더 성장세</h3>
        <div className="bar-list">
          {weeklyTotals.map(([week, total]) => (
            <div className="bar-row" key={week}>
              <span>{week}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(total / maxWeekTotal) * 100}%` }} />
              </div>
              <strong>{total}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>구간별 완료 집중도</h3>
        <div className="bar-list">
          {segmentTotals.map((item) => (
            <div className="bar-row" key={item.segment}>
              <span>{item.segment}</span>
              <div className="bar-track">
                <div className="bar-fill teal" style={{ width: `${(item.total / maxSegmentTotal) * 100}%` }} />
              </div>
              <strong>{item.total}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>라이더 위험도 요약</h3>
        <div className="rider-list">
          {metrics.slice(0, 10).map((metric, index) => (
            <article className="list-card" key={metric.riderId}>
              <div>
                <strong>{index + 1}. {metric.displayName}</strong>
                <span>{getGradeLabel(metric.riderGrade)} · {metric.totalCompleted}건 · 멀티 {Math.round(metric.multiDeliveryRate * 100)}%</span>
              </div>
              <div className="list-card-right">
                <b>{metric.dispatchScore}점</b>
                <RiskBadge level={metric.riskLevel} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
