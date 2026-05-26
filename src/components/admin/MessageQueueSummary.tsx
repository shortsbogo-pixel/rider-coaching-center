import type { MessageQueueItem } from "../../types/messageQueue";

function isUnsent(item: MessageQueueItem) {
  return item.sendStatus !== "발송완료";
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function MessageQueueSummary({ items }: { items: MessageQueueItem[] }) {
  const pendingCount = items.filter(isUnsent).length;
  const highRiskUnsentCount = items.filter((item) => item.riskLevel === "고위험" && isUnsent(item)).length;
  const todayCreatedCount = items.filter((item) => isToday(item.createdAt)).length;
  const completedCount = items.filter((item) => item.sendStatus === "발송완료").length;
  const heldCount = items.filter((item) => item.sendStatus === "보류").length;

  return (
    <section className={`message-queue-summary ${highRiskUnsentCount ? "warning" : ""}`}>
      <article>
        <span>전체 대기 건수</span>
        <strong>{pendingCount}건</strong>
      </article>
      <article className={highRiskUnsentCount ? "danger" : ""}>
        <span>고위험 미발송</span>
        <strong>{highRiskUnsentCount}건</strong>
      </article>
      <article>
        <span>오늘 생성</span>
        <strong>{todayCreatedCount}건</strong>
      </article>
      <article className="good">
        <span>발송 완료</span>
        <strong>{completedCount}건</strong>
      </article>
      <article>
        <span>보류</span>
        <strong>{heldCount}건</strong>
      </article>
      {highRiskUnsentCount ? <p className="message-queue-warning">고위험 미발송 항목을 먼저 확인하세요.</p> : null}
    </section>
  );
}
