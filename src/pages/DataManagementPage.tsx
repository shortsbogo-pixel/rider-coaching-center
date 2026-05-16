import { AlertTriangle, CheckCircle2, Database, Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { dataManagementRepository, type DataManagementSummary } from "../storage/dataManagementRepository";
import { downloadJson } from "../storage/storageClient";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function backupStatusLabel(status: "included" | "empty" | "missing") {
  if (status === "included") return "포함됨";
  if (status === "empty") return "비어 있음";
  return "없음";
}

function cacheStatusLabel(status: "latest" | "regenerate_needed" | "missing" | "error") {
  if (status === "latest") return "최신";
  if (status === "regenerate_needed") return "재생성 필요";
  if (status === "missing") return "캐시 없음";
  return "오류";
}

function cacheTone(status: "latest" | "regenerate_needed" | "missing" | "error") {
  if (status === "latest") return "good";
  if (status === "error") return "danger";
  return "warning";
}

export function DataManagementPage() {
  const [summary, setSummary] = useState<DataManagementSummary | null>(null);
  const [message, setMessage] = useState("");

  const uploadStats = useMemo(() => {
    if (!summary) return { active: 0, archive: 0, storedWeeks: 0, limit: 8 };
    const limit = summary.settings.retentionWeeks;
    const archive = summary.uploads.filter(
      (upload, index) => upload.analysisScope === "archive_candidate" || upload.deletionCandidate || index >= limit
    ).length;
    const active = summary.uploads.length - archive;
    return { active, archive, storedWeeks: summary.weekKeys.length, limit };
  }, [summary]);

  const lastAnalysisCacheAt = useMemo(() => {
    if (!summary?.cacheStatus.analysisCacheWeeks.length) return null;
    return summary.cacheStatus.analysisCacheWeeks
      .map((cache) => cache.generatedAt)
      .sort((a, b) => b.localeCompare(a))[0];
  }, [summary]);

  const storageHealth = useMemo(() => {
    if (!summary) return { label: "-", tone: "default" as const };
    const hasMissingBackupKey = summary.backupChecks.some((item) => item.status === "missing");
    const hasStaleCache = summary.cacheStatus.analysisCacheWeeks.some((cache) => cache.status !== "latest");
    if (hasMissingBackupKey) return { label: "점검 필요", tone: "danger" as const };
    if (hasStaleCache || summary.counts.analysisCaches === 0) return { label: "보완 필요", tone: "warning" as const };
    return { label: "정상", tone: "good" as const };
  }, [summary]);

  async function loadSummary() {
    setSummary(await dataManagementRepository.getSummary());
  }

  useEffect(() => {
    loadSummary().catch(() => setMessage("데이터 관리 정보를 불러오지 못했습니다."));
  }, []);

  async function handleExport(type: string, label: string) {
    const data = await dataManagementRepository.exportData(type);
    downloadJson(`rider-coaching-${label}-${new Date().toISOString().slice(0, 10)}.json`, data);
    await loadSummary();
    setMessage(`${label} 데이터를 내보냈습니다.`);
  }

  async function handleRegenerateCaches() {
    if (!window.confirm("업로드 데이터를 기준으로 분석 캐시를 다시 생성할까요? 기존 캐시는 새 계산값으로 교체됩니다.")) {
      return;
    }
    const result = await dataManagementRepository.regenerateCaches();
    setSummary(result.summary);
    setMessage("분석 캐시를 재생성했습니다.");
  }

  if (!summary) {
    return (
      <div className="page-stack">
        <SectionHeader title="데이터 관리" description="저장 구조와 분석 캐시 상태를 불러오는 중입니다." />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <SectionHeader
        title="데이터 관리"
        description="운영 전 업로드 이력, 분석 캐시, 백업 JSON 포함 항목을 한곳에서 점검합니다."
      />

      <div className="metric-grid">
        <MetricCard label="업로드 이력" value={`${summary.counts.uploadHistory}건`} />
        <MetricCard label="저장된 주차" value={`${uploadStats.storedWeeks}개`} tone="good" />
        <MetricCard label="활성 분석 주차" value={`${uploadStats.active}개`} caption={`최근 ${uploadStats.limit}주 기준`} />
        <MetricCard
          label="아카이브 후보"
          value={`${uploadStats.archive}개`}
          tone={uploadStats.archive ? "warning" : "default"}
        />
        <MetricCard label="관리자 메모" value={`${summary.counts.adminNotes}건`} />
        <MetricCard label="커스텀 코칭 메시지" value={`${summary.counts.customCoachingMessages}건`} />
        <MetricCard label="분석 캐시" value={`${summary.counts.analysisCaches}개`} />
        <MetricCard label="저장소 상태" value={storageHealth.label} tone={storageHealth.tone} />
      </div>

      <div className="metric-grid">
        <MetricCard label="마지막 백업 생성" value={formatDateTime(summary.settings.lastBackupAt)} />
        <MetricCard label="마지막 분석 캐시 생성" value={formatDateTime(lastAnalysisCacheAt)} />
      </div>

      <section className="panel notice-panel">
        <h3>업로드 주차 8주 관리 정책</h3>
        <p>
          최근 {uploadStats.limit}주차까지만 기본 분석 대상으로 사용됩니다. 오래된 주차는 자동 삭제하지 않고
          아카이브 후보로 표시하므로, 백업 후 정리 여부를 검토하세요.
        </p>
      </section>

      <section className="panel action-panel">
        <h3>백업/캐시 작업</h3>
        <div className="button-row data-button-row">
          <button className="primary-button icon-button" type="button" onClick={() => handleExport("all", "all")}>
            <Download size={18} /> 전체 데이터 내보내기
          </button>
          <button className="secondary-button icon-button" type="button" onClick={() => handleExport("uploads", "uploads")}>
            <Download size={18} /> 업로드 이력
          </button>
          <button className="secondary-button icon-button" type="button" onClick={() => handleExport("admin-notes", "admin-notes")}>
            <Download size={18} /> 관리자 메모
          </button>
          <button className="secondary-button icon-button" type="button" onClick={() => handleExport("custom-coaching", "custom-coaching")}>
            <Download size={18} /> 코칭 메시지
          </button>
          <button className="primary-button icon-button" type="button" onClick={handleRegenerateCaches}>
            <RefreshCw size={18} /> 캐시 재생성
          </button>
        </div>
        <p className="note-text">
          백업 JSON 파일은 메모장, VS Code, Antigravity 등에서 열 수 있습니다. Antigravity로 열리는 것은 파일 연결
          프로그램 문제이며 백업 오류가 아닙니다.
        </p>
      </section>

      <section className="panel">
        <h3>업로드 주차 목록</h3>
        <div className="rider-list">
          {summary.uploads.map((upload, index) => {
            const isArchive = upload.analysisScope === "archive_candidate" || upload.deletionCandidate || index >= uploadStats.limit;
            return (
              <article className={`list-card ${isArchive ? "candidate-card" : ""}`} key={`${upload.weekKey}-${upload.uploadedAt}`}>
                <div>
                  <strong>{upload.weekKey}</strong>
                  <span>{upload.fileName}</span>
                  <span>{formatDateTime(upload.uploadedAt)}</span>
                </div>
                <div className="list-card-right">
                  <b>{upload.completedTotal}건</b>
                  <span className={`status-pill ${isArchive ? "warning" : "good"}`}>
                    {isArchive ? "아카이브 후보" : "활성"}
                  </span>
                  <span>{isArchive ? "백업 후 정리 권장" : "분석 대상"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h3>분석 캐시 상태</h3>
        <p className="note-text">
          분석 캐시는 업로드 데이터를 매번 새로 계산하지 않도록 저장해 둔 계산 결과입니다. 업로드 데이터가 바뀌면
          재생성이 필요할 수 있습니다.
        </p>
        <div className="cache-grid">
          <article className="cache-card">
            <div className="analysis-title">
              <div>
                <strong>라이더 프로필 캐시</strong>
                <p>{formatDateTime(summary.cacheStatus.riderProfileCacheUpdatedAt)}</p>
              </div>
              <span className="status-pill good">
                <CheckCircle2 size={13} /> 저장됨
              </span>
            </div>
          </article>
          {summary.cacheStatus.analysisCacheWeeks.length ? (
            summary.cacheStatus.analysisCacheWeeks.map((cache) => (
              <article className="cache-card" key={cache.weekKey}>
                <div className="analysis-title">
                  <div>
                    <strong>{cache.weekKey}</strong>
                    <p>생성 시간: {formatDateTime(cache.generatedAt)}</p>
                  </div>
                  <span className={`status-pill ${cacheTone(cache.status)}`}>
                    <Database size={13} /> {cacheStatusLabel(cache.status)}
                  </span>
                </div>
                <div className="mini-stat-grid">
                  <div>
                    <span>원본 오더 수</span>
                    <strong>{cache.sourceOrderCount}</strong>
                  </div>
                  <div>
                    <span>분석 라이더 수</span>
                    <strong>{cache.analyzedRiderCount}</strong>
                  </div>
                  <div>
                    <span>전체 완료건수</span>
                    <strong>{cache.totalCompleted}</strong>
                  </div>
                </div>
                <button className="secondary-button icon-button" type="button" onClick={handleRegenerateCaches}>
                  <RefreshCw size={16} /> 캐시 재생성
                </button>
              </article>
            ))
          ) : (
            <article className="cache-card candidate-card">
              <div className="analysis-title">
                <div>
                  <strong>분석 캐시 없음</strong>
                  <p>캐시 재생성 버튼을 눌러 현재 업로드 데이터 기준 분석 결과를 생성하세요.</p>
                </div>
                <span className="status-pill warning">캐시 없음</span>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>백업 포함 항목 점검</h3>
        <p className="note-text">비어 있음은 아직 저장된 데이터가 없다는 뜻입니다. 필수 키 자체가 없을 때만 점검이 필요합니다.</p>
        <div className="backup-check-grid">
          {summary.backupChecks.map((item) => (
            <article className={`backup-check-card ${item.status}`} key={item.key}>
              <strong>{item.key}</strong>
              <span>{backupStatusLabel(item.status)}</span>
              <b>{item.count}개</b>
            </article>
          ))}
        </div>
      </section>

      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}
