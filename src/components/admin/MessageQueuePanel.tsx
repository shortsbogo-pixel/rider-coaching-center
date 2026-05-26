import { useEffect, useMemo, useState } from "react";
import type { MessageQueueItem, MessageSendChannel, MessageSendStatus } from "../../types/messageQueue";
import { MessageQueueSummary } from "./MessageQueueSummary";

type QueueStatusFilter = "전체" | MessageSendStatus;
type QueueRiskFilter = "전체" | "고위험" | "관리주의" | "주의" | "안정" | "예외";
type QueueSortOption = "latest" | "risk" | "unsent" | "decline";
type CopyType = "kakao" | "sms";

const statusFilters: QueueStatusFilter[] = ["전체", "대기", "복사완료", "발송완료", "보류", "실패"];
const riskFilters: QueueRiskFilter[] = ["전체", "고위험", "관리주의", "주의", "안정", "예외"];
const channelOptions: MessageSendChannel[] = ["카톡", "문자", "전화", "직접상담", "기타"];

const sortOptions: Array<{ value: QueueSortOption; label: string }> = [
  { value: "latest", label: "최신순" },
  { value: "risk", label: "고위험 우선" },
  { value: "unsent", label: "미발송 우선" },
  { value: "decline", label: "하락세 우선" }
];

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function riskRank(riskLevel: string) {
  if (riskLevel === "고위험") return 0;
  if (riskLevel === "관리주의" || riskLevel === "주의") return 1;
  if (riskLevel === "안정") return 2;
  if (riskLevel === "에이스") return 3;
  return 4;
}

function trendRank(trendLabel?: string) {
  if (trendLabel === "급락") return 0;
  if (trendLabel === "하락세") return 1;
  if (trendLabel === "확인 필요" || trendLabel === "데이터 부족") return 2;
  return 3;
}

function riskMatches(item: MessageQueueItem, filter: QueueRiskFilter) {
  if (filter === "전체") return true;
  if (filter === "안정") return item.riskLevel === "안정" || item.riskLevel === "에이스";
  return item.riskLevel === filter;
}

function sentMessageFor(item: MessageQueueItem) {
  if (item.sendChannel === "문자") return item.smsMessage;
  if (item.sendChannel === "카톡") return item.kakaoMessage;
  return item.riderMessage;
}

