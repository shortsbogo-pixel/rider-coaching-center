import type { OperationSaveStatus } from "../../types/operation";

interface OperationStorageStatusProps {
  status: OperationSaveStatus;
  detail?: string;
}

export function OperationStorageStatus({ status, detail }: OperationStorageStatusProps) {
  const label = status === "server" ? "서버 저장 완료" : status === "local" ? "로컬 임시 저장" : "저장 실패";
  return (
    <section className="panel operation-storage-status">
      <span className={`operation-storage-badge ${status}`}>{label}</span>
      <p>{detail ?? "운영 데이터 저장 상태를 표시합니다."}</p>
    </section>
  );
}
