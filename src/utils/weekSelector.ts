import type { OrderRecord } from "../types/order";

export interface SelectedWeek {
  week: string;
  isFallback: boolean;
  reason: string;
}

function parseWeekValue(week: string) {
  const month = Number(week.match(/(\d+)월/)?.[1] ?? 0);
  const weekNo = Number(week.match(/(\d+)주차/)?.[1] ?? 0);
  return month * 10 + weekNo;
}

export function selectCoachingWeek(orders: OrderRecord[], preferredWeek = "5월2주차"): SelectedWeek | null {
  const weeks = [...new Set(orders.map((order) => order.week))].filter(Boolean);
  if (!weeks.length) return null;
  if (weeks.includes(preferredWeek)) {
    return {
      week: preferredWeek,
      isFallback: false,
      reason: `${preferredWeek} 데이터를 기준으로 코칭 메시지를 생성합니다.`
    };
  }
  const fallback = weeks.sort((a, b) => parseWeekValue(b) - parseWeekValue(a))[0];
  return {
    week: fallback,
    isFallback: true,
    reason: `${preferredWeek} 데이터가 없어 가장 최근 업로드 주차인 ${fallback} 기준으로 생성합니다.`
  };
}
