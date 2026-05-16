import { getAuthHeader } from "../utils/authStore";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: getAuthHeader() });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

export function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
