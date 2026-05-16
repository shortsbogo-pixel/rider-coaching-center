import { Database, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { MetricCard } from "../components/common/MetricCard";
import { SectionHeader } from "../components/common/SectionHeader";
import { dataManagementRepository, type DataManagementSummary } from "../storage/dataManagementRepository";
import { downloadJson } from "../storage/storageClient";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function DataManagementPage() {
  const [summary, setSummary] = useState<DataManagementSummary | null>(null);
  const [message, setMessage] = useState("");

  async function loadSummary() {
    setSummary(await dataManagementRepository.getSummary());
  }

  useEffect(() => {
    loadSummary().catch(() => setMessage("데이터 관리 정보를 불러오지 못했습니다."));
  }, []);

  async function handleExport(type: string, label: string) {
    const data = await dataManagementRepository.exportData(type);
    downloadJson(`rider-coaching-${label}-${new Date().toISOString().slice(0, 10)}.json`, data);
    setMessage(`${label} 데이터를 내보냈습니다.`);
  }

  async function handleRegenerateCaches() {
    if (!window.confirm("분석 캐시와 라이더 프로필 캐시를 다시 생성할까요? 기존 캐시는 새 계산값으로 교체됩니다.")) return;
    const result = await dataManagementRepository.regenerateCaches();
    setSummary(result.summary);
    setMessage("캐시를 재생성했습니다.");
  }

  if (!summary) {
    return (
      <div className="page-stack">
        <SectionHeader title="데이터 관리" description="저장 구조와 캐시 상태를 불러오는 중입니다." />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <SectionHeader title="데이터 관리" description="JSON 저장소, 캐시, 백업 데이터를 한 곳에서 확인합니다." />

      <div className="metric-grid">
        <MetricCard label="업로드 이력" value={`${summary.counts.uploadHistory}건`} />
        <MetricCard label="파싱 오더" value={`${summary.counts.parsedOrders}행`} tone="good" />
        <MetricCard label="라이더 캐시" value={`${summary.counts.riderProfileCache}명`} />
        <MetricCard label="관리자 메모" value={`${summary.counts.adminNotes}건`} />
        <MetricCard label="저장 코칭" value={`${summary.counts.customCoachingMessages}건`} />
        <MetricCard label="분석 캐시" value={`${summary.counts.analysisCaches}개`} />
        <MetricCard label="보관 정책" value={`${summary.settings.retentionWeeks}주차`} />
        <MetricCard label="삭제 후보" value={`${summary.cacheStatus.deletionCandidates.length}건`} tone={summary.cacheStatus.deletionCandidates.length ? "warning" : "default"} />
      </div>

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
        <p className="note-text">가져오기/충돌 복원은 9차 이후 DB 전환 단계에서 더 안전하게 연결합니다.</p>
      </section>

      <section className="panel">
        <h3>업로드 이력</h3>
        <div className="rider-list">
          {summary.uploads.map((upload) => (
            <article className="list-card" key={upload.weekKey}>
              <div>
                <strong>{upload.weekKey}</strong>
                <span>{upload.fileName}</span>
                <span>{formatDateTime(upload.uploadedAt)}</span>
              </div>
              <div className="list-card-right">
                <b>{upload.completedTotal}건</b>
                <span>{upload.deletionCandidate ? "삭제 후보" : upload.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>캐시 상태</h3>
        <div className="tag-cloud">
          <span>라이더 캐시: {formatDateTime(summary.cacheStatus.riderProfileCacheUpdatedAt)}</span>
          {summary.cacheStatus.analysisCacheWeeks.map((cache) => (
            <span key={cache.weekKey}>
              <Database size={13} /> {cache.weekKey} · {formatDateTime(cache.generatedAt)}
            </span>
          ))}
        </div>
      </section>

      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}
