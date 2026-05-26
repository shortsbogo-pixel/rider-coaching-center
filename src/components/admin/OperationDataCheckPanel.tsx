import type { OperationDataCheckItem } from "../../utils/operationDataValidator";

interface OperationDataCheckPanelProps {
  items: OperationDataCheckItem[];
}

export function OperationDataCheckPanel({ items }: OperationDataCheckPanelProps) {
  return (
    <section className="panel operation-data-check-panel">
      <div className="operation-panel-title">
        <div>
          <h3>운영 데이터 검수</h3>
          <p>현재 화면 데이터와 저장된 AI 운영 데이터 상태를 확인합니다.</p>
        </div>
      </div>

      <div className="operation-check-grid">
        {items.map((item) => (
          <article className={`operation-check-card ${item.tone}`} key={item.id}>
            <div>
              <span>{item.label}</span>
              <b className={`status-pill ${item.tone}`}>{item.badge}</b>
            </div>
            <strong>{item.value}</strong>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
