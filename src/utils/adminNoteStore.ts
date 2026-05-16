import type { AdminNote } from "../types/adminNote";
import { getAuthHeader } from "./authStore";

export async function fetchAdminNotes(weekKey?: string): Promise<AdminNote[]> {
  const query = weekKey ? `?weekKey=${encodeURIComponent(weekKey)}` : "";
  const response = await fetch(`/api/admin-notes${query}`, { headers: getAuthHeader() });
  if (!response.ok) throw new Error("관리자 메모를 불러오지 못했습니다.");
  return (await response.json()) as AdminNote[];
}

export async function saveAdminNote(input: {
  riderId: string;
  riderName: string;
  weekKey: string;
  note: string;
  updatedBy?: string;
}): Promise<AdminNote> {
  const response = await fetch(`/api/admin-notes/${encodeURIComponent(input.riderId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error("관리자 메모를 저장하지 못했습니다.");
  return (await response.json()) as AdminNote;
}
