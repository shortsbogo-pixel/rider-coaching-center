import { Clock, Target, TrendingUp, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import orders from "../data/sampleOrders.json";
import riders from "../data/sampleRiders.json";
import { SectionHeader } from "../components/common/SectionHeader";
import type { OrderRecord } from "../types/order";
import type { RiderMetrics, RiderProfile } from "../types/rider";
import { getAuthHeader } from "../utils/authStore";
import { buildRiderMetrics, getGradeLabel } from "../utils/scoring";

const fallbackMetrics = buildRiderMetrics(orders as OrderRecord[], riders as RiderProfile[]);

function buildMissionCards(metrics: RiderMetrics[]) {
  const totalRiders = metrics.length;
  const postLunchTargets = metrics.filter((metric) => metric.postLunchRate < 0.15);
  const postDinnerTargets = metrics.filter((metric) => metric.postDinnerRate < 0.15);
  const gradeUpTargets = metrics.filter((metric) => metric.gradeProgress.remainingToNext > 0 && metric.gradeProgress.remainingToNext <= 30);
  const managementTargets = metrics.filter((metric) => metric.riderGrade === "MANAGEMENT_TARGET");
  const sClassCount = metrics.filter((metric) => metric.riderGrade === "S").length;

  return [
    {
      title: "Post_Lunch 보강 미션",
      type: "14:00~16:30",
      description: "Post_Lunch 참여율이 낮은 라이더에게 2~3콜 유지 미션을 추천합니다.",
      target: `${postLunchTargets.length}명`,
      impact: "배차 신뢰도 유지",
      priority: postLunchTargets.length > totalRiders * 0.3 ? "HIGH" : "MEDIUM",
      icon: Zap
    },
    {
      title: "Post_Dinner 유지 미션",
      type: "20:00 이후",
      description: "저녁 피크 이후 이탈이 빠른 라이더에게 짧은 추가 운행 미션을 추천합니다.",
      target: `${postDinnerTargets.length}명`,
      impact: "주간 완료건수 방어",
      priority: postDinnerTargets.length > totalRiders * 0.3 ? "HIGH" : "MEDIUM",
      icon: Clock
    },
    {
      title: "등급 승급 미션",
      type: "다음 등급까지 30건 이하",
      description: "다음 등급이 가까운 라이더에게 남은 건수 기반 개인 목표를 제안합니다.",
      target: `${gradeUpTargets.length}명`,
      impact: "S/A/B/C 등급 상승",
      priority: "MEDIUM",
      icon: Target
    },
    {
      title: "관리대상 회복 미션",
      type: "150건 미만",
      description: "관리대상 라이더에게 기본 활동량 회복과 피크타임 재진입 미션을 제안합니다.",
      target: `${managementTargets.length}명`,
      impact: "이탈 방지",
      priority: managementTargets.length ? "HIGH" : "LOW",
      icon: Users
    },
    {
      title: "S급 유지 미션",
      type: "300건 이상",
      description: "상위권 라이더에게 포스트구간 유지와 멀티 품질 관리 중심의 유지 미션을 추천합니다.",
      target: `${sClassCount}명`,
      impact: "핵심 라이더 유지",
      priority: "MEDIUM",
      icon: TrendingUp
    }
  ];
}

export function MissionRecommendPage() {
  const [metrics, setMetrics] = useState<RiderMetrics[]>(fallbackMetrics);

  useEffect(() => {
    fetch("/api/riders", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => setMetrics(data as RiderMetrics[]))
      .catch(() => setMetrics(fallbackMetrics));
  }, []);

  const cards = buildMissionCards(metrics);
  const topGradeUpTargets = metrics
    .filter((metric) => metric.gradeProgress.remainingToNext > 0)
    .sort((a, b) => a.gradeProgress.remainingToNext - b.gradeProgress.remainingToNext)
    .slice(0, 8);

  return (
    <div className="page-stack">
      <SectionHeader title="미션 추천" description="캔버스 기획의 미션 추천 흐름을 실제 라이더 데이터 기준으로 재구성했습니다." />

      <div className="mission-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <section className="mission-card" key={card.title}>
              <div className="mission-card-top">
                <Icon size={22} />
                <span className={`mission-priority ${card.priority.toLowerCase()}`}>{card.priority}</span>
              </div>
              <p>{card.type}</p>
              <h3>{card.title}</h3>
              <span>{card.description}</span>
              <div className="mission-card-stats">
                <b>{card.target}</b>
                <small>{card.impact}</small>
              </div>
            </section>
          );
        })}
      </div>

      <section className="panel">
        <h3>다음 등급 근접 라이더</h3>
        <div className="rider-list">
          {topGradeUpTargets.map((metric) => (
            <article className="list-card" key={metric.riderId}>
              <div>
                <strong>{metric.displayName}</strong>
                <span>{getGradeLabel(metric.riderGrade)} · {metric.totalCompleted}건</span>
              </div>
              <div className="list-card-right">
                <b>{metric.gradeProgress.remainingToNext}건</b>
                <span>{metric.gradeProgress.nextLabel ?? "최상위"}까지</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
