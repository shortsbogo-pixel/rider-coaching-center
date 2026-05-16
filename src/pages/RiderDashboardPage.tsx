import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import orders from "../data/sampleOrders.json";
import riders from "../data/sampleRiders.json";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { ScoreRing } from "../components/rider/ScoreRing";
import { useAuth } from "../hooks/useAuth";
import type { CustomCoachingMessage } from "../types/coaching";
import type { DeliveryType, OrderRecord, TimeSegment } from "../types/order";
import type { RiderMetrics, RiderProfile } from "../types/rider";
import { generateCoachingMessage } from "../utils/coachingGenerator";
import { getAuthHeader } from "../utils/authStore";
import { fetchCustomCoachingMessage, fetchCustomCoachingMessages } from "../utils/coachingMessageStore";
import { buildRiderMetrics, getGradeLabel } from "../utils/scoring";

const fallbackMetrics = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[]);
const segments: TimeSegment[] = ["Breakfast", "Lunch_Peak", "Post_Lunch", "Dinner_Peak", "Post_Dinner"];
const deliveryTypes: DeliveryType[] = ["단건배달", "멀티배달1", "멀티배달2", "멀티배달3", "멀티배달4"];

function getMissionHint(metrics: RiderMetrics) {
  if (metrics.postLunchRate < 0.15) return "Post_Lunch 14:00~16:30 구간에서 2~3콜을 추가 목표로 잡아보세요.";
  if (metrics.postDinnerRate < 0.15) return "Post_Dinner 구간에서 짧게라도 운행을 이어가면 다음 등급 방어에 유리합니다.";
  if (metrics.gradeProgress.remainingToNext > 0) {
    return `${metrics.gradeProgress.nextLabel}까지 ${metrics.gradeProgress.remainingToNext}건 남았습니다. 피크타임 이후 구간을 붙여 완성도를 높여보세요.`;
  }
  return "현재 S급 기준에 도달했습니다. 멀티배달과 포스트구간 유지가 핵심입니다.";
}

function buildRiderFacingMessage(metrics: RiderMetrics) {
  const coaching = generateCoachingMessage(metrics);
  return `${coaching.summary}\n\n이번 주 실천 미션: ${coaching.weeklyMission}`;
}

function findLinkedRider(metricsList: RiderMetrics[], riderId?: string | null, riderName?: string | null) {
  if (riderId) {
    const byId = metricsList.find((item) => item.riderId === riderId);
    if (byId) return byId;
  }
  if (riderName) {
    const normalized = riderName.trim();
    return metricsList.find(
      (item) => item.riderName === normalized || item.displayName === normalized || item.baseName === normalized
    );
  }
  return undefined;
}

