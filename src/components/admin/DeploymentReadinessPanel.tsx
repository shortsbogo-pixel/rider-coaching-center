import { useEffect, useMemo, useState } from "react";
import {
  buildApiUrl,
  fetchFullHealthReport,
  getApiBaseUrl,
  type DeploymentHealthReport,
  type DeploymentHealthStatus
} from "../../utils/deploymentReadinessApi";

type ReadinessTone = "good" | "warning" | "danger";

interface ReadinessItem {
  id: string;
  label: string;
  status: DeploymentHealthStatus;
  message: string;
}

interface UploadSummary {
  count: number;
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
  const apiBaseStatus: DeploymentHealthStatus = errorMessage ? "fail" : apiBaseUrl.includes(":4100") || apiBaseUrl === "" ? "ok" : "warning";
  const apiBaseMessage = apiBaseUrl ? `VITE_API_BASE_URL=${apiBaseUrl}` : "동일 origin/proxy 또는 Manus 배포 설정을 사용합니다.";

  if (!report) {
    return [
      { id: "frontend", label: "프론트 서버", status: "ok", message: "관리자 화면이 렌더링되었습니다." },
      { id: "backend", label: "백엔드 서버", status: errorMessage ? "fail" : "warning", message: errorMessage || "Health check 응답 대기 중입니다." },
      { id: "api-base", label: "API base URL", status: apiBaseStatus, message: apiBaseMessage }
    ];
  }

  return [
    { id: "frontend", label: "프론트 서버", status: "ok", message: "관리자 화면이 렌더링되었습니다." },
    { id: "backend", label: "백엔드 서버", status: report.server.status, message: report.server.message },
    { id: "api-base", label: "API base URL", status: apiBaseStatus, message: apiBaseMessage },
    { id: "ollama", label: "Ollama 연결", status: report.ollama.connected ? "ok" : "warning", message: report.ollama.message },
    { id: "gemma", label: "Gemma 4 응답", status: report.ollama.gemmaResponding ? "ok" : "warning", message: `${report.ollama.model} / fallback ${report.ollama.fallbackUsed ? "사용" : "미사용"}` },
    { id: "server-storage", label: "서버 저장", status: report.dataDirectory.status, message: report.dataDirectory.message },
    { id: "operation-logs", label: "운영 로그 저장", status: fileStatus(report, "operation-logs.json"), message: fileMessage(report, "operation-logs.json") },
    { id: "message-queue", label: "발송 대기함 저장", status: fileStatus(report, "message-queue.json"), message: fileMessage(report, "message-queue.json") },
    { id: "backup", label: "백업/복원 확인", status: "warning", message: "배포 후 실제 백업 다운로드와 복원 파일 선택 화면을 한 번 확인하세요." },
    { id: "rider-scope", label: "라이더 화면 내부 정보 미노출", status: "ok", message: "/rider에는 운영 로그, 발송 대기함, provider/fallback 사유를 표시하지 않습니다." },
    { id: "env", label: ".env 제외", status: report.gitIgnore.envIgnored ? "warning" : "fail", message: report.gitIgnore.envIgnored ? ".env는 git 제외 대상입니다. 배포 환경값은 Manus에서 별도 설정하세요." : ".env git 제외 설정을 확인하세요." },
    { id: "gitignore", label: "backend/data JSON 제외", status: report.gitIgnore.backendDataIgnored ? "ok" : "warning", message: report.gitIgnore.message }
  ];
}

