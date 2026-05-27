import { useEffect, useMemo, useState } from "react";
import {
  buildApiUrl,
  fetchFullHealthReport,
  getApiBaseUrl,
  HealthAuthError,
  type DeploymentHealthReport,
  type DeploymentHealthStatus
} from "../../utils/deploymentReadinessApi";
import { getAuthHeader } from "../../utils/authStore";

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

/**
 * Ollama 연결 실패는 Manus template 모드에서 정상이므로 "warning"이 아닌 "ok"로 표시.
 * fallbackUsed === true이면 template 모드로 정상 운영 중임을 의미한다.
 */
function ollamaStatusForManus(report: DeploymentHealthReport): DeploymentHealthStatus {
  if (report.ollama.fallbackUsed) return "ok";
  if (report.ollama.connected && report.ollama.gemmaResponding) return "ok";
  return "warning";
}

function ollamaMessageForManus(report: DeploymentHealthReport): string {
  if (report.ollama.fallbackUsed) {
    return `Ollama 미연결 → template fallback 모드로 정상 운영 중 (${report.ollama.model})`;
  }
  if (report.ollama.connected && report.ollama.gemmaResponding) {
    return `Ollama 연결됨 / ${report.ollama.model} 응답 정상`;
  }
  return `Ollama 미연결 (${report.ollama.message}). fallback 미활성 상태 확인 필요.`;
}

function buildReadinessItems(
  report: DeploymentHealthReport | null,
  errorMessage: string,
  isAuthError: boolean
): ReadinessItem[] {
  const apiBaseUrl = getApiBaseUrl();
  const apiBaseStatus: DeploymentHealthStatus =
    errorMessage ? "fail" : apiBaseUrl.includes(":4100") || apiBaseUrl === "" ? "ok" : "warning";
  const apiBaseMessage = apiBaseUrl
    ? `VITE_API_BASE_URL=${apiBaseUrl}`
    : "동일 origin/proxy 또는 Manus 배포 설정을 사용합니다.";

  if (!report) {
    const backendMessage = isAuthError
      ? "관리자 권한이 필요합니다. admin 계정으로 로그인 후 다시 점검하세요."
      : errorMessage || "Health check 응답 대기 중입니다.";
    return [
      { id: "frontend", label: "프론트 서버", status: "ok", message: "관리자 화면이 렌더링되었습니다." },
      {
        id: "backend",
        label: "백엔드 서버",
        status: errorMessage ? "fail" : "warning",
        message: backendMessage
      },
      { id: "api-base", label: "API base URL", status: apiBaseStatus, message: apiBaseMessage }
    ];
  }

  return [
    { id: "frontend", label: "프론트 서버", status: "ok", message: "관리자 화면이 렌더링되었습니다." },
    { id: "backend", label: "백엔드 서버", status: report.server.status, message: report.server.message },
    { id: "api-base", label: "API base URL", status: apiBaseStatus, message: apiBaseMessage },
    {
      id: "ollama",
      label: "AI 모드",
      status: ollamaStatusForManus(report),
      message: ollamaMessageForManus(report)
    },
    {
      id: "server-storage",
      label: "서버 저장",
      status: report.dataDirectory.status,
      message: report.dataDirectory.message
    },
    {
      id: "operation-logs",
      label: "운영 로그 저장",
      status: fileStatus(report, "operation-logs.json"),
      message: fileMessage(report, "operation-logs.json")
    },
    {
      id: "message-queue",
      label: "발송 대기함 저장",
      status: fileStatus(report, "message-queue.json"),
      message: fileMessage(report, "message-queue.json")
    },
    {
      id: "backup",
      label: "백업/복원 확인",
      status: "warning",
      message: "배포 후 실제 백업 다운로드와 복원 파일 선택 화면을 한 번 확인하세요."
    },
    {
      id: "rider-scope",
      label: "라이더 화면 내부 정보 미노출",
      status: "ok",
      message: "/rider에는 운영 로그, 발송 대기함, provider/fallback 사유를 표시하지 않습니다."
    },
    {
      id: "env",
      label: ".env 제외",
      // envIgnored:true는 정상 제외 또는 배포 환경에서 .gitignore 미존 중 하나 → 둘 다 warning
      status: report.gitIgnore.envIgnored ? "warning" : "fail",
      message: report.gitIgnore.envIgnored
        ? "배포 환경에서는 .gitignore 파일 확인이 제한될 수 있습니다. GitHub 저장소 기준으로 확인하세요."
        : ".env git 제외 설정을 확인하세요."
    },
    {
      id: "gitignore",
      label: "backend/data JSON 제외",
      status: report.gitIgnore.backendDataIgnored ? "warning" : "warning",
      // ENOENT 등 내부 오류 메시지는 백엔드에서 이미 안전한 문구로 교체됨
      message: report.gitIgnore.message
    }
  ];
}