export function RiderDashboardPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdminPreview = user?.role === "admin";
  const queryRiderId = searchParams.get("riderId");
  const queryRiderName = searchParams.get("riderName");
  const queryWeekKey = searchParams.get("weekKey");
  const [metricsList, setMetricsList] = useState<RiderMetrics[]>(fallbackMetrics);
  const [selectedId, setSelectedId] = useState(user?.role === "rider" ? user.riderId ?? "" : fallbackMetrics[0]?.riderId ?? "");
  const [customMessages, setCustomMessages] = useState<CustomCoachingMessage[]>([]);
  const [basisWeek, setBasisWeek] = useState("");
  const [linkMessage, setLinkMessage] = useState("");

  const riderQueryMismatch =
    user?.role === "rider" &&
    ((queryRiderId && queryRiderId !== user.riderId) ||
      (!queryRiderId && queryRiderName && queryRiderName.trim() !== user.displayName));

  useEffect(() => {
    const riderUrl = user?.role === "rider" && user.riderId ? `/api/riders/${encodeURIComponent(user.riderId)}` : "/api/riders";
    fetch(riderUrl, { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => {
        const next = Array.isArray(data) ? (data as RiderMetrics[]) : ([data] as RiderMetrics[]);
        const resolved = next.length ? next : fallbackMetrics;
        setMetricsList(resolved);

        if (user?.role === "rider") {
          setSelectedId(user.riderId ?? "");
          return;
        }

        const linked = findLinkedRider(resolved, queryRiderId, queryRiderName);
        if (linked) {
          setSelectedId(linked.riderId);
          setLinkMessage("정산관리 앱 링크 파라미터로 선택된 라이더입니다.");
          return;
        }

        if (queryRiderId || queryRiderName) {
          setLinkMessage("URL 파라미터와 일치하는 라이더를 찾지 못했습니다. 드롭다운에서 직접 선택해 주세요.");
        }
        setSelectedId(resolved[0]?.riderId ?? "");
      })
      .catch(() => setMetricsList(fallbackMetrics));
  }, [queryRiderId, queryRiderName, user]);

  useEffect(() => {
    fetch("/api/coaching", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then(async (data) => {
        const week = queryWeekKey || data?.basisWeek || "";
        setBasisWeek(week);
        if (user?.role === "rider" && user.riderId) {
          const message = await fetchCustomCoachingMessage(user.riderId, week);
          return message ? [message] : [];
        }
        return fetchCustomCoachingMessages(week);
      })
      .then(setCustomMessages)
      .catch(() => setCustomMessages([]));
  }, [queryWeekKey, user]);

  if (riderQueryMismatch) {
    return <Navigate to="/rider" replace />;
  }

  const metrics = metricsList.find((item) => item.riderId === selectedId);
  const coaching = useMemo(() => (metrics ? generateCoachingMessage(metrics) : undefined), [metrics]);
  const savedCustom = customMessages.find(
    (message) => message.riderId === metrics?.riderId && (!basisWeek || message.weekKey === basisWeek) && message.isCustom
  );

  if (!metrics || !coaching) {
    return (
      <div className="page-stack">
        <SectionHeader title="라이더 전용 화면" description="로그인한 라이더와 연결된 운행 데이터가 없습니다. 관리자에게 계정 매핑을 확인해 주세요." />
      </div>
    );
  }

  const maxSegment = Math.max(...Object.values(metrics.segmentCompleted), 1);
  const maxDeliveryType = Math.max(...Object.values(metrics.deliveryTypeCompleted), 1);
  const riderMessage = savedCustom?.customMessage || buildRiderFacingMessage(metrics);

  return (
    <div className="page-stack rider-page">
      <SectionHeader
        title="라이더 전용 화면"
        description={isAdminPreview ? "관리자 미리보기 모드입니다. 라이더를 선택해 화면을 확인할 수 있습니다." : "본인 운행 데이터와 코칭 메시지만 표시됩니다."}
      />

      <section className={`panel ${isAdminPreview ? "notice-panel" : ""}`}>
        <h3>{isAdminPreview ? "관리자 미리보기 모드" : "라이더 로그인 모드"}</h3>
        <p>
          {isAdminPreview
            ? "관리자는 정산관리 앱 링크의 riderId 또는 riderName 파라미터로 특정 라이더 화면을 바로 미리볼 수 있습니다."
            : "다른 라이더 데이터와 관리자 내부 메모는 표시되지 않습니다."}
        </p>
        {basisWeek ? <p className="note-text">코칭 메시지 기준 주차: {basisWeek}</p> : null}
        {linkMessage ? <p className="note-text">{linkMessage}</p> : null}
      </section>

      {isAdminPreview ? (
        <section className="panel sticky-selector">
          <label className="field">
            <span>라이더 선택</span>
            <select value={metrics.riderId} onChange={(event) => setSelectedId(event.target.value)}>
              {metricsList.map((item) => (
                <option key={item.riderId} value={item.riderId}>
                  {item.displayName} · {item.totalCompleted}건
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <section className="hero-card">
        <div>
          <p>내 배차 친화 점수</p>
          <h2>{metrics.displayName}</h2>
          <span>
            {getGradeLabel(metrics.riderGrade)} · {coaching.riskLevel} · 최근 데이터 {metrics.totalCompleted}건
          </span>
        </div>
        <ScoreRing score={metrics.dispatchScore} />
      </section>

      <div className="metric-grid">
        <MetricCard label="내 완료건수" value={`${metrics.totalCompleted}건`} />
        <MetricCard label="현재 등급" value={getGradeLabel(metrics.riderGrade)} tone={metrics.riderGrade === "MANAGEMENT_TARGET" ? "warning" : "good"} />
        <MetricCard label="다음 등급까지" value={metrics.gradeProgress.nextLabel ? `${metrics.gradeProgress.remainingToNext}건` : "달성"} />
        <MetricCard label="멀티비율" value={`${Math.round(metrics.multiDeliveryRate * 100)}%`} tone="good" />
        <MetricCard label="Post_Lunch" value={`${Math.round(metrics.postLunchRate * 100)}%`} />
        <MetricCard label="Post_Dinner" value={`${Math.round(metrics.postDinnerRate * 100)}%`} />
      </div>

      <section className="panel mission-panel">
        <h3>라이더용 코칭 메시지</h3>
        <p className="preline-text">{riderMessage}</p>
        {savedCustom ? <p className="note-text">관리자가 저장한 맞춤 메시지입니다.</p> : <p className="note-text">자동 생성 메시지입니다.</p>}
      </section>

      <section className="panel mission-panel">
        <h3>이번 주 실천 미션</h3>
        <p>{coaching.weeklyMission}</p>
      </section>

      <section className="panel mission-panel">
        <h3>다음 보상/등급 힌트</h3>
        <p>{getMissionHint(metrics)}</p>
      </section>

      <section className="panel">
        <h3>시간대별 활동량</h3>
        <div className="bar-list">
          {segments.map((segment) => (
            <div className="bar-row" key={segment}>
              <span>{segment}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(metrics.segmentCompleted[segment] / maxSegment) * 100}%` }} />
              </div>
              <strong>{metrics.segmentCompleted[segment]}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>배달타입별 비율</h3>
        <div className="bar-list">
          {deliveryTypes.map((deliveryType) => (
            <div className="bar-row" key={deliveryType}>
              <span>{deliveryType}</span>
              <div className="bar-track">
                <div className="bar-fill teal" style={{ width: `${(metrics.deliveryTypeCompleted[deliveryType] / maxDeliveryType) * 100}%` }} />
              </div>
              <strong>{metrics.deliveryTypeCompleted[deliveryType]}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>주요 강점</h3>
        <div className="tag-cloud">{coaching.strengths.map((item) => <span key={item}>{item}</span>)}</div>
      </section>

      <section className="panel">
        <h3>개선 포인트</h3>
        <div className="tag-cloud warning-tags">
          {(coaching.weaknesses.length ? coaching.weaknesses : ["현재 뚜렷한 취약 항목이 없습니다."]).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
