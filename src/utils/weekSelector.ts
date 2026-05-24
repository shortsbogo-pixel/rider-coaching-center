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

export function sortWeekKeys(weeks: string[]) {
  return [...weeks].sort((a, b) => parseWeekValue(b) - parseWeekValue(a) || b.localeCompare(a, "ko"));
}

export function getLatestWeekKey(weeks: string[]) {
  return sortWeekKeys(weeks.filter(Boolean))[0] ?? "";
}

export function selectCoachingWeek(orders: OrderRecord[], preferredWeek?: string): SelectedWeek | null {
  const weeks = [...new Set(orders.map((order) => order.week))].filter(Boolean);
  if (!weeks.length) return null;
  const requestedWeek = preferredWeek?.trim();

  if (requestedWeek && weeks.includes(requestedWeek)) {
    return {
      week: requestedWeek,
      isFallback: false,
      reason: `${requestedWeek} 데이터를 기준으로 코칭 메시지를 생성합니다.`
    };
  }

  const fallback = getLatestWeekKey(weeks);
  return {
    week: fallback,
    isFallback: Boolean(requestedWeek),
    reason: requestedWeek
      ? `${requestedWeek} 데이터가 없어 가장 최근 업로드 주차인 ${fallback} 기준으로 생성합니다.`
      : `${fallback} 데이터를 기준으로 코칭 메시지를 생성합니다.`
  };
}
