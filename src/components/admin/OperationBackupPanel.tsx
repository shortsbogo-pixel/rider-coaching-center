import { useRef, useState } from "react";
import type { LocalAICoachingHistoryEntry } from "../../types/aiCoaching";
import type { MessageQueueItem, MessageSendHistoryEntry } from "../../types/messageQueue";
import type { OperationActionType } from "../../types/operation";
import type { OperationLogEntry } from "../../types/operation";
import type { LocalOperationBriefingEntry } from "../../types/operationBriefing";
import type { ManagerActionChecklistRecord } from "../../utils/managerActionChecklist";
import type { LocalMonthlyReportEntry } from "../../utils/monthlyReportHistory";
import { createAICoachingHistoryCsv, createManagerActionsCsv, downloadTextFile } from "../../utils/exportCsv";
import { createOperationBackup, getDateStamp, restoreOperationBackup, type OperationRestoreMode } from "../../utils/operationBackup";

interface OperationBackupPanelProps {
  aiCoachingHistory: LocalAICoachingHistoryEntry[];
  managerActions: ManagerActionChecklistRecord[];
  monthlyReports: LocalMonthlyReportEntry[];
  operationBriefings: LocalOperationBriefingEntry[];
  messageQueue: MessageQueueItem[];
  messageSendHistory: MessageSendHistoryEntry[];
  operationLogs: OperationLogEntry[];
  onRestored: () => void;
  onAudit?: (actionType: OperationActionType, summary: string) => void;
}

export function OperationBackupPanel({
  aiCoachingHistory,
  managerActions,
  monthlyReports,
  operationBriefings,
  messageQueue,
  messageSendHistory,
  operationLogs,
  onRestored,
  onAudit
}: OperationBackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreMode, setRestoreMode] = useState<OperationRestoreMode>("merge");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function setStatus(message: string) {
    setErrorMessage("");
    setStatusMessage(message);
  }

  function setError(message: string) {
    setStatusMessage("");
    setErrorMessage(message);
  }

  function createBackupPayload() {
    return createOperationBackup(undefined, {
      operationBriefings,
      messageQueue,
      messageSendHistory,
      operationLogs
    });
  }

  function downloadBackup() {
    const backup = createBackupPayload();
    downloadTextFile(`rider-coaching-backup-${getDateStamp()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    setStatus("운영 데이터 백업 파일을 생성했습니다.");
    onAudit?.("BACKUP_DOWNLOADED", "운영 데이터 백업 파일 생성");
  }

  function exportAICoachingCsv() {
    if (!aiCoachingHistory.length) {
      setError("내보낼 AI 코칭 이력이 없습니다.");
      return;
    }
    downloadTextFile(`ai-coaching-history-${getDateStamp()}.csv`, createAICoachingHistoryCsv(aiCoachingHistory), "text/csv;charset=utf-8");
    setStatus("AI 코칭 이력 CSV를 내보냈습니다.");
    onAudit?.("CSV_EXPORTED", "AI 코칭 이력 CSV 내보내기");
  }

  function exportManagerActionsCsv() {
    if (!managerActions.length) {
      setError("내보낼 체크리스트 데이터가 없습니다.");
      return;
    }
    downloadTextFile(`manager-action-checklist-${getDateStamp()}.csv`, createManagerActionsCsv(managerActions), "text/csv;charset=utf-8");
    setStatus("관리자 액션 체크리스트 CSV를 내보냈습니다.");
    onAudit?.("CSV_EXPORTED", "관리자 액션 체크리스트 CSV 내보내기");
  }

  function exportMonthlyReportsJson() {
    if (!monthlyReports.length) {
      setError("내보낼 월간 운영 리포트가 없습니다.");
      return;
    }
    downloadTextFile(`monthly-operation-reports-${getDateStamp()}.json`, JSON.stringify(monthlyReports, null, 2), "application/json;charset=utf-8");
    setStatus("월간 운영 리포트 JSON을 내보냈습니다.");
    onAudit?.("CSV_EXPORTED", "월간 운영 리포트 JSON 내보내기");
  }

  function exportAllOperationJson() {
    const backup = createBackupPayload();
    downloadTextFile(`rider-operation-data-${getDateStamp()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    setStatus("전체 운영 데이터 JSON을 내보냈습니다.");
    onAudit?.("CSV_EXPORTED", "전체 운영 데이터 JSON 내보내기");
  }

  async function handleRestoreFile(file?: File) {
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const confirmed = window.confirm(
        restoreMode === "overwrite"
          ? "기존 운영 데이터를 백업 파일 내용으로 덮어씁니다. 계속할까요?"
          : "백업 파일 데이터를 기존 운영 데이터와 병합합니다. 계속할까요?"
      );
      if (!confirmed) return;

      const result = restoreOperationBackup(parsed, restoreMode);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setStatus(result.message);
      onRestored();
      onAudit?.("DATA_RESTORED", "운영 데이터 복원 실행");
    } catch (error) {
      setError(error instanceof Error ? `복원 실패: ${error.message}` : "복원 실패: JSON 파일을 읽을 수 없습니다.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="panel operation-backup-panel">
      <div className="operation-panel-title">
        <div>
          <h3>운영 데이터 백업·복원</h3>
          <p>AI 코칭, 체크리스트, 브리핑, 월간 리포트 데이터를 JSON/CSV로 관리합니다.</p>
        </div>
      </div>

      <div className="operation-button-grid">
        <button className="ai-coaching-button" type="button" onClick={downloadBackup}>
          운영 데이터 백업
        </button>
        <button className="copy-button" type="button" onClick={exportAICoachingCsv}>
          AI 코칭 CSV 내보내기
        </button>
        <button className="copy-button" type="button" onClick={exportManagerActionsCsv}>
          체크리스트 CSV 내보내기
        </button>
        <button className="copy-button" type="button" onClick={exportMonthlyReportsJson}>
          월간 리포트 JSON
        </button>
        <button className="copy-button" type="button" onClick={exportAllOperationJson}>
          전체 운영 데이터 JSON
        </button>
      </div>

      <div className="operation-restore-row">
        <label className="field">
          <span>복원 방식</span>
          <select value={restoreMode} onChange={(event) => setRestoreMode(event.target.value as OperationRestoreMode)}>
            <option value="merge">병합하기</option>
            <option value="overwrite">덮어쓰기</option>
          </select>
        </label>
        <label className="operation-file-input">
          <span>운영 데이터 복원</span>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={(event) => handleRestoreFile(event.target.files?.[0])} />
        </label>
      </div>

      {statusMessage ? <span className="copy-toast">{statusMessage}</span> : null}
      {errorMessage ? <p className="operation-error-message">{errorMessage}</p> : null}
    </section>
  );
}