function buildBetaReadinessItems(
  report: DeploymentHealthReport | null,
  errorMessage: string,
  isAuthError: boolean,
  uploadSummary: UploadSummary
): ReadinessItem[] {
  const manifestLink =
    typeof document !== "undefined" ? document.querySelector('link[rel="manifest"]')?.getAttribute("href") : "";
  const backendStatus: DeploymentHealthStatus = report
    ? report.server.status
    : errorMessage
      ? "fail"
      : "warning";

  // Ollama 미연결 + fallback 사용 중이면 template 모드 정상
  const aiStatus: DeploymentHealthStatus = report
    ? ollamaStatusForManus(report)
    : "warning";

  const operationLogStatus = report ? fileStatus(report, "operation-logs.json") : "warning";
  const messageQueueStatus = report ? fileStatus(report, "message-queue.json") : "warning";
  const backupStatus: DeploymentHealthStatus = report
    ? report.dataDirectory.writable && report.gitIgnore.backendDataIgnored
      ? "ok"
      : "warning"
    : "warning";

  const backendMessage = isAuthError
    ? "관리자 권한이 필요합니다. admin 계정으로 로그인 후 다시 점검하세요."
    : report?.server.message ?? (errorMessage || "Health check 응답을 기다리는 중입니다.");

  return [
    {
      id: "manus-ai-mode",
      label: "Manus 권장 AI 설정",
      status: "warning",
      message:
        "Manus 베타는 AI_PROVIDER=template, AI_MODE=template, AI_FALLBACK_ENABLED=true를 권장하며, 이 상태는 기본 템플릿 운영 모드입니다."
    },
    {
      id: "manus-provider-stub",
      label: "외부 AI provider 안내",
      status: "warning",
      message:
        "OpenAI/Gemini는 현재 준비 구조만 있으며 실제 API 호출은 비활성입니다. 키 없이 템플릿 fallback됩니다."
    },
    {
      id: "manus-json-storage",
      label: "JSON 저장 모드",
      status: "warning",
      message: "STORAGE_MODE=json은 베타용입니다. 정식 운영 전 DB 전환과 백업 정책을 검토하세요."
    },
    {
      id: "beta-deployment-method",
      label: "배포 방식 선택",
      status: "warning",
      message: "외부 공유 전 Manus, 로컬 터널, Render/Fly/Railway/VPS 중 하나를 확정하세요."
    },
    {
      id: "beta-url",
      label: "베타 URL 준비",
      status: "warning",
      message: "테스터에게 전달할 관리자 URL과 라이더 URL을 분리해서 준비하세요."
    },
    {
      id: "beta-accounts",
      label: "테스트 계정 준비",
      status: "warning",
      message: "관리자/라이더 테스트 역할과 샘플 라이더명을 문서 기준으로 정리하세요."
    },
    {
      id: "beta-backup-done",
      label: "백업 완료",
      status: "warning",
      message: "베타 시작 전 운영 데이터 백업 파일을 직접 다운로드하세요."
    },
    {
      id: "beta-data-cleanup",
      label: "샘플 데이터 정리",
      status: "warning",
      message:
        "샘플 데이터와 운영 데이터가 섞이지 않도록 BETA_RUNBOOK의 수동 초기화 절차를 확인하세요."
    },
    {
      id: "beta-frontend",
      label: "프론트 실행",
      status: "ok",
      message: "관리자 화면이 렌더링되어 베타 점검 패널을 표시합니다."
    },
    { id: "beta-backend", label: "백엔드 실행", status: backendStatus, message: backendMessage },
    {
      id: "beta-ai",
      label: "AI 상태",
      status: aiStatus,
      message: report
        ? ollamaMessageForManus(report)
        : "AI 상태 점검 전입니다. Manus에서는 template 모드가 정상 운영 모드입니다."
    },
    {
      id: "beta-storage",
      label: "서버 저장",
      status: report?.dataDirectory.status ?? "warning",
      message: report?.dataDirectory.message ?? "backend/data 접근 상태를 확인 중입니다."
    },
    {
      id: "beta-logs",
      label: "운영 로그 기록",
      status: operationLogStatus,
      message: report ? fileMessage(report, "operation-logs.json") : "운영 로그 파일 상태 확인 전입니다."
    },
    {
      id: "beta-queue",
      label: "발송 대기함 저장",
      status: messageQueueStatus,
      message: report ? fileMessage(report, "message-queue.json") : "발송 대기함 파일 상태 확인 전입니다."
    },
    {
      id: "beta-backup",
      label: "백업 가능",
      status: backupStatus,
      message: report
        ? "배포 후 실제 다운로드를 한 번 수행하세요."
        : "서버 저장소 확인 후 백업을 점검하세요."
    },
    {
      id: "beta-rider-scope",
      label: "라이더 화면 내부 정보 미노출",
      status: "ok",
      message:
        "/rider에는 provider/fallbackReason, 운영 로그, 발송 대기함, Manus 안내를 노출하지 않습니다."
    },
    {
      id: "beta-pwa",
      label: "PWA manifest",
      status: manifestLink ? "ok" : "warning",
      message: manifestLink ? `${manifestLink} 연결됨` : "index.html의 manifest link를 확인하세요."
    },
    {
      id: "beta-sample-data",
      label: "샘플 데이터",
      status: uploadSummary.count > 0 ? "ok" : "warning",
      message: uploadSummary.message
    }
  ];
}

