const MANAGER_ACTION_CHECKLIST_KEY = "rider-coaching-manager-actions-v1";

export const managerActionChecklistItems = [
  { id: "available-time", label: "라이더 활동 가능 시간 확인" },
  { id: "post-lunch-night", label: "포스트런치/야간 이탈 여부 확인" },
  { id: "two-week-flow", label: "최근 2주 완료건수 흐름 확인" },
  { id: "mission-fit", label: "미션 참여 가능성 확인" },
  { id: "send-message", label: "라이더에게 전달 문구 발송 완료" }
] as const;

export type ManagerActionChecklistItemId = (typeof managerActionChecklistItems)[number]["id"];
export type ManagerActionChecklistStatus = "not-started" | "in-progress" | "completed";

export interface ManagerActionChecklistRecord {
  riderName: string;
  weekKey: string;
  checkedItems: ManagerActionChecklistItemId[];
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function recordKey(riderName: string, weekKey: string) {
  return `${riderName.trim()}::${weekKey.trim()}`;
}

function validCheckedItems(items: unknown): ManagerActionChecklistItemId[] {
  if (!Array.isArray(items)) return [];
  const validIds = new Set(managerActionChecklistItems.map((item) => item.id));
  return items.filter((item): item is ManagerActionChecklistItemId => typeof item === "string" && validIds.has(item as ManagerActionChecklistItemId));
}

export function readManagerActionChecklistRecords(storage?: StorageLike): ManagerActionChecklistRecord[] {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return [];
    const raw = targetStorage.getItem(MANAGER_ACTION_CHECKLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((record): record is ManagerActionChecklistRecord => {
        const item = record as Partial<ManagerActionChecklistRecord>;
        return typeof item.riderName === "string" && typeof item.weekKey === "string" && typeof item.updatedAt === "string";
      })
      .map((record) => ({
        ...record,
        checkedItems: validCheckedItems(record.checkedItems)
      }));
  } catch {
    return [];
  }
}

export function readManagerActionChecklist(riderName: string, weekKey: string, storage?: StorageLike): ManagerActionChecklistRecord {
  const key = recordKey(riderName, weekKey);
  const record = readManagerActionChecklistRecords(storage).find((item) => recordKey(item.riderName, item.weekKey) === key);
  return record ?? { riderName, weekKey, checkedItems: [], updatedAt: "" };
}

export function saveManagerActionChecklist(
  riderName: string,
  weekKey: string,
  checkedItems: ManagerActionChecklistItemId[],
  storage?: StorageLike
): boolean {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage) return false;
    const key = recordKey(riderName, weekKey);
    const nextRecord: ManagerActionChecklistRecord = {
      riderName,
      weekKey,
      checkedItems: validCheckedItems(checkedItems),
      updatedAt: new Date().toISOString()
    };
    const nextRecords = [
      ...readManagerActionChecklistRecords(targetStorage).filter((record) => recordKey(record.riderName, record.weekKey) !== key),
      nextRecord
    ];
    targetStorage.setItem(MANAGER_ACTION_CHECKLIST_KEY, JSON.stringify(nextRecords));
    return true;
  } catch {
    return false;
  }
}

export function checklistCompletion(checkedItems: string[], totalCount = managerActionChecklistItems.length) {
  const checkedCount = Math.min(validCheckedItems(checkedItems).length, totalCount);
  const status: ManagerActionChecklistStatus = checkedCount === 0 ? "not-started" : checkedCount >= totalCount ? "completed" : "in-progress";
  return { checkedCount, totalCount, status };
}