export function MessageQueuePanel({
  items,
  onCopy,
  onMarkSent,
  onHold,
  onUpdate,
  onDelete
}: {
  items: MessageQueueItem[];
  onCopy: (item: MessageQueueItem, copyType: CopyType, text: string) => Promise<void> | void;
  onMarkSent: (item: MessageQueueItem, sentMessage: string) => Promise<void> | void;
  onHold: (item: MessageQueueItem) => Promise<void> | void;
  onUpdate: (item: MessageQueueItem) => Promise<void> | void;
  onDelete: (item: MessageQueueItem) => Promise<void> | void;
}) {
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("전체");
  const [riskFilter, setRiskFilter] = useState<QueueRiskFilter>("전체");
  const [sortOption, setSortOption] = useState<QueueSortOption>("latest");
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState("");
  const [manualCopyText, setManualCopyText] = useState("");

  useEffect(() => {
    setMemoDrafts((current) => {
      const next = { ...current };
      for (const item of items) {
        if (typeof next[item.id] === "undefined") {
          next[item.id] = item.memo ?? "";
        }
      }
      return next;
    });
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const statusMatched = statusFilter === "전체" || item.sendStatus === statusFilter;
      return statusMatched && riskMatches(item, riskFilter);
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === "risk") return riskRank(a.riskLevel) - riskRank(b.riskLevel) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOption === "unsent") return Number(a.sendStatus === "발송완료") - Number(b.sendStatus === "발송완료") || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOption === "decline") return trendRank(a.trendLabel) - trendRank(b.trendLabel) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, riskFilter, sortOption, statusFilter]);

  async function copyMessage(item: MessageQueueItem, copyType: CopyType) {
    const text = copyType === "kakao" ? item.kakaoMessage : item.smsMessage;
    try {
      await navigator.clipboard.writeText(text);
      setManualCopyText("");
      setCopyStatus(copyType === "kakao" ? "카톡 문구 복사 완료" : "문자 문구 복사 완료");
      await onCopy(item, copyType, text);
    } catch {
      setManualCopyText(text);
      setCopyStatus("자동 복사 실패. 아래 문구를 수동으로 복사하세요.");
    } finally {
      window.setTimeout(() => setCopyStatus(""), 1800);
    }
  }

  function updateMemo(item: MessageQueueItem) {
    const memo = memoDrafts[item.id] ?? "";
    if (memo === (item.memo ?? "")) return;
    void onUpdate({ ...item, memo, updatedAt: new Date().toISOString() });
  }

  return (
    <section className="panel message-queue-panel">
      <div className="operation-panel-title">
        <div>
          <h3>발송 대기함</h3>
          <p>AI 코칭 결과를 카톡/문자 발송 대상으로 관리합니다.</p>
        </div>
      </div>

      <MessageQueueSummary items={items} />

      <div className="message-queue-controls">
        <label>
          <span>상태</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as QueueStatusFilter)}>
            {statusFilters.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>위험도</span>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as QueueRiskFilter)}>
            {riskFilters.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>정렬</span>
          <select value={sortOption} onChange={(event) => setSortOption(event.target.value as QueueSortOption)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {copyStatus ? <span className="copy-toast message-queue-copy-status">{copyStatus}</span> : null}
      {manualCopyText ? <textarea className="manual-copy-box" readOnly value={manualCopyText} aria-label="수동 복사용 문구" /> : null}

      <div className="message-queue-list">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <article className={`message-queue-card ${item.sendStatus === "발송완료" ? "completed" : ""}`} key={item.id}>
              <div className="message-queue-card-head">
                <div>
                  <strong>{item.riderName}</strong>
                  <span>
                    {item.weekKey || "주차 미지정"} · {item.riskLevel} · {item.trendLabel ?? "추세 없음"}
                  </span>
                </div>
                <b className={`message-send-status status-${item.sendStatus}`}>{item.sendStatus}</b>
              </div>

              <div className="message-queue-meta">
                <span>생성 {formatDateTime(item.createdAt)}</span>
                {item.sentAt ? <span>발송 {formatDateTime(item.sentAt)}</span> : null}
              </div>

              <label className="message-queue-channel">
                <span>발송 채널</span>
                <select
                  value={item.sendChannel}
                  onChange={(event) => void onUpdate({ ...item, sendChannel: event.target.value as MessageSendChannel, updatedAt: new Date().toISOString() })}
                >
                  {channelOptions.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
              </label>

              <div className="message-queue-copy-grid">
                <div>
                  <strong>카톡용 문구</strong>
                  <p>{item.kakaoMessage}</p>
                  <button className="copy-button" type="button" onClick={() => void copyMessage(item, "kakao")}>
                    카톡 문구 복사
                  </button>
                </div>
                <div>
                  <strong>문자용 문구</strong>
                  <p>{item.smsMessage}</p>
                  <button className="copy-button" type="button" onClick={() => void copyMessage(item, "sms")}>
                    문자 문구 복사
                  </button>
                </div>
              </div>

              <label className="message-queue-memo">
                <span>메모</span>
                <textarea
                  value={memoDrafts[item.id] ?? ""}
                  onChange={(event) => setMemoDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  onBlur={() => updateMemo(item)}
                  rows={3}
                />
              </label>

              <div className="message-queue-actions">
                <button className="ai-coaching-button" type="button" onClick={() => void onMarkSent(item, sentMessageFor(item))} disabled={item.sendStatus === "발송완료"}>
                  발송완료 처리
                </button>
                <button className="secondary-link-button" type="button" onClick={() => void onHold(item)} disabled={item.sendStatus === "발송완료"}>
                  보류 처리
                </button>
                <button className="secondary-link-button danger" type="button" onClick={() => void onDelete(item)}>
                  삭제
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="operation-empty-message">발송 대기 항목이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
