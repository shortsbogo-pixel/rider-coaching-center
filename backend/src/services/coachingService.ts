import { generateCoachingMessage } from "../../../src/utils/coachingGenerator";
import { buildRiderMetrics } from "../../../src/utils/scoring";
import { selectCoachingWeek } from "../../../src/utils/weekSelector";
import riders from "../../../src/data/sampleRiders.json";
import type { RiderProfile } from "../../../src/types/rider";
import { getAnalysisOrders, getRiderMetrics } from "./analysisService";

export async function getCoachingMessages(weekKey?: string) {
  const orders = await getAnalysisOrders();
  const selectedWeek = selectCoachingWeek(orders, weekKey);
  if (!selectedWeek) {
    const fallbackMetrics = await getRiderMetrics();
    return {
      basisWeek: "",
      isFallbackWeek: false,
      notice: "분석할 업로드 데이터가 없어 샘플 기준 코칭을 표시합니다.",
      messages: fallbackMetrics.map((metric) => generateCoachingMessage(metric))
    };
  }

  const basisOrders = orders.filter((order) => order.week === selectedWeek.week);
  const metrics = buildRiderMetrics(basisOrders, riders as RiderProfile[]);
  const topCompletedThreshold = metrics[Math.min(4, metrics.length - 1)]?.totalCompleted ?? Number.POSITIVE_INFINITY;

  return {
    basisWeek: selectedWeek.week,
    isFallbackWeek: selectedWeek.isFallback,
    notice: selectedWeek.reason,
    messages: metrics.map((metric) =>
      generateCoachingMessage(metric, {
        basisWeek: selectedWeek.week,
        isFallbackWeek: selectedWeek.isFallback,
        topCompletedThreshold
      })
    )
  };
}
