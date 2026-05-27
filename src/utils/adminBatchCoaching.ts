import type { LocalAICoachingHistoryEntry } from "../types/aiCoaching";

interface BatchResultLike {
  riderId: string;
  adminMessage?: string;
  riderMessage?: string;
  error?: string;
}

interface BatchSourceLike {
  riderId: string;
  riderName: string;
}

interface BatchBlockInput {
  selectedWeekKey: string;
  itemCount: number;
  parsedErrorCount: number;
}

function isJsonParseError(error?: string) {
  return /JSON|Unexpected non-whitespace|parsed/i.test(error ?? "");
}

export function getBatchBlockReason({ selectedWeekKey, itemCount, parsedErrorCount }: BatchBlockInput) {
  if (parsedErrorCount > 0) {
    return `JSON 파싱 오류 ${parsedErrorCount}건이 있어 전체 AI 코칭 생성에서 제외했습니다. parsed 초기화 후 엑셀을 다시 업로드하세요.`;
  }
  if (!selectedWeekKey.trim()) return "기준 주차를 먼저 선택하세요.";
  if (itemCount <= 0) return "전체 AI 코칭을 생성할 최신 분석 데이터가 없습니다. 엑셀을 다시 업로드하세요.";
  return "";
}

export function isSuccessfulBatchResult(result: BatchResultLike) {
  return !result.error && typeof result.adminMessage === "string" && typeof result.riderMessage === "string";
}

export function getBatchFailure(result: BatchResultLike, source?: BatchSourceLike) {
  return {
    riderId: result.riderId,
    riderName: source?.riderName ?? result.riderId,
    error: isJsonParseError(result.error) ? "재업로드 필요: JSON 파싱 오류가 남아 있습니다." : result.error ?? "알 수 없는 오류"
  };
}

export function filterHistoryForVisibleRiders<T extends Pick<LocalAICoachingHistoryEntry, "riderName" | "weekKey">>(
  history: T[],
  weekKey: string,
  riderNames: string[]
) {
  const targetWeek = weekKey.trim();
  const visibleNames = new Set(riderNames.map((name) => name.trim()).filter(Boolean));
  return history.filter((entry) => entry.weekKey.trim() === targetWeek && visibleNames.has(entry.riderName.trim()));
}
