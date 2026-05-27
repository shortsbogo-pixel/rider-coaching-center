import { FileUp, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { RequiredColumnHealth } from "../components/common/RequiredColumnHealth";
import { SectionHeader } from "../components/common/SectionHeader";
import type { OrderRecord } from "../types/order";

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
  summary?: {
    totalRows: number;
    parsedRows: number;
    riderNameDetectedRows: number;
    riderNameMissingRows: number;
    deliveryTypeParsedRows: number;
    deliveryTypeReviewRows: number;
    numberConversionWarningRows: number;
    duplicateRiderCount: number;
    warningRows: number;
    analysisTargetRiderCount: number;
    issueCount: number;
    displayedIssueCount: number;
  };
}

function parseWeekLabel(week: string) {
  const month = Number(week.match(/(\d+)\s*월/)?.[1] ?? 0);
  const weekNo = Number(week.match(/(\d+)\s*주차/)?.[1] ?? 0);
  return month && weekNo ? { month, weekNo } : null;
}

function getWeekSortValue(week: string) {
  const parsed = parseWeekLabel(week);
  return parsed ? parsed.month * 10 + parsed.weekNo : 0;
}

function getNextWeekLabel(uploadedWeeks: UploadedWeek[]) {
  const latest = [...uploadedWeeks]
    .map((item) => parseWeekLabel(item.week))
    .filter((item): item is { month: number; weekNo: number } => Boolean(item))
    .sort((a, b) => b.month * 10 + b.weekNo - (a.month * 10 + a.weekNo))[0];

  if (!latest) return "";
  const nextMonth = latest.weekNo >= 4 ? latest.month + 1 : latest.month;
  const nextWeekNo = latest.weekNo >= 4 ? 1 : latest.weekNo + 1;
  return `${nextMonth}월${nextWeekNo}주차`;
}

function buildWeekOptions(uploadedWeeks: UploadedWeek[]) {
  const nextWeek = getNextWeekLabel(uploadedWeeks);
  return [...new Set([nextWeek, ...uploadedWeeks.map((item) => item.week)])].filter(Boolean);
}

export function ExcelUploadPage() {
  const [selectedWeek, setSelectedWeek] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadedWeeks, setUploadedWeeks] = useState<UploadedWeek[]>([]);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadUploadedWeeks() {
    const response = await fetch("/api/uploads");
    const data = (await response.json()) as { weeks: UploadedWeek[] };
    setUploadedWeeks(data.weeks);
    setSelectedWeek((current) => current || getNextWeekLabel(data.weeks) || data.weeks[0]?.week || "");
  }

  useEffect(() => {
    void loadUploadedWeeks().catch(() => setUploadedWeeks([]));
  }, []);

  async function submitUpload(mode: "preview" | "save") {
    const weekKey = selectedWeek.trim();
    if (!weekKey) {
      setMessage("업로드할 주차를 입력하세요.");
      return;
    }

    if (!file) {
      setMessage("엑셀 파일을 먼저 선택하세요.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("week", weekKey);
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
        setMessage(`${weekKey} 데이터가 저장되었습니다.`);
        await loadUploadedWeeks();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 처리에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  const uploadedWeekNames = uploadedWeeks.map((item) => item.week);
  const weekOptions = buildWeekOptions(uploadedWeeks);
  const sortedUploadedWeeks = [...uploadedWeeks].sort((a, b) => getWeekSortValue(b.week) - getWeekSortValue(a.week));

  return (
    <div className="page-stack upload-page">
      <SectionHeader title="Excel 업로드" description="오더별 상세내역서 시트를 파싱해 주차별 JSON 데이터로 저장합니다." />

      <section className="panel upload-panel upload-workbench">
        <div className="analysis-title">
          <div>
            <p className="eyebrow">주차 누적 업로드</p>
            <h3>{selectedWeek || "주차 선택 필요"}</h3>
            <p>새 Excel은 기존 주차를 유지한 채 선택한 주차로 추가됩니다.</p>
          </div>
          <span className={`status-pill ${file ? "good" : "warning"}`}>{file ? "파일 선택됨" : "파일 대기"}</span>
        </div>

        <div className="upload-form-grid">
          <label className="field">
            <span>주차 선택/입력</span>
            <input
              list="week-options"
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(event.target.value)}
              placeholder="예: 5월3주차"
            />
            <datalist id="week-options">
              {weekOptions.map((week) => (
                <option key={week} value={week} />
              ))}
            </datalist>
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
        </div>

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

      <RequiredColumnHealth
        weekKey={preview ? selectedWeek : undefined}
        missingColumns={preview?.missingColumns}
        refreshKey={uploadedWeeks.length}
        title="필수 컬럼 검증"
        description={
          preview
            ? "선택한 Excel 미리보기 기준으로 필수 컬럼 누락 여부를 확인합니다."
            : "저장된 최신 업로드 주차 기준으로 필수 컬럼 상태를 확인합니다."
        }
      />

      {preview ? (
        <section className="panel preview-panel">
          <h3>파싱 결과 미리보기</h3>
          <p className="preview-meta">
            시트: {preview.sheetName || "없음"} · 상태: {preview.status === "ready" ? "저장 가능" : "확인 필요"}
          </p>
          {preview.summary ? (
            <div className="validation-grid">
              <div>
                <strong>{preview.summary.totalRows}</strong>
                <span>총 행 수</span>
              </div>
              <div>
                <strong>{preview.summary.parsedRows}</strong>
                <span>정상 파싱</span>
              </div>
              <div>
                <strong>{preview.summary.riderNameDetectedRows}</strong>
                <span>라이더명 인식</span>
              </div>
              <div>
                <strong>{preview.summary.riderNameMissingRows}</strong>
                <span>라이더명 누락</span>
              </div>
              <div>
                <strong>{preview.summary.deliveryTypeParsedRows}</strong>
                <span>배달타입 정상</span>
              </div>
              <div>
                <strong>{preview.summary.deliveryTypeReviewRows}</strong>
                <span>배달타입 확인필요</span>
              </div>
              <div>
                <strong>{preview.summary.numberConversionWarningRows}</strong>
                <span>숫자 변환 경고</span>
              </div>
              <div>
                <strong>{preview.summary.duplicateRiderCount}</strong>
                <span>중복 라이더</span>
              </div>
              <div>
                <strong>{preview.summary.warningRows}</strong>
                <span>제외/경고 행</span>
              </div>
              <div>
                <strong>{preview.summary.analysisTargetRiderCount}</strong>
                <span>분석 대상</span>
              </div>
            </div>
          ) : null}
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

      <section className="panel uploaded-weeks-panel">
        <h3>업로드된 주차</h3>
        <div className="week-grid">
          {sortedUploadedWeeks.map((item) => {
            const week = item.week;
            const uploaded = uploadedWeekNames.includes(week);
            return (
                <div className={`week-card ${uploaded ? "uploaded" : ""}`} key={week}>
                  <strong>{week}</strong>
                  <span>{uploaded ? `완료 ${item.completedTotal ?? item.orderCount ?? 0}건` : "대기"}</span>
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
