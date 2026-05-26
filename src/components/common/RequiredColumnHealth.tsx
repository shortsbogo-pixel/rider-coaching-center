import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { requiredOrderColumns } from "../../utils/excelParser";
import { getLatestWeekKey, sortWeekKeys } from "../../utils/weekSelector";

interface ValidationUpload {
  week: string;
  missingColumns: string[];
  issueCount: number;
}

interface ValidationSummary {
  uploads?: ValidationUpload[];
}

interface RequiredColumnHealthProps {
  weekKey?: string;
  missingColumns?: string[];
  title?: string;
  description?: string;
  compact?: boolean;
  refreshKey?: string | number;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function RequiredColumnHealth({
  weekKey,
  missingColumns,
  title = "필수 컬럼 검증",
  description,
  compact = false,
  refreshKey
}: RequiredColumnHealthProps) {
  const usesExternalMissingColumns = Array.isArray(missingColumns);
  const [uploads, setUploads] = useState<ValidationUpload[]>([]);
  const [isLoading, setIsLoading] = useState(!usesExternalMissingColumns);

  useEffect(() => {
    if (usesExternalMissingColumns) {
      setIsLoading(false);
      return;
    }

    let ignore = false;
    setIsLoading(true);

    fetch("/api/uploads/validation")
      .then((response) => response.json())
      .then((data: ValidationSummary) => {
        if (!ignore) setUploads(data.uploads ?? []);
      })
      .catch(() => {
        if (!ignore) setUploads([]);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [refreshKey, usesExternalMissingColumns]);

  const weekOptions = useMemo(() => sortWeekKeys(uploads.map((upload) => upload.week)), [uploads]);
  const activeWeek = usesExternalMissingColumns ? weekKey ?? "" : weekKey || getLatestWeekKey(weekOptions);
  const activeUploads = activeWeek ? uploads.filter((upload) => upload.week === activeWeek) : [];
  const resolvedMissingColumns = usesExternalMissingColumns
    ? unique(missingColumns ?? [])
    : unique(activeUploads.flatMap((upload) => upload.missingColumns ?? []));
  const missingColumnSet = new Set(resolvedMissingColumns);
  const hasValidationData = usesExternalMissingColumns || activeUploads.length > 0;
  const validCount = hasValidationData ? requiredOrderColumns.filter((column) => !missingColumnSet.has(column)).length : 0;
  const issueCount = activeUploads.reduce((sum, upload) => sum + (upload.issueCount ?? 0), 0);
  const statusTone = !hasValidationData || isLoading ? "warning" : resolvedMissingColumns.length ? "danger" : "good";
  const statusLabel = isLoading ? "확인 중" : !hasValidationData ? "데이터 없음" : resolvedMissingColumns.length ? "확인 필요" : "정상";
  const helperText =
    description ??
    (hasValidationData
      ? "코칭 분석에 필요한 원본 컬럼이 주차 데이터에 들어있는지 확인합니다."
      : "업로드 저장 또는 미리보기를 실행하면 필수 컬럼 상태를 확인할 수 있습니다.");

  return (
    <section className={`panel required-column-panel ${compact ? "compact" : ""}`}>
      <div className="analysis-title">
        <div>
          <h3>{title}</h3>
          <p>{helperText}</p>
        </div>
        <span className={`status-pill ${statusTone}`}>
          <ShieldCheck size={14} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className="required-column-summary">
        <article>
          <span>기준 주차</span>
          <strong>{activeWeek || "-"}</strong>
        </article>
        <article>
          <span>정상 컬럼</span>
          <strong>
            {validCount}/{requiredOrderColumns.length}
          </strong>
        </article>
        <article>
          <span>확인 필요</span>
          <strong>{resolvedMissingColumns.length}개</strong>
        </article>
        {!usesExternalMissingColumns ? (
          <article>
            <span>검수 이슈</span>
            <strong>{issueCount}건</strong>
          </article>
        ) : null}
      </div>

      <div className="required-column-list" aria-label="필수 컬럼 검증 항목">
        {requiredOrderColumns.map((column) => {
          const checked = hasValidationData && !isLoading;
          const missing = checked && missingColumnSet.has(column);
          return (
            <div className={`required-column-item ${!checked ? "pending" : missing ? "missing" : "valid"}`} key={column}>
              {missing ? <AlertCircle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
              <span>{column}</span>
              <b>{!checked ? "대기" : missing ? "확인" : "정상"}</b>
            </div>
          );
        })}
      </div>
    </section>
  );
}
