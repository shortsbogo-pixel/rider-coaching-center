import { useMemo, useState } from "react";
import {
  checklistCompletion,
  managerActionChecklistItems,
  readManagerActionChecklist,
  saveManagerActionChecklist,
  type ManagerActionChecklistRecord,
  type ManagerActionChecklistItemId
} from "../../utils/managerActionChecklist";

interface ManagerActionChecklistProps {
  riderName: string;
  weekKey: string;
  onSaved?: (record: ManagerActionChecklistRecord) => void;
  onSaveRecord?: (record: ManagerActionChecklistRecord) => Promise<boolean>;
}

function statusLabel(status: ReturnType<typeof checklistCompletion>["status"]) {
  if (status === "completed") return "관리 완료";
  if (status === "in-progress") return "진행 중";
  return "미진행";
}

export function ManagerActionChecklist({ riderName, weekKey, onSaved, onSaveRecord }: ManagerActionChecklistProps) {
  const initialRecord = useMemo(() => readManagerActionChecklist(riderName, weekKey), [riderName, weekKey]);
  const [checkedItems, setCheckedItems] = useState<ManagerActionChecklistItemId[]>(initialRecord.checkedItems);
  const completion = checklistCompletion(checkedItems);

  async function persist(next: ManagerActionChecklistItemId[]) {
    const record: ManagerActionChecklistRecord = {
      riderName,
      weekKey,
      checkedItems: next,
      updatedAt: new Date().toISOString()
    };
    const serverSaved = onSaveRecord ? await onSaveRecord(record) : false;
    if (!serverSaved) {
      saveManagerActionChecklist(riderName, weekKey, next);
    }
    onSaved?.(record);
  }

  function toggleItem(itemId: ManagerActionChecklistItemId) {
    const next = checkedItems.includes(itemId) ? checkedItems.filter((id) => id !== itemId) : [...checkedItems, itemId];
    setCheckedItems(next);
    void persist(next);
  }

  return (
    <details className="manager-action-checklist">
      <summary>
        <span>관리 액션 {completion.checkedCount}/{completion.totalCount} 완료</span>
        <b className={`manager-action-badge ${completion.status}`}>{statusLabel(completion.status)}</b>
      </summary>
      <div className="manager-action-checklist-body">
        {managerActionChecklistItems.map((item) => (
          <label className="manager-action-item" key={item.id}>
            <input
              type="checkbox"
              checked={checkedItems.includes(item.id)}
              onChange={() => toggleItem(item.id)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
