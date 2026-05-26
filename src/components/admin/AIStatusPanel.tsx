import { useState } from "react";
import { fetchAIStatus, type AIStatusResult } from "../../utils/aiCoachingApi";

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function modeGuide(status: AIStatusResult | null) {
  if (!status) return "상태 확인 전입니다.";
  if (status.aiMode === "template") return "Gemma 4 없이 기본 템플릿으로 안정 운영합니다.";
  if (status.aiMode === "gemma" && status.fallbackEnabled === false) return "Gemma 4 실패 시 명확한 실패 응답을 반환합니다.";
  return "Gemma 4를 먼저 사용하고 실패하면 기본 템플릿으로 전환합니다.";
}

function providerGuide(provider?: string) {
  if (provider === "template") return "Manus 배포에서도 안정적으로 동작하는 기본 템플릿 운영 모드입니다.";
  if (provider === "openai") return "OpenAI provider는 현재 안전 stub이며, API 키 설정 전에는 템플릿으로 전환됩니다.";
  if (provider === "gemini") return "Gemini provider는 현재 안전 stub이며, API 키 설정 전에는 템플릿으로 전환됩니다.";
  return "Ollama/Gemma 4를 우선 사용하고 실패 시 템플릿 fallback을 사용할 수 있습니다.";
}

export function AIStatusPanel({ onChecked }: { onChecked?: (status: AIStatusResult) => void }) {
  const [status, setStatus] = useState<AIStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function checkStatus() {
    setLoading(true);
    setErrorMessage("");

    try {
      const nextStatus = await fetchAIStatus();
      setStatus(nextStatus);
      onChecked?.(nextStatus);
    } catch (error) {
      const fallbackStatus: AIStatusResult = {
        ollamaConnected: false,
        model: "-",
        gemmaResponding: false,
        checkedAt: new Date().toISOString(),
        fallbackUsed: true,
        fallbackReason: "API_ERROR",
        provider: "template",
        aiProvider: "template",
        aiMode: "auto",
        fallbackEnabled: true,
        message: error instanceof Error ? error.message : "AI 상태 확인 실패"
      };
      setStatus(fallbackStatus);
      onChecked?.(fallbackStatus);
      setErrorMessage("AI 상태 API 또는 백엔드 연결 상태를 확인하세요.");
    } finally {
      setLoading(false);
    }
  }

  const currentProvider = status?.aiProvider ?? status?.provider;
  const isHealthy = !!status?.ollamaConnected && !!status.gemmaResponding;
  const isTemplateMode = status?.aiMode === "template";
  const isTemplateProvider = currentProvider === "template";

  return (
    <section className="panel ai-status-panel">
      <div className="operation-panel-title">
        <div>
          <h3>AI 상태 점검</h3>
          <p>AI provider, Gemma 4 연결 상태, 기본 템플릿 운영 가능 여부를 확인합니다.</p>
        </div>
        <button className="ai-coaching-button" type="button" onClick={checkStatus} disabled={loading}>
          {loading ? "확인 중" : "AI 상태 확인"}
        </button>
      </div>

      <div className="operation-status-grid">
        <article className={`operation-status-card ${isHealthy || isTemplateMode || isTemplateProvider ? "good" : "warning"}`}>
          <span>연결 상태</span>
          <strong>{status ? (isTemplateMode || isTemplateProvider ? "기본 템플릿 운영 모드" : isHealthy ? "Gemma 4 연결 정상" : "확인 필요") : "미확인"}</strong>
          <em>{status?.message ?? "아직 상태 확인을 실행하지 않았습니다."}</em>
        </article>
        <article className={`operation-status-card ${isTemplateProvider ? "good" : "info"}`}>
          <span>현재 AI_PROVIDER</span>
          <strong>{currentProvider ?? "-"}</strong>
          <em>{providerGuide(currentProvider)}</em>
        </article>
        <article className={`operation-status-card ${isTemplateMode ? "good" : "info"}`}>
          <span>현재 AI_MODE</span>
          <strong>{status?.aiMode ?? "-"}</strong>
          <em>{modeGuide(status)}</em>
        </article>
        <article className="operation-status-card">
          <span>현재 모델</span>
          <strong>{status?.model ?? "-"}</strong>
          <em>Ollama provider 사용 시 적용되는 모델입니다.</em>
        </article>
        <article className={`operation-status-card ${status?.fallbackUsed ? "warning" : "good"}`}>
          <span>fallback</span>
          <strong>{status ? (status.fallbackUsed ? "템플릿 전환됨" : "미사용") : "-"}</strong>
          <em>{status?.fallbackReason ?? "AI 실패 시 기본 템플릿으로 전환할 수 있습니다."}</em>
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
