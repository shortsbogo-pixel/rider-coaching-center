import { BarChart3, CheckCircle2, ChevronDown, Clock3, Route, ShieldCheck, Truck, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TimeSegment } from "../../types/order";
import type { RiderMetrics } from "../../types/rider";
import { requiredOrderColumns } from "../../utils/excelParser";
import { getGradeLabel } from "../../utils/scoring";

interface ValidationUpload {
  week: string;
  missingColumns: string[];
  issueCount: number;
}

interface ValidationSummary {
  uploads?: ValidationUpload[];
}

interface RiderDataInsightProps {
  metrics: RiderMetrics;
  weekKey: string;
  missionHint: string;
  strengths: string[];
  weaknesses: string[];
}

const segmentLabels: Record<TimeSegment, string> = {
  Breakfast: "아침",
  Lunch_Peak: "점심 피크",
  Post_Lunch: "점심 이후",
  Dinner_Peak: "저녁 피크",
  Post_Dinner: "저녁 이후"
};

const segments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 10) / 10}%`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getAttendanceCount(metrics: RiderMetrics) {
  return Object.values(metrics.weekdayCompleted).filter((count) => count > 0).length;
}

function getSegmentRate(metrics: RiderMetrics, segment: TimeSegment) {
  if (!metrics.totalCompleted) return 0;
  return (metrics.segmentCompleted[segment] / metrics.totalCompleted) * 100;
}

function getTopSegment(metrics: RiderMetrics) {
  return [...segments].sort((a, b) => metrics.segmentCompleted[b] - metrics.segmentCompleted[a])[0];
}

function getRiderRequiredColumns() {
  return requiredOrderColumns.filter((column, index) => index !== 0 && !/(성함|이름)/.test(column));
}

function getSegmentStatus(metrics: RiderMetrics, segment: TimeSegment) {
  if (metrics.strongSegment === segment) return "강점";
  if (metrics.weakSegments.includes(segment) || metrics.weakestSegment === segment) return "보강";
  return "유지";
}

export function RiderDataInsight({ metrics, weekKey, missionHint, strengths, weaknesses }: RiderDataInsightProps) {
  const [uploads, setUploads] = useState<ValidationUpload[]>([]);
  const [isLoadingValidation, setIsLoadingValidation] = useState(true);

  useEffect(() => {
    let ignore = false;
    setIsLoadingValidation(true);

    fetch("/api/uploads/validation")
      .then((response) => response.json())
      .then((data: ValidationSummary) => {
        if (!ignore) setUploads(data.uploads ?? []);
      })
      .catch(() => {
        if (!ignore) setUploads([]);
      })
      .finally(() => {
        if (!ignore) setIsLoadingValidation(false);
      });

    return () => {
      ignore = true;
    };
  }, [weekKey]);

  const activeUploads = useMemo(() => uploads.filter((upload) => upload.week === weekKey), [uploads, weekKey]);
  const requiredColumns = getRiderRequiredColumns();
  const missingColumns = unique(activeUploads.flatMap((upload) => upload.missingColumns ?? [])).filter((column) =>
    requiredColumns.includes(column)
  );
  const issueCount = activeUploads.reduce((sum, upload) => sum + (upload.issueCount ?? 0), 0);
  const hasValidationData = activeUploads.length > 0;
  const validationLabel = isLoadingValidation
    ? "확인 중"
    : !hasValidationData
      ? "검증 대기"
      : missingColumns.length
        ? "일부 확인"
        : "코칭 가능";
  const validationTone = !hasValidationData || isLoadingValidation ? "warning" : missingColumns.length ? "danger" : "good";
  const attendanceCount = getAttendanceCount(metrics);
  const topSegment = getTopSegment(metrics);
  const weakestSegment = metrics.weakestSegment;
  const segmentTotal = segments.reduce((sum, segment) => sum + metrics.segmentCompleted[segment], 0);
  const deliveryTotal = Object.values(metrics.deliveryTypeCompleted).reduce((sum, count) => sum + count, 0);
  const weekdayTotal = Object.values(metrics.weekdayCompleted).reduce((sum, count) => sum + count, 0);
  const segmentRows = segments.map((segment) => ({
    segment,
    label: segmentLabels[segment],
    completed: metrics.segmentCompleted[segment],
    rate: getSegmentRate(metrics, segment),
    status: getSegmentStatus(metrics, segment)
  }));

  return (
    <section className="panel rider-insight-panel">
      <div className="analysis-title">
        <div>
          <h3>내 운행 인사이트</h3>
          <p>{weekKey || "최신 주차"} 업로드 데이터를 라이더용으로 가공해 보여줍니다.</p>
        </div>
        <span className={`status-pill ${validationTone}`}>
          <ShieldCheck size={14} aria-hidden="true" />
          {validationLabel}
        </span>
      </div>

      <div className="rider-insight-summary">
        <article>
          <span>완료</span>
          <strong>{formatNumber(metrics.totalCompleted)}건</strong>
        </article>
        <article>
          <span>출근</span>
          <strong>{attendanceCount}회</strong>
        </article>
        <article>
          <span>강점 구간</span>
          <strong>{segmentLabels[topSegment]}</strong>
        </article>
        <article>
          <span>보강 구간</span>
          <strong>{segmentLabels[weakestSegment]}</strong>
        </article>
      </div>

      <div className="rider-insight-accordion">
        <details className="rider-insight-detail">
          <summary>
            <span>
              <UserCheck size={18} aria-hidden="true" />
              주간 요약
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="rider-insight-body rider-data-status-grid">
            <article>
              <span>등급</span>
              <strong>{getGradeLabel(metrics.riderGrade)}</strong>
            </article>
            <article>
              <span>배차 친화 점수</span>
              <strong>{metrics.dispatchScore}점</strong>
            </article>
            <article>
              <span>멀티율</span>
              <strong>{formatRate(metrics.multiDeliveryRate * 100)}</strong>
            </article>
            <article>
              <span>요일 일관성</span>
              <strong>{formatRate(metrics.consistencyRate * 100)}</strong>
            </article>
          </div>
        </details>

        <details className="rider-insight-detail">
          <summary>
            <span>
              <BarChart3 size={18} aria-hidden="true" />
              전 구간 참여율
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="rider-insight-body rider-segment-list">
            {segmentRows.map((row) => (
              <div className={`rider-segment-row ${row.status === "보강" ? "warning" : row.status === "강점" ? "good" : ""}`} key={row.segment}>
                <div className="rider-segment-head">
                  <strong>{row.label}</strong>
                  <span>
                    {formatNumber(row.completed)}건 · {formatRate(row.rate)}
                  </span>
                  <b>{row.status}</b>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${segmentTotal ? Math.max(row.rate, row.completed ? 4 : 0) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </details>

        <details className="rider-insight-detail">
          <summary>
            <span>
              <Clock3 size={18} aria-hidden="true" />
              출근·활동 패턴
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="rider-insight-body rider-segment-list">
            {Object.entries(metrics.weekdayCompleted).map(([weekday, count]) => {
              const rate = weekdayTotal ? (count / weekdayTotal) * 100 : 0;
              return (
                <div className="rider-segment-row" key={weekday}>
                  <div className="rider-segment-head">
                    <strong>{weekday}</strong>
                    <span>
                      {formatNumber(count)}건 · {formatRate(rate)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill teal" style={{ width: `${weekdayTotal ? Math.max(rate, count ? 4 : 0) : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        <details className="rider-insight-detail">
          <summary>
            <span>
              <Truck size={18} aria-hidden="true" />
              배달 타입·멀티
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="rider-insight-body rider-segment-list">
            {Object.entries(metrics.deliveryTypeCompleted).map(([deliveryType, count]) => {
              const rate = deliveryTotal ? (count / deliveryTotal) * 100 : 0;
              return (
                <div className="rider-segment-row" key={deliveryType}>
                  <div className="rider-segment-head">
                    <strong>{deliveryType}</strong>
                    <span>
                      {formatNumber(count)}건 · {formatRate(rate)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${deliveryTotal ? Math.max(rate, count ? 4 : 0) : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        <details className="rider-insight-detail">
          <summary>
            <span>
              <Route size={18} aria-hidden="true" />
              코칭 포인트
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="rider-insight-body">
            <div className="rider-chip-list">
              {(strengths.length ? strengths : ["현재 주차 강점 항목을 더 수집 중입니다."]).map((item) => (
                <span className="rider-chip good" key={item}>
                  {item}
                </span>
              ))}
            </div>
            <div className="rider-chip-list warning">
              {(weaknesses.length ? weaknesses : ["뚜렷한 보강 항목이 없습니다."]).map((item) => (
                <span className="rider-chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
            <p>{missionHint}</p>
          </div>
        </details>

        <details className="rider-insight-detail">
          <summary>
            <span>
              <CheckCircle2 size={18} aria-hidden="true" />
              데이터 상태
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="rider-insight-body">
            <div className="rider-data-status-grid">
              <article>
                <span>검증 항목</span>
                <strong>{requiredColumns.length}개</strong>
              </article>
              <article>
                <span>확인 필요</span>
                <strong>{missingColumns.length}개</strong>
              </article>
              <article>
                <span>검수 이슈</span>
                <strong>{formatNumber(issueCount)}건</strong>
              </article>
            </div>
            <div className="rider-validation-list">
              {requiredColumns.map((column) => {
                const missing = missingColumns.includes(column);
                return (
                  <span className={missing ? "warning" : "good"} key={column}>
                    {column} · {missing ? "확인 필요" : "정상"}
                  </span>
                );
              })}
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
