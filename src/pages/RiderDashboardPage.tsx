import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import orders from "../data/sampleOrders.json";
import riders from "../data/sampleRiders.json";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { RiderDataInsight } from "../components/rider/RiderDataInsight";
import { ScoreRing } from "../components/rider/ScoreRing";
import { useAuth } from "../hooks/useAuth";
import type { CustomCoachingMessage } from "../types/coaching";
import type { OrderRecord } from "../types/order";
import type { RiderMetrics, RiderProfile } from "../types/rider";
import { generateCoachingMessage } from "../utils/coachingGenerator";
import { getAuthHeader } from "../utils/authStore";
import { fetchCustomCoachingMessage, fetchCustomCoachingMessages } from "../utils/coachingMessageStore";
import { buildRiderMetrics, getGradeLabel } from "../utils/scoring";
import { getLatestWeekKey, sortWeekKeys } from "../utils/weekSelector";

const fallbackMetrics = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[]);
interface UploadedWeek {
  week: string;
  weekKey?: string;
}

function buildWeekQuery(weekKey?: string) {
  return weekKey ? `?weekKey=${encodeURIComponent(weekKey)}` : "";
}

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
  const [uploadedWeeks, setUploadedWeeks] = useState<UploadedWeek[]>([]);
  const [activeWeekKey, setActiveWeekKey] = useState("");
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
    let ignore = false;

    fetch("/api/uploads")
      .then((response) => response.json())
      .then((data) => {
        if (ignore) return;
        const weeks = ((data.weeks ?? []) as UploadedWeek[])
          .map((item) => ({
            ...item,
            week: item.weekKey ?? item.week
          }))
          .filter((item) => item.week);
        const weekKeys = weeks.map((item) => item.week);
        const requestedWeek = queryWeekKey && weekKeys.includes(queryWeekKey) ? queryWeekKey : "";
        const nextWeek = requestedWeek || getLatestWeekKey(weekKeys);
        setUploadedWeeks(weeks);
        if (nextWeek) {
          setActiveWeekKey(nextWeek);
        }
      })
      .catch(() => {
        if (queryWeekKey) setActiveWeekKey(queryWeekKey);
      });

    return () => {
      ignore = true;
    };
  }, [queryWeekKey]);

  useEffect(() => {
    if (!activeWeekKey) return;
    const weekQuery = buildWeekQuery(activeWeekKey);
    const riderUrl =
      user?.role === "rider" && user.riderId ? `/api/riders/${encodeURIComponent(user.riderId)}${weekQuery}` : `/api/riders${weekQuery}`;
    fetch(riderUrl, { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => {
        const next = Array.isArray(data) ? (data as RiderMetrics[]) : ([data] as RiderMetrics[]);
        const resolved = next.filter((item) => item?.riderId);
        setMetricsList(resolved);
        setLinkMessage("");

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
        setSelectedId((current) => (resolved.some((item) => item.riderId === current) ? current : resolved[0]?.riderId ?? ""));
      })
      .catch(() => setMetricsList(fallbackMetrics));
  }, [activeWeekKey, queryRiderId, queryRiderName, user]);

  useEffect(() => {
    if (!activeWeekKey) return;
    fetch(`/api/coaching${buildWeekQuery(activeWeekKey)}`, { headers: getAuthHeader() })
      .then((response) => response.json())
      .then(async (data) => {
        const week = data?.basisWeek || activeWeekKey;
        setBasisWeek(week);
        if (week && week !== activeWeekKey) {
          setActiveWeekKey(week);
        }
        if (user?.role === "rider" && user.riderId) {
          const message = await fetchCustomCoachingMessage(user.riderId, week);
          return message ? [message] : [];
        }
        return fetchCustomCoachingMessages(week);
      })
      .then(setCustomMessages)
      .catch(() => setCustomMessages([]));
  }, [activeWeekKey, user]);

  if (riderQueryMismatch) {
    return <Navigate to="/rider" replace />;
  }

  const metrics = metricsList.find((item) => item.riderId === selectedId);
  const coaching = useMemo(() => (metrics ? generateCoachingMessage(metrics) : undefined), [metrics]);
  const savedCustom = customMessages.find(
    (message) => message.riderId === metrics?.riderId && (!basisWeek || message.weekKey === basisWeek) && message.isCustom
  );
  const weekOptions = sortWeekKeys(uploadedWeeks.map((item) => item.week));
  const selectedWeekKey = activeWeekKey || basisWeek;
  const visibleWeekOptions =
    selectedWeekKey && !weekOptions.includes(selectedWeekKey) ? [selectedWeekKey, ...weekOptions] : weekOptions;

  if (!metrics || !coaching) {
    return (
      <div className="page-stack">
        <SectionHeader title="라이더 전용 화면" description="로그인한 라이더와 연결된 운행 데이터가 없습니다. 관리자에게 계정 매핑을 확인해 주세요." />
      </div>
    );
  }

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
        {selectedWeekKey ? <p className="note-text">코칭 메시지 기준 주차: {selectedWeekKey}</p> : null}
        {linkMessage ? <p className="note-text">{linkMessage}</p> : null}
      </section>

      <section className="panel sticky-selector rider-selector-panel">
        <label className="field">
          <span>기준 주차</span>
          <select value={selectedWeekKey} onChange={(event) => setActiveWeekKey(event.target.value)} disabled={!visibleWeekOptions.length}>
            {visibleWeekOptions.length ? (
              visibleWeekOptions.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))
            ) : (
              <option value="">업로드 주차 없음</option>
            )}
          </select>
        </label>

        {isAdminPreview ? (
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
        ) : null}
      </section>

      <RiderDataInsight
        metrics={metrics}
        weekKey={selectedWeekKey}
        missionHint={getMissionHint(metrics)}
        strengths={coaching.strengths}
        weaknesses={coaching.weaknesses}
        showValidationDetails={false}
      />

      <section className="hero-card">
        <div>
          <p>내 배차 친화 점수</p>
          <h2>{metrics.displayName}</h2>
          <span>
            {getGradeLabel(metrics.riderGrade)} · {coaching.riskLevel} · {selectedWeekKey || "최근 데이터"} {metrics.totalCompleted}건
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

    </div>
  );
}
