import { useState } from "react";
import type { MigrationResult } from "../../types/operation";

interface OperationMigrationPanelProps {
  onMigrate: () => Promise<MigrationResult>;
}

export function OperationMigrationPanel({ onMigrate }: OperationMigrationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setErrorMessage("");
    try {
      setResult(await onMigrate());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로컬 데이터 이전에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel operation-migration-panel">
      <div className="operation-panel-title">
        <div>
          <h3>로컬 데이터 서버로 이전</h3>
          <p>브라우저 localStorage에 남아있는 운영 데이터를 백엔드 JSON 저장소로 복사합니다.</p>
        </div>
        <button className="ai-coaching-button" type="button" disabled={loading} onClick={handleClick}>
          {loading ? "이전 중" : "로컬 데이터 서버로 이전"}
        </button>
      </div>
      {result ? (
        <div className="operation-migration-result">
          <span>성공 {result.successCount}건</span>
          <span>실패 {result.failedCount}건</span>
          <span>건너뜀 {result.skippedCount}건</span>
        </div>
      ) : null}
      {errorMessage ? <p className="operation-error-message">{errorMessage}</p> : null}
    </section>
  );
}
