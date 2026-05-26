import { useState } from "react";
import { getAuthHeader } from "../../utils/authStore";

interface AIStatusResult {
  ollamaConnected: boolean;
  model: string;
  gemmaResponding: boolean;
  checkedAt: string;
  fallbackUsed: boolean;
  message: string;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

export function AIStatusPanel() {
  const [status, setStatus] = useState<AIStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function checkStatus() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/ai-coaching/status", {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error("AI 상태 확인 API 호출 실패");
      setStatus((await response.json()) as AIStatusResult);
    } catch (error) {
      setStatus({
        ollamaConnected: false,
        model: "-",
        gemmaResponding: false,
        checkedAt: new Date().toISOString(),
        fallbackUsed: true,
        message: error instanceof Error ? error.message : "AI 상태 확인 실패"
      });
      setErrorMessage("Ollama 또는 Gemma 4가 실행 중인지 확인 필요");
    } finally {
      setLoading(false);
    }
  }

  const isHealthy = !!status?.ollamaConnected && !!status.gemmaResponding;

  return (
    <section className="panel ai-status-panel">
      <div className="operation-panel-title">
        <div>
          <h3>AI 상태 점검</h3>
          <p>로컬 Ollama / Gemma 4 응답 상태를 확인합니다.</p>
        </div>
        <button className="ai-coaching-button" type="button" onClick={checkStatus} disabled={loading}>
          {loading ? "확인 중" : "AI 상태 확인"}
        </button>
      </div>

      <div className="operation-status-grid">
        <article className={`operation-status-card ${isHealthy ? "good" : "warning"}`}>
          <span>연결 상태</span>
          <strong>{status ? (isHealthy ? "Gemma 4 연결 정상" : "확인 필요") : "미확인"}</strong>
          <em>{status?.message ?? "아직 상태 확인을 실행하지 않았습니다."}</em>
        </article>
        <article className="operation-status-card">
          <span>현재 모델</span>
          <strong>{status?.model ?? "-"}</strong>
          <em>백엔드 Ollama 설정 기준</em>
        </article>
        <article className={`operation-status-card ${status?.fallbackUsed ? "warning" : "good"}`}>
          <span>fallback 사용</span>
          <strong>{status ? (status.fallbackUsed ? "사용 가능성 있음" : "미사용") : "-"}</strong>
          <em>AI 응답 실패 시 기본 템플릿으로 대체됩니다.</em>
        </article>
        <article className="operation-status-card">
          <span>마지막 확인</span>
          <strong>{formatDateTime(status?.checkedAt)}</strong>
          <em>{errorMessage || "상태 확인 버튼을 눌러 갱신합니다."}</em>
        </article>
      </div>
    </section>
  );
}
