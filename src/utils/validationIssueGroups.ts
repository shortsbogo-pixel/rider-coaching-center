export interface ValidationIssueLike {
  rowNumber: number;
  week: string;
  type: string;
  message: string;
  rawValue?: string;
}

export interface ValidationIssueGroup {
  type: string;
  label: string;
  count: number;
  rows: Array<{
    rowNumber: number;
    week: string;
    rawValue?: string;
    message: string;
  }>;
}

const issueGroupLabels: Record<string, string> = {
  missing_value: "빈값/누락",
  missing_rider_name_column: "라이더명 컬럼 누락",
  missing_rider_name: "라이더명 누락",
  invalid_completed_count: "숫자 변환 확인필요",
  invalid_delivery_type: "배달타입 확인필요",
  invalid_time_segment: "시간대 확인필요",
  parsed_json_error: "JSON 파싱 오류",
  outlier: "이상치"
};

export function getValidationIssueLabel(type: string) {
  return issueGroupLabels[type] ?? type;
}

export function groupValidationIssues(issues: ValidationIssueLike[]): ValidationIssueGroup[] {
  const grouped = issues.reduce<Record<string, ValidationIssueGroup>>((acc, issue) => {
    const key = issue.type;
    const current = acc[key] ?? {
      type: issue.type,
      label: getValidationIssueLabel(issue.type),
      count: 0,
      rows: []
    };
    current.count += 1;
    if (current.rows.length < 30) {
      current.rows.push({
        rowNumber: issue.rowNumber,
        week: issue.week,
        rawValue: issue.rawValue,
        message: issue.message
      });
    }
    acc[key] = current;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"));
}
