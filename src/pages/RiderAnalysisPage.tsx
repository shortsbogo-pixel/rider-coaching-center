import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import orders from "../data/sampleOrders.json";
import riders from "../data/sampleRiders.json";
import { RiskBadge } from "../components/admin/RiskBadge";
import { SectionHeader } from "../components/common/SectionHeader";
import { RiderDataInsight } from "../components/rider/RiderDataInsight";
import type { AdminNote } from "../types/adminNote";
import type { OrderRecord } from "../types/order";
import type { RiderMetrics, RiderProfile } from "../types/rider";
import { fetchAdminNotes } from "../utils/adminNoteStore";
import { getAuthHeader } from "../utils/authStore";
import { generateCoachingMessage } from "../utils/coachingGenerator";
import { buildRiderMetrics, getGradeLabel } from "../utils/scoring";

const fallbackMetrics = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[]);

function getMissionHint(metrics: RiderMetrics) {
  if (metrics.postLunchRate < 0.15) return "Post_Lunch 14:00~16:30 구간에서 2~3콜을 추가 목표로 잡아보세요.";
  if (metrics.postDinnerRate < 0.15) return "Post_Dinner 구간에서 짧게라도 운행을 이어가면 다음 등급 방어에 유리합니다.";
  if (metrics.gradeProgress.remainingToNext > 0) {
    return `${metrics.gradeProgress.nextLabel}까지 ${metrics.gradeProgress.remainingToNext}건 남았습니다. 피크타임 이후 구간을 붙여 완성도를 높여보세요.`;
  }
  return "현재 S급 기준에 도달했습니다. 멀티배달과 포스트구간 유지가 핵심입니다.";
}

export function RiderAnalysisPage() {
  const [metrics, setMetrics] = useState<RiderMetrics[]>(fallbackMetrics);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(fallbackMetrics[0]?.riderId ?? "");
  const [basisWeek, setBasisWeek] = useState("");

  useEffect(() => {
    fetch("/api/riders", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => {
        const next = data as RiderMetrics[];
        const resolved = next.length ? next : fallbackMetrics;
        setMetrics(resolved);
        setSelectedId(resolved[0]?.riderId ?? "");
      })
      .catch(() => setMetrics(fallbackMetrics));

    fetch("/api/coaching", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => {
        const week = data?.basisWeek || "";
        setBasisWeek(week);
        return fetchAdminNotes(week || undefined);
      })
      .then(setNotes)
      .catch(() => setNotes([]));
  }, []);

  const filteredMetrics = useMemo(
    () => metrics.filter((metric) => metric.displayName.includes(searchTerm) || metric.baseName.includes(searchTerm)),
    [metrics, searchTerm]
  );
  const selected = metrics.find((metric) => metric.riderId === selectedId) ?? filteredMetrics[0] ?? metrics[0];
  const noteByRider = useMemo(() => new Map(notes.map((note) => [note.riderId, note])), [notes]);
  const selectedNote = selected ? noteByRider.get(selected.riderId) : undefined;
  const selectedCoaching = useMemo(() => (selected ? generateCoachingMessage(selected) : undefined), [selected]);

  return (
    <div className="page-stack">
      <SectionHeader
        title="라이더 랭킹 분석"
        description="완료건수 랭킹 기준 정렬입니다. 라이더를 선택하면 상세 코칭 힌트와 관리자 메모 상태를 볼 수 있습니다."
      />

      <section className="panel">
        <label className="search-field">
          <Search size={18} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="라이더 이름 검색" />
        </label>
      </section>

      <div className="analysis-layout">
        <div className="analysis-list">
          {filteredMetrics.map((metric, index) => {
            const hasNote = noteByRider.has(metric.riderId);
            return (
              <button
                className={`analysis-button ${selected?.riderId === metric.riderId ? "selected" : ""}`}
                key={metric.riderId}
                type="button"
                onClick={() => setSelectedId(metric.riderId)}
              >
                <div>
                  <strong>
                    {index + 1}. {metric.displayName}
                  </strong>
                  <span>
                    {getGradeLabel(metric.riderGrade)} · {metric.totalCompleted}건 · 멀티 {Math.round(metric.multiDeliveryRate * 100)}%
                  </span>
                  {hasNote ? <span className="inline-badge">메모 있음</span> : null}
                </div>
                <RiskBadge level={metric.riskLevel} />
              </button>
            );
          })}
        </div>

        {selected && selectedCoaching ? (
          <div className="analysis-detail-stack">
          <section className="panel rider-detail-panel">
            <div className="analysis-title">
              <div>
                <h3>{selected.displayName}</h3>
                <p>
                  {getGradeLabel(selected.riderGrade)} · 배차 친화 {selected.dispatchScore}점
                </p>
              </div>
              <RiskBadge level={selected.riskLevel} />
            </div>

            <div className="tag-cloud">
              <span>{selected.validationStatus === "AUTO_ANALYSIS_TARGET" ? "자동 분석 대상" : "기존 라이더 매칭"}</span>
              <span>다음 등급까지 {selected.gradeProgress.remainingToNext}건</span>
              <span>메모 상태: {selectedNote ? "메모 있음" : "메모 없음"}</span>
              <span>누락 지표: {selected.missingMetrics.length ? selected.missingMetrics.join(", ") : "없음"}</span>
            </div>
          </section>

          <RiderDataInsight
            metrics={selected}
            weekKey={basisWeek}
            missionHint={getMissionHint(selected)}
            strengths={selectedCoaching.strengths}
            weaknesses={selectedCoaching.weaknesses}
          />

            {selectedNote ? (
              <section className="panel note-panel">
                <strong>관리자 메모</strong>
                <p>{selectedNote.note}</p>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