function buildBetaReadinessItems(report: DeploymentHealthReport | null, errorMessage: string, uploadSummary: UploadSummary): ReadinessItem[] {
  const manifestLink = typeof document !== "undefined" ? document.querySelector('link[rel="manifest"]')?.getAttribute("href") : "";
  const backendStatus: DeploymentHealthStatus = report ? report.server.status : errorMessage ? "fail" : "warning";
  const aiStatus: DeploymentHealthStatus = report ? (report.ollama.connected && report.ollama.gemmaResponding && !report.ollama.fallbackUsed ? "ok" : "warning") : "warning";
  const operationLogStatus = report ? fileStatus(report, "operation-logs.json") : "warning";
  const messageQueueStatus = report ? fileStatus(report, "message-queue.json") : "warning";
  const backupStatus: DeploymentHealthStatus = report ? (report.dataDirectory.writable && report.gitIgnore.backendDataIgnored ? "ok" : "warning") : "warning";

  return [
    { id: "manus-ai-mode", label: "Manus 권장 AI 설정", status: "warning", message: "Manus 베타는 AI_PROVIDER=template, AI_MODE=template, AI_FALLBACK_ENABLED=true를 권장하며, 이 상태는 기본 템플릿 운영 모드입니다." },
    { id: "manus-provider-stub", label: "외부 AI provider 안내", status: "warning", message: "OpenAI/Gemini는 현재 준비 구조만 있으며 실제 API 호출은 비활성입니다. 키 없이 템플릿 fallback됩니다." },
    { id: "manus-json-storage", label: "JSON 저장 모드", status: "warning", message: "STORAGE_MODE=json은 베타용입니다. 정식 운영 전 DB 전환과 백업 정책을 검토하세요." },
    { id: "beta-deployment-method", label: "배포 방식 선택", status: "warning", message: "외부 공유 전 Manus, 로컬 터널, Render/Fly/Railway/VPS 중 하나를 확정하세요." },
    { id: "beta-url", label: "베타 URL 준비", status: "warning", message: "테스터에게 전달할 관리자 URL과 라이더 URL을 분리해서 준비하세요." },
    { id: "beta-accounts", label: "테스트 계정 준비", status: "warning", message: "관리자/라이더 테스트 역할과 샘플 라이더명을 문서 기준으로 정리하세요." },
    { id: "beta-backup-done", label: "백업 완료", status: "warning", message: "베타 시작 전 운영 데이터 백업 파일을 직접 다운로드하세요." },
    { id: "beta-data-cleanup", label: "샘플 데이터 정리", status: "warning", message: "샘플 데이터와 운영 데이터가 섞이지 않도록 BETA_RUNBOOK의 수동 초기화 절차를 확인하세요." },
    { id: "beta-frontend", label: "프론트 실행", status: "ok", message: "관리자 화면이 렌더링되어 베타 점검 패널을 표시합니다." },
    { id: "beta-backend", label: "백엔드 실행", status: backendStatus, message: report?.server.message ?? (errorMessage || "Health check 응답을 기다리는 중입니다.") },
    { id: "beta-ai", label: "AI 상태", status: aiStatus, message: report ? `${report.ollama.model} / fallback ${report.ollama.fallbackUsed ? "사용" : "미사용"}` : "AI 상태 점검 전입니다. Manus에서는 template 모드가 정상 운영 모드입니다." },
    { id: "beta-storage", label: "서버 저장", status: report?.dataDirectory.status ?? "warning", message: report?.dataDirectory.message ?? "backend/data 접근 상태를 확인 중입니다." },
    { id: "beta-logs", label: "운영 로그 기록", status: operationLogStatus, message: report ? fileMessage(report, "operation-logs.json") : "운영 로그 파일 상태 확인 전입니다." },
    { id: "beta-queue", label: "발송 대기함 저장", status: messageQueueStatus, message: report ? fileMessage(report, "message-queue.json") : "발송 대기함 파일 상태 확인 전입니다." },
    { id: "beta-backup", label: "백업 가능", status: backupStatus, message: report ? "배포 후 실제 다운로드를 한 번 수행하세요." : "서버 저장소 확인 후 백업을 점검하세요." },
    { id: "beta-rider-scope", label: "라이더 화면 내부 정보 미노출", status: "ok", message: "/rider에는 provider/fallbackReason, 운영 로그, 발송 대기함, Manus 안내를 노출하지 않습니다." },
    { id: "beta-pwa", label: "PWA manifest", status: manifestLink ? "ok" : "warning", message: manifestLink ? `${manifestLink} 연결됨` : "index.html의 manifest link를 확인하세요." },
    { id: "beta-sample-data", label: "샘플 데이터", status: uploadSummary.count > 0 ? "ok" : "warning", message: uploadSummary.message }
  ];
}

export function DeploymentReadinessPanel() {
  const [report, setReport] = useState<DeploymentHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadSummary, setUploadSummary] = useState<UploadSummary>({ count: 0, message: "업로드 주차 데이터를 확인 중입니다." });

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
    fetch(buildApiUrl("/uploads"))
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const weeks = Array.isArray(payload?.weeks) ? payload.weeks : [];
        setUploadSummary({
          count: weeks.length,
          message: weeks.length ? `업로드된 주차 데이터 ${weeks.length}개 확인` : "업로드된 주차 데이터가 없습니다. 베타 전 샘플 업로드를 확인하세요."
        });
      })
      .catch(() => setUploadSummary({ count: 0, message: "업로드 주차 데이터를 확인하지 못했습니다." }));
  }, []);

  const items = useMemo(() => buildReadinessItems(report, errorMessage), [report, errorMessage]);
  const betaItems = useMemo(() => buildBetaReadinessItems(report, errorMessage, uploadSummary), [report, errorMessage, uploadSummary]);

  return (
    <section className="panel deployment-readiness-panel">
      <div className="operation-panel-title">
        <div>
          <h3>운영 준비 점검</h3>
          <p>배포 전 서버, AI provider, 저장소, 권한 노출 상태를 한 번에 확인합니다.</p>
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

      <div className="beta-readiness-block">
        <div className="operation-panel-title compact">
          <div>
            <h4>베타 테스트 준비 상태</h4>
            <p>Manus 인계 전 실제 베타 흐름에서 확인해야 할 항목입니다.</p>
          </div>
        </div>
        <div className="operation-check-grid deployment-readiness-grid beta-readiness-grid">
          {betaItems.map((item) => (
            <article className={`operation-check-card ${toTone(item.status)}`} key={item.id}>
              <div>
                <span>{item.label}</span>
                <em className={`status-pill ${toTone(item.status)}`}>{statusLabel(item.status)}</em>
              </div>
              <p>{item.message}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
