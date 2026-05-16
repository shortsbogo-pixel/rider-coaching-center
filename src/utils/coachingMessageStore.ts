import type { CustomCoachingMessage } from "../types/coaching";
import { getAuthHeader } from "./authStore";

export async function fetchCustomCoachingMessages(weekKey?: string): Promise<CustomCoachingMessage[]> {
  const query = weekKey ? `?weekKey=${encodeURIComponent(weekKey)}` : "";
  const response = await fetch(`/api/custom-coaching${query}`, { headers: getAuthHeader() });
  if (!response.ok) throw new Error("저장된 코칭 메시지를 불러오지 못했습니다.");
  return (await response.json()) as CustomCoachingMessage[];
}

export async function fetchCustomCoachingMessage(riderId: string, weekKey?: string): Promise<CustomCoachingMessage | null> {
  const query = weekKey ? `?weekKey=${encodeURIComponent(weekKey)}` : "";
  const response = await fetch(`/api/custom-coaching/${encodeURIComponent(riderId)}${query}`, { headers: getAuthHeader() });
  if (!response.ok) throw new Error("저장된 코칭 메시지를 불러오지 못했습니다.");
  return (await response.json()) as CustomCoachingMessage | null;
}

export async function saveCustomCoachingMessage(input: {
  riderId: string;
  riderName: string;
  weekKey: string;
  autoMessage: string;
  customMessage: string;
}): Promise<CustomCoachingMessage> {
  const response = await fetch(`/api/custom-coaching/${encodeURIComponent(input.riderId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error("코칭 메시지를 저장하지 못했습니다.");
  return (await response.json()) as CustomCoachingMessage;
}

export async function resetCustomCoachingMessage(riderId: string, weekKey: string): Promise<void> {
  const response = await fetch(
    `/api/custom-coaching/${encodeURIComponent(riderId)}?weekKey=${encodeURIComponent(weekKey)}`,
    { method: "DELETE", headers: getAuthHeader() }
  );
  if (!response.ok) throw new Error("자동 생성 메시지로 되돌리지 못했습니다.");
}
