import { useEffect, useMemo, useState } from "react";
import type { LocalAICoachingHistoryEntry } from "../../types/aiCoaching";
import {
  isUploadedAICoachingHistoryEntry,
  readAICoachingHistoryEntries,
  removeAICoachingHistoryEntries,
  type AICoachingHistoryCleanupCriteria
} from "../../utils/aiCoachingHistory";
import { createAICoachingHistoryCsv, downloadTextFile } from "../../utils/exportCsv";
import { operationApi, type AICoachingHistoryCleanupSummary } from "../../utils/operationApi";

interface AICoachingHistoryManagementPanelProps {
  history: LocalAICoachingHistoryEntry[];
  weekOptions: string[];
  selectedWeekKey: string;
  onHistoryChanged: (history: LocalAICoachingHistoryEntry[]) => void;
  onOperationLogChanged: () => void;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function createLocalSummary(history: LocalAICoachingHistoryEntry[]): AICoachingHistoryCleanupSummary {
  const uploaded = history.filter(isUploadedAICoachingHistoryEntry);
  return {
    totalCount: history.length,
    uploadedCount: uploaded.length,
    uploadedExamples: uploaded.slice(0, 30).map((entry) => ({ id: entry.id, riderName: entry.riderName, weekKey: entry.weekKey })),
    weekKeys: uniqueSorted(history.map((entry) => entry.weekKey)),
    riderNames: uniqueSorted(history.map((entry) => entry.riderName)).slice(0, 200)
  };
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function AICoachingHistoryManagementPanel({
  history,
  weekOptions,
  selectedWeekKey,
  onHistoryChanged,
  onOperationLogChanged
}: AICoachingHistoryManagementPanelProps) {
  const localSummary = useMemo(() => createLocalSummary(history), [history]);
  const [summary, setSummary] = useState<AICoachingHistoryCleanupSummary>(localSummary);
  const [cleanupWeekKey, setCleanupWeekKey] = useState(selectedWeekKey);
  const [cleanupRiderName, setCleanupRiderName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingScope, setLoadingScope] = useState<AICoachingHistoryCleanupCriteria["scope"] | "">("");

  const availableWeekKeys = useMemo(
    () => uniqueSorted([...summary.weekKeys, ...weekOptions, selectedWeekKey]),
    [selectedWeekKey, summary.weekKeys, weekOptions]
  );

  useEffect(() => {
    if (!cleanupWeekKey && selectedWeekKey) setCleanupWeekKey(selectedWeekKey);
  }, [cleanupWeekKey, selectedWeekKey]);

  useEffect(() => {
    let mounted = true;
    operationApi
      .getAICoachingHistoryCleanupSummary()
      .then((nextSummary) => {
        if (!mounted) return;
        setSummary(nextSummary);
        setErrorMessage("");
      })
      .catch(() => {
        if (!mounted) return;
        setSummary(localSummary);
      });
    return () => {
      mounted = false;
    };
  }, [localSummary]);

  function downloadCsvBackup() {
    downloadTextFile(`ai-coaching-history-${getDateStamp()}.csv`, createAICoachingHistoryCsv(history), "text/csv;charset=utf-8");
  }

  async function cleanup(criteria: AICoachingHistoryCleanupCriteria) {
    if (criteria.scope === "week" && !criteria.weekKey.trim()) {
      setErrorMessage("삭제할 주차를 선택하세요.");
      return;
    }
    if (criteria.scope === "rider" && !criteria.riderName.trim()) {
      setErrorMessage("삭제할 라이더명을 입력하세요.");
      return;
    }

    const backupAcknowledged =
      criteria.scope !== "all" ||
      window.confirm("전체 AI 코칭 이력을 삭제합니다. 삭제 전 백업 다운로드를 먼저 진행했는지 확인하세요. 계속할까요?");
    if (!backupAcknowledged) return;

    const confirmText =
      criteria.scope === "uploaded"
        ? "uploaded-* 로 표시된 구버전/오염 AI 코칭 이력만 삭제합니다. 계속할까요?"
        : criteria.scope === "week"
          ? `${criteria.weekKey} 주차의 AI 코칭 이력을 삭제합니다. 계속할까요?`
          : criteria.scope === "rider"
            ? `${criteria.riderName} 라이더의 AI 코칭 이력을 삭제합니다. 계속할까요?`
            : "전체 AI 코칭 이력을 삭제합니다. 정상 이력도 모두 삭제됩니다. 계속할까요?";
    if (!window.confirm(confirmText)) return;

    setLoadingScope(criteria.scope);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const result = await operationApi.cleanupAICoachingHistory(
        criteria.scope === "all" ? { ...criteria, backupAcknowledged: true } : criteria
      );
      removeAICoachingHistoryEntries(criteria);
      const nextLocalHistory = readAICoachingHistoryEntries();
      onHistoryChanged(nextLocalHistory);
      const nextSummary = await operationApi.getAICoachingHistoryCleanupSummary().catch(() => createLocalSummary(nextLocalHistory));
      setSummary(nextSummary);
      onOperationLogChanged();
      setStatusMessage(`AI 코칭 이력 ${formatNumber(result.deletedCount)}건을 정리했습니다. 정상 이력은 선택 범위 밖에서 유지됩니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI 코칭 이력 정리에 실패했습니다.");
    } finally {
      setLoadingScope("");
    }
  }

  return (
    <section className="panel ai-history-management-panel">
      <div className="operation-panel-title">
        <div>
          <h3>AI 코칭 이력 관리</h3>
          <p>정상 이력은 누적 보존하고, uploaded-* 구버전 이력이나 베타 테스트 오염 데이터만 선택 정리합니다.</p>
        </div>
        <button className="secondary-link-button icon-button" type="button" onClick={downloadCsvBackup}>
          CSV 백업 다운로드
        </button>
      </div>

      <div className="ai-history-management-grid">
        <article>
          <span>전체 이력</span>
          <strong>{formatNumber(summary.totalCount)}건</strong>
        </article>
        <article className={summary.uploadedCount ? "warning" : ""}>
          <span>정리 필요</span>
          <strong>{formatNumber(summary.uploadedCount)}건</strong>
        </article>
        <article>
          <span>주차 수</span>
          <strong>{formatNumber(summary.weekKeys.length)}개</strong>
        </article>
      </div>

      {summary.uploadedCount ? (
        <details className="issue-card">
          <summary>
            <span className="status-pill warning">정리 필요</span>
            <strong>uploaded-* 이력 상위 {formatNumber(summary.uploadedExamples.length)}건</strong>
          </summary>
          <div className="issue-detail-list">
            {summary.uploadedExamples.map((entry) => (
              <p key={entry.id}>
                {entry.riderName} {entry.weekKey ? `· ${entry.weekKey}` : ""}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      <div className="ai-history-cleanup-actions">
        <button
          className="ai-coaching-button small"
          type="button"
          disabled={!summary.uploadedCount || loadingScope === "uploaded"}
          onClick={() => cleanup({ scope: "uploaded" })}
        >
          {loadingScope === "uploaded" ? "정리 중…" : "uploaded-* 이력만 정리"}
        </button>

        <label>
          주차 기준 삭제
          <select value={cleanupWeekKey} onChange={(event) => setCleanupWeekKey(event.target.value)}>
            {availableWeekKeys.map((weekKey) => (
              <option key={weekKey} value={weekKey}>
                {weekKey}
              </option>
            ))}
          </select>
          <button
            className="secondary-link-button icon-button"
            type="button"
            disabled={!cleanupWeekKey || loadingScope === "week"}
            onClick={() => cleanup({ scope: "week", weekKey: cleanupWeekKey })}
          >
            {loadingScope === "week" ? "삭제 중…" : "선택 주차 이력 삭제"}
          </button>
        </label>

        <label>
          라이더명 기준 삭제
          <input
            type="text"
            list="ai-history-rider-names"
            placeholder="예: 김라이더"
            value={cleanupRiderName}
            onChange={(event) => setCleanupRiderName(event.target.value)}
          />
          <datalist id="ai-history-rider-names">
            {summary.riderNames.map((riderName) => (
              <option value={riderName} key={riderName} />
            ))}
          </datalist>
          <button
            className="secondary-link-button icon-button"
            type="button"
            disabled={!cleanupRiderName.trim() || loadingScope === "rider"}
            onClick={() => cleanup({ scope: "rider", riderName: cleanupRiderName })}
          >
            {loadingScope === "rider" ? "삭제 중…" : "입력 라이더 이력 삭제"}
          </button>
        </label>
      </div>

      <details className="ai-history-danger-zone">
        <summary>전체 삭제 옵션</summary>
        <p>전체 삭제 전에는 반드시 CSV 백업을 다운로드하세요. 전체 삭제는 정상 AI 코칭 이력까지 모두 제거합니다.</p>
        <button className="secondary-link-button icon-button" type="button" onClick={downloadCsvBackup}>
          CSV 백업 다운로드
        </button>
        <button
          className="ai-coaching-button small"
          type="button"
          disabled={!summary.totalCount || loadingScope === "all"}
          onClick={() => cleanup({ scope: "all" })}
        >
          {loadingScope === "all" ? "전체 삭제 중…" : "전체 AI 코칭 이력 삭제"}
        </button>
      </details>

      {statusMessage ? <p className="history-restore-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="history-error">{errorMessage}</p> : null}
    </section>
  );
}
