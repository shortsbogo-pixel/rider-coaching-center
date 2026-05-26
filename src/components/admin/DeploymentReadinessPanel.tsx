import { useEffect, useMemo, useState } from "react";
import { fetchFullHealthReport, getApiBaseUrl, type DeploymentHealthReport, type DeploymentHealthStatus } from "../../utils/deploymentReadinessApi";

type ReadinessTone = "good" | "warning" | "danger";

interface ReadinessItem {
  id: string;
  label: string;
  status: DeploymentHealthStatus;
  message: string;
}

function toTone(status: DeploymentHealthStatus): ReadinessTone {
  if (status === "ok") return "good";
  if (status === "warning") return "warning";
  return "danger";
}

function statusLabel(status: DeploymentHealthStatus) {
  if (status === "ok") return "정상";
  if (status === "warning") return "확인 필요";
  return "실패";
}

function fileStatus(report: DeploymentHealthReport, fileName: string): DeploymentHealthStatus {
  const file = report.operationDataFiles.find((item) => item.fileName === fileName);
  if (!file) return "warning";
  if (file.status === "fail" || !report.dataDirectory.writable) return "fail";
  return file.status;
}

function fileMessage(report: DeploymentHealthReport, fileName: string) {
  const file = report.operationDataFiles.find((item) => item.fileName === fileName);
  if (!file) return "파일 상태를 확인하지 못했습니다.";
  if (!report.dataDirectory.writable) return "backend/data 디렉터리에 쓰기 권한이 없습니다.";
  return file.exists ? file.message : `${fileName} 파일은 첫 저장 시 자동 생성됩니다.`;
}

function buildReadinessItems(report: DeploymentHealthReport | null, errorMessage: string): ReadinessItem[] {
  const apiBaseUrl = getApiBaseUrl();
  const apiBaseStatus: DeploymentHealthStatus = errorMessage ? "fail" : apiBaseUrl.includes(":4100") ? "ok" : "warning";
  const apiBaseMessage = apiBaseUrl ? `VITE_API_BASE_URL=${apiBaseUrl}` : "Vite proxy /api 사용 중입니다. 운영 배포 전 명시 값을 확인하세요.";

  if (!report) {
    return [
      { id: "frontend", label: "프론트 서버 정상", status: "ok", message: "관리자 화면이 렌더링되었습니다." },
      { id: "backend", label: "백엔드 서버 정상", status: errorMessage ? "fail" : "warning", message: errorMessage || "Health check 응답 대기 중입니다." },
      { id: "api-base", label: "API base URL 설정 정상", status: apiBaseStatus, message: apiBaseMessage }
    ];
  }

  return [
    { id: "frontend", label: "프론트 서버 정상", status: "ok", message: "관리자 화면이 렌더링되었습니다." },
    { id: "backend", label: "백엔드 서버 정상", status: report.server.status, message: report.server.message },
    { id: "api-base", label: "API base URL 설정 정상", status: apiBaseStatus, message: apiBaseMessage },
    { id: "ollama", label: "Ollama 연결 정상", status: report.ollama.connected ? "ok" : "fail", message: report.ollama.message },
    { id: "gemma", label: "Gemma 4 응답 정상", status: report.ollama.gemmaResponding ? "ok" : "warning", message: `${report.ollama.model} / fallback ${report.ollama.fallbackUsed ? "사용" : "미사용"}` },
    { id: "server-storage", label: "서버 저장 가능", status: report.dataDirectory.status, message: report.dataDirectory.message },
    { id: "operation-logs", label: "운영 로그 저장 가능", status: fileStatus(report, "operation-logs.json"), message: fileMessage(report, "operation-logs.json") },
    { id: "message-queue", label: "발송 대기함 저장 가능", status: fileStatus(report, "message-queue.json"), message: fileMessage(report, "message-queue.json") },
    { id: "backup", label: "백업/복원 기능 확인 필요", status: "warning", message: "배포 전 실제 백업 다운로드와 복원 파일 선택을 한 번 더 확인하세요." },
    { id: "rider-scope", label: "라이더 화면 관리자 정보 미노출", status: "ok", message: "/rider는 operation API와 관리자 패널을 렌더링하지 않습니다." },
    { id: "env", label: ".env 설정 확인 필요", status: report.gitIgnore.envIgnored ? "warning" : "fail", message: report.gitIgnore.envIgnored ? ".env는 git 제외됨. 운영 값은 배포 환경에서 별도 설정하세요." : ".env git 제외 설정을 확인하세요." },
    { id: "gitignore", label: "backend/data JSON 파일 git 제외 여부", status: report.gitIgnore.backendDataIgnored ? "ok" : "warning", message: report.gitIgnore.message }
  ];
}

export function DeploymentReadinessPanel() {
  const [report, setReport] = useState<DeploymentHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadReport() {
    setLoading(true);
    setErrorMessage("");
    try {
      setReport(await fetchFullHealthReport());
    } catch (error) {
      setReport(null);
      setErrorMessage(error instanceof Error ? error.message : "운영 준비 점검을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  const items = useMemo(() => buildReadinessItems(report, errorMessage), [report, errorMessage]);

  return (
    <section className="panel deployment-readiness-panel">
      <div className="operation-panel-title">
        <div>
          <h3>운영 준비 점검</h3>
          <p>배포 전 서버, AI, 저장소, 권한 노출 상태를 한 번에 확인합니다.</p>
        </div>
        <button className="copy-button" type="button" onClick={() => void loadReport()} disabled={loading}>
          {loading ? "점검 중" : "다시 점검"}
        </button>
      </div>

      {errorMessage ? <p className="operation-error-message">{errorMessage}</p> : null}

      <div className="operation-check-grid deployment-readiness-grid">
        {items.map((item) => (
          <article className={`operation-check-card ${toTone(item.status)}`} key={item.id}>
            <div>
              <span>{item.label}</span>
              <em className={`status-pill ${toTone(item.status)}`}>{statusLabel(item.status)}</em>
            </div>
            <p>{item.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
