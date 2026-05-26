import type { LocalAICoachingHistoryEntry } from "../types/aiCoaching";
import { checklistCompletion, type ManagerActionChecklistRecord } from "./managerActionChecklist";

const BOM = "\ufeff";

function csvValue(value: unknown) {
  const text = value == null ? "" : Array.isArray(value) ? value.join("|") : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return `${BOM}${[headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n")}`;
}

export function createAICoachingHistoryCsv(entries: LocalAICoachingHistoryEntry[]) {
  const headers = [
    "riderName",
    "weekKey",
    "riskLevel",
    "previousWeekCompleted",
    "currentWeekCompleted",
    "changeRate",
    "adminMessage",
    "riderMessage",
    "isTemplate",
    "source",
    "createdAt"
  ];

  return toCsv(
    headers,
    entries.map((entry) => [
      entry.riderName,
      entry.weekKey,
      entry.riskLevel,
      entry.previousWeekCompleted,
      entry.currentWeekCompleted,
      entry.changeRate,
      entry.adminMessage,
      entry.riderMessage,
      entry.isTemplate,
      entry.source,
      entry.createdAt
    ])
  );
}

export function createManagerActionsCsv(records: ManagerActionChecklistRecord[]) {
  const headers = ["riderName", "weekKey", "checkedItems", "checkedCount", "status", "updatedAt"];
  return toCsv(
    headers,
    records.map((record) => {
      const completion = checklistCompletion(record.checkedItems);
      return [record.riderName, record.weekKey, record.checkedItems, completion.checkedCount, completion.status, record.updatedAt];
    })
  );
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
