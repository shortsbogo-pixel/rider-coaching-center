import { useEffect, useMemo, useState } from "react";
import type { OperationLogEntry, OperationLogFilter } from "../../types/operation";
import { operationApi } from "../../utils/operationApi";

const filterOptions: Array<{ value: OperationLogFilter; label: string; actionTypes?: string[] }> = [
  { value: "all", label: "전체" },
  {
    value: "ai-coaching",
    label: "AI 코칭",
    actionTypes: [
      "AI_COACHING_GENERATED",
      "AI_COACHING_REGENERATED",
      "MESSAGE_COPIED",
      "AI_STATUS_CHECKED",
      "MESSAGE_QUEUE_ADDED",
      "MESSAGE_QUEUE_KAKAO_COPIED",
      "MESSAGE_QUEUE_SMS_COPIED",
      "MESSAGE_SEND_COMPLETED",
      "MESSAGE_QUEUE_HELD",
      "MESSAGE_QUEUE_DELETED",
      "MESSAGE_QUEUE_MEMO_UPDATED"
    ]
  },
  { value: "checklist", label: "체크리스트", actionTypes: ["CHECKLIST_UPDATED"] },
  { value: "briefing", label: "브리핑", actionTypes: ["WEEKLY_BRIEFING_GENERATED"] },
  { value: "report", label: "리포트", actionTypes: ["MONTHLY_REPORT_GENERATED"] },
  { value: "backup", label: "백업/복원", actionTypes: ["BACKUP_DOWNLOADED", "DATA_RESTORED", "CSV_EXPORTED", "LOCAL_DATA_MIGRATED"] }
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function actionLabel(actionType: string) {
  const labels: Record<string, string> = {
    AI_COACHING_GENERATED: "AI 코칭 생성",
    AI_COACHING_REGENERATED: "AI 코칭 재생성",
    MESSAGE_COPIED: "문구 복사",
    CHECKLIST_UPDATED: "체크리스트 변경",
    WEEKLY_BRIEFING_GENERATED: "주간 브리핑",
    MONTHLY_REPORT_GENERATED: "월간 리포트",
    BACKUP_DOWNLOADED: "백업 다운로드",
    DATA_RESTORED: "데이터 복원",
    CSV_EXPORTED: "CSV 내보내기",
    AI_STATUS_CHECKED: "AI 상태 점검",
    LOCAL_DATA_MIGRATED: "로컬 데이터 이전",
    MESSAGE_QUEUE_ADDED: "발송 대기함 추가",
    MESSAGE_QUEUE_KAKAO_COPIED: "카톡 문구 복사",
    MESSAGE_QUEUE_SMS_COPIED: "문자 문구 복사",
    MESSAGE_SEND_COMPLETED: "발송완료 처리",
    MESSAGE_QUEUE_HELD: "보류 처리",
    MESSAGE_QUEUE_DELETED: "발송 대기 삭제",
    MESSAGE_QUEUE_MEMO_UPDATED: "메모 수정"
  };
  return labels[actionType] ?? actionType;
}

export function OperationLogsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [logs, setLogs] = useState<OperationLogEntry[]>([]);
  const [filter, setFilter] = useState<OperationLogFilter>("all");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    operationApi
      .getLogs()
      .then((items) => {
        if (mounted) {
          setLogs(items);
          setErrorMessage("");
        }
      })
      .catch(() => {
        if (mounted) setErrorMessage("운영 로그를 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const visibleLogs = useMemo(() => {
    const option = filterOptions.find((item) => item.value === filter);
    if (!option?.actionTypes) return logs;
    return logs.filter((log) => option.actionTypes?.includes(log.actionType));
  }, [filter, logs]);

  return (
    <section className="panel operation-logs-panel">
      <div className="operation-panel-title">
        <div>
          <h3>운영 로그 보기</h3>
          <p>관리자 주요 작업을 최신순으로 기록합니다.</p>
        </div>
        <label className="field operation-log-filter">
          <span>필터</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as OperationLogFilter)}>
            {filterOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage ? (
        <p className="operation-error-message">{errorMessage}</p>
      ) : (
        <div className="operation-log-list">
          {visibleLogs.length ? (
            visibleLogs.slice(0, 30).map((log) => (
              <article className="operation-log-card" key={log.id}>
                <div>
                  <strong>{actionLabel(log.actionType)}</strong>
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
                <p>{log.summary}</p>
                <small>
                  {log.actorName} · {log.actorRole}
                  {log.riderName ? ` · ${log.riderName}` : ""}
                  {log.weekKey ? ` · ${log.weekKey}` : ""}
                  {log.monthKey ? ` · ${log.monthKey}` : ""}
                </small>
              </article>
            ))
          ) : (
            <p className="operation-empty-message">아직 운영 로그가 없습니다.</p>
          )}
        </div>
      )}
    </section>
  );
}
