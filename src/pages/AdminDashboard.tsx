import { useEffect, useMemo, useState } from "react";
import orders from "../data/sampleOrders.json";
import riders from "../data/sampleRiders.json";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { RiskBadge } from "../components/admin/RiskBadge";
import type { UploadedWeekSummary } from "../types/newWeekBriefing";
import type { OrderRecord, TimeSegment } from "../types/order";
import type { RiderGrade, RiderMetrics, RiderProfile } from "../types/rider";
import { getAuthHeader } from "../utils/authStore";
import { buildKeyChanges, buildLunchMissionBrief, getUploadHealth, getWeakestAction } from "../utils/newWeekBriefingAnalyzer";
import { buildRiderMetrics, getGradeLabel } from "../utils/scoring";
import { getLatestWeekKey, sortWeekKeys } from "../utils/weekSelector";

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

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<RiderMetrics[]>(fallbackMetrics);
  const [uploadedWeeks, setUploadedWeeks] = useState<UploadedWeekSummary[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<RiderMetrics[]>([]);
  const [previousMetrics, setPreviousMetrics] = useState<RiderMetrics[]>([]);

  useEffect(() => {
    fetch("/api/riders", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => setMetrics(data as RiderMetrics[]))
      .catch(() => setMetrics(fallbackMetrics));
  }, []);

  useEffect(() => {
    fetch("/api/uploads")
      .then((response) => response.json())
      .then(async (data) => {
        const uploads = ((data.weeks ?? []) as UploadedWeekSummary[]).map((item) => ({
          ...item,
          week: item.weekKey ?? item.week
        }));
        setUploadedWeeks(uploads);

        const sortedWeeks = sortWeekKeys(uploads.map((item) => item.week));
        const latestWeek = sortedWeeks[0];
        const previousWeek = sortedWeeks[1];

        if (!latestWeek) return;

        const [latestResponse, previousResponse] = await Promise.all([
          fetch(`/api/riders?weekKey=${encodeURIComponent(latestWeek)}`, { headers: getAuthHeader() }),
          previousWeek
            ? fetch(`/api/riders?weekKey=${encodeURIComponent(previousWeek)}`, { headers: getAuthHeader() })
            : Promise.resolve(undefined)
        ]);
        setLatestMetrics((await latestResponse.json()) as RiderMetrics[]);
        setPreviousMetrics(previousResponse ? ((await previousResponse.json()) as RiderMetrics[]) : []);
      })
      .catch(() => {
        setUploadedWeeks([]);
        setLatestMetrics([]);
        setPreviousMetrics([]);
      });
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
  const latestWeekKey = getLatestWeekKey(uploadedWeeks.map((item) => item.week));
  const latestUpload = uploadedWeeks.find((upload) => upload.week === latestWeekKey);
  const uploadHealth = getUploadHealth(latestUpload);
  const latestCompleted = latestMetrics.reduce((sum, metric) => sum + metric.totalCompleted, 0);
  const latestAutoTargetCount = latestMetrics.filter((metric) => metric.validationStatus === "AUTO_ANALYSIS_TARGET").length;
  const keyChanges = buildKeyChanges(latestMetrics, previousMetrics);
  const actionRequired = getWeakestAction(latestMetrics);
  const lunchMission = buildLunchMissionBrief(latestMetrics);

  return (
    <div className="page-stack">
      <SectionHeader title="관리자 대시보드" description="캔버스 기획 기준을 반영해 실제 운행 라이더 등급과 취약 구간을 요약합니다." />

      {latestUpload ? (
        <section className="panel briefing-panel">
          <div className="analysis-title">
            <div>
              <h3>신규 주차 운영 브리핑</h3>
              <p>{latestUpload.week} 데이터가 업로드되었습니다. 먼저 검수 상태와 조치 우선순위를 확인하세요.</p>
            </div>
            <span className={`status-pill ${uploadHealth.tone}`}>{uploadHealth.label}</span>
          </div>

          <div className="briefing-grid">
            <article className="briefing-card">
              <span>업로드 주차</span>
              <strong>{latestUpload.week}</strong>
              <small>{formatDateTime(latestUpload.uploadedAt)}</small>
            </article>
            <article className="briefing-card">
              <span>정상 분석</span>
              <strong>{latestUpload.completedTotal ?? latestCompleted}건</strong>
              <small>오류/확인 {latestUpload.issueCount}건</small>
            </article>
            <article className="briefing-card">
              <span>신규 자동 분석 대상</span>
              <strong>{latestAutoTargetCount}명</strong>
              <small>최신 주차 기준</small>
            </article>
          </div>

          <div className="briefing-section">
            <h4>이번 주 핵심 변화</h4>
            <div className="briefing-grid">
              {keyChanges.map((item) => (
                <article className={`briefing-card ${item.tone}`} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="briefing-split">
            {actionRequired ? (
              <article className="briefing-card warning">
                <span>즉시 조치 필요</span>
                <strong>{actionRequired.segment}</strong>
                <small>{actionRequired.reason}</small>
                <p>{actionRequired.recommendation}</p>
              </article>
            ) : null}
            <article className="briefing-card">
              <span>런치 미션 후보</span>
              <strong>{lunchMission.tenPlusCount}명</strong>
              <small>14건 이상 {lunchMission.fourteenPlusCount}명 · 예상 {formatCurrency(lunchMission.estimatedBudget)}원</small>
              <p>{lunchMission.recommendation}</p>
            </article>
          </div>

          <div className="button-row data-button-row">
            <a className="secondary-link-button" href="/validation">데이터 검수</a>
            <a className="secondary-link-button" href="/missions">미션 확인</a>
            <a className="secondary-link-button" href={`/coaching?weekKey=${encodeURIComponent(latestUpload.week)}`}>코칭 생성</a>
          </div>
        </section>
      ) : null}

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