export function DeploymentReadinessPanel() {
  const [report, setReport] = useState<DeploymentHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthError, setIsAuthError] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary>({
    count: 0,
    message: "업로드 주차 데이터를 확인 중입니다."
  });

  async function loadReport() {
    setLoading(true);
    setErrorMessage("");
    setIsAuthError(false);
    try {
      setReport(await fetchFullHealthReport());
    } catch (error) {
      setReport(null);
      if (error instanceof HealthAuthError) {
        // 403: 관리자 권한 없음 → 별도 플래그로 UI 구분
        setIsAuthError(true);
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : "운영 준비 점검을 불러오지 못했습니다."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // /api/uploads는 인증 헤더 포함하여 요청
    fetch(buildApiUrl("/uploads"), { headers: getAuthHeader() })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const weeks = Array.isArray(payload?.weeks) ? payload.weeks : [];
        setUploadSummary({
          count: weeks.length,
          message:
            weeks.length
              ? `업로드된 주차 데이터 ${weeks.length}개 확인`
              : "업로드된 주차 데이터가 없습니다. 베타 전 샘플 업로드를 확인하세요."
        });
      })
      .catch(() =>
        setUploadSummary({ count: 0, message: "업로드 주차 데이터를 확인하지 못했습니다." })
      );
  }, []);

  const items = useMemo(
    () => buildReadinessItems(report, errorMessage, isAuthError),
    [report, errorMessage, isAuthError]
  );
  const betaItems = useMemo(
    () => buildBetaReadinessItems(report, errorMessage, isAuthError, uploadSummary),
    [report, errorMessage, isAuthError, uploadSummary]
  );

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

      {/* 403 인증 오류는 별도 경고 배너로 구분 표시 */}
      {isAuthError ? (
        <p className="operation-error-message" style={{ borderLeft: "4px solid #e67e22" }}>
          ⚠️ {errorMessage}
        </p>
      ) : errorMessage ? (
        <p className="operation-error-message">{errorMessage}</p>
      ) : null}

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
