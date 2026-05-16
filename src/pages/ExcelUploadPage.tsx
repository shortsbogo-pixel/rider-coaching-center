import { AlertCircle, CheckCircle2, FileUp, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeader } from "../components/common/SectionHeader";
import { requiredOrderColumns } from "../utils/excelParser";
import type { OrderRecord } from "../types/order";

const weeks = ["4월2주차", "4월3주차", "4월4주차", "5월1주차", "5월2주차"];

interface UploadedWeek {
  week: string;
  fileName: string;
  orderCount: number;
  completedTotal: number;
  issueCount: number;
  uploadedAt: string;
}

interface UploadPreview {
  status: "ready" | "blocked";
  sheetName: string;
  missingColumns: string[];
  previewRows: OrderRecord[];
  issues: Array<{ rowNumber: number; message: string }>;
}

export function ExcelUploadPage() {
  const [selectedWeek, setSelectedWeek] = useState(weeks[4]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedWeeks, setUploadedWeeks] = useState<UploadedWeek[]>([]);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadUploadedWeeks() {
    const response = await fetch("/api/uploads");
    const data = (await response.json()) as { weeks: UploadedWeek[] };
    setUploadedWeeks(data.weeks);
  }

  useEffect(() => {
    void loadUploadedWeeks().catch(() => setUploadedWeeks([]));
  }, []);

  async function submitUpload(mode: "preview" | "save") {
    if (!file) {
      setMessage("엑셀 파일을 먼저 선택하세요.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("week", selectedWeek);
    formData.append("file", file);

    try {
      const response = await fetch(mode === "preview" ? "/api/uploads/preview" : "/api/uploads", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "업로드 처리에 실패했습니다.");

      if (mode === "preview") {
        setPreview(data as UploadPreview);
        setMessage("파싱 미리보기를 생성했습니다.");
      } else {
        setPreview(null);
        setFile(null);
        setMessage(`${selectedWeek} 데이터가 저장되었습니다.`);
        await loadUploadedWeeks();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 처리에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  const uploadedWeekNames = uploadedWeeks.map((item) => item.week);

  return (
    <div className="page-stack">
      <SectionHeader title="Excel 업로드" description="오더별 상세내역서 시트를 파싱해 주차별 JSON 데이터로 저장합니다." />

      <section className="panel upload-panel">
        <label className="field">
          <span>주차 선택</span>
          <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)}>
            {weeks.map((week) => (
              <option key={week}>{week}</option>
            ))}
          </select>
        </label>

        <label className="dropzone">
          <FileUp size={28} aria-hidden="true" />
          <strong>{file?.name || "엑셀 파일 선택"}</strong>
          <span>오더별 상세내역서 시트를 우선 분석합니다.</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setMessage("");
            }}
          />
        </label>

        <div className="button-row">
          <button className="secondary-button" type="button" disabled={isLoading} onClick={() => void submitUpload("preview")}>
            파싱 미리보기
          </button>
          <button className="primary-button" type="button" disabled={isLoading} onClick={() => void submitUpload("save")}>
            업로드 저장
          </button>
        </div>

        {message ? <p className="form-message">{message}</p> : null}
      </section>

      <section className="panel">
        <h3>필수 컬럼 검증</h3>
        <div className="check-list">
          {requiredOrderColumns.map((column) => {
            const missing = preview?.missingColumns.includes(column);
            return (
              <div key={column} className={`check-row ${missing ? "error" : ""}`}>
                {missing ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span>{column}</span>
              </div>
            );
          })}
        </div>
      </section>

      {preview ? (
        <section className="panel">
          <h3>파싱 결과 미리보기</h3>
          <p className="preview-meta">
            시트: {preview.sheetName || "없음"} · 상태: {preview.status === "ready" ? "저장 가능" : "확인 필요"}
          </p>
          <div className="preview-table">
            {preview.previewRows.map((row) => (
              <article className="list-card" key={row.id}>
                <div>
                  <strong>{row.riderName || "이름 없음"}</strong>
                  <span>{row.pickupArea} → {row.deliveryArea}</span>
                </div>
                <div className="list-card-right">
                  <b>{row.completedCount}건</b>
                  <span>{row.timeSegment}</span>
                </div>
              </article>
            ))}
          </div>
          {preview.issues.length ? (
            <div className="issue-list">
              {preview.issues.slice(0, 5).map((issue) => (
                <p key={`${issue.rowNumber}-${issue.message}`}>행 {issue.rowNumber}: {issue.message}</p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <h3>업로드된 주차</h3>
        <div className="week-grid">
          {weeks.map((week) => {
            const uploaded = uploadedWeekNames.includes(week);
            const detail = uploadedWeeks.find((item) => item.week === week);
            return (
                <div className={`week-card ${uploaded ? "uploaded" : ""}`} key={week}>
                  <strong>{week}</strong>
                  <span>{uploaded ? `완료 ${detail?.completedTotal ?? detail?.orderCount ?? 0}건` : "대기"}</span>
                </div>
            );
          })}
        </div>
        <p className="note">
          <ShieldAlert size={16} /> 최대 8주차까지 보관하며, 같은 주차의 중복 업로드는 차단합니다.
        </p>
      </section>
    </div>
  );
}
