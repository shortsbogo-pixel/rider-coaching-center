import { useMemo, useState } from "react";
import { formatKakaoRiderMessage, formatSmsRiderMessage } from "../../utils/riderMessageFormatter";

interface MessageCopyPanelProps {
  riderName: string;
  riderMessage: string;
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: string;
}

export function MessageCopyPanel({ riderName, riderMessage, currentWeekCompleted, changeRate, riskLevel }: MessageCopyPanelProps) {
  const defaultKakaoText = useMemo(
    () => formatKakaoRiderMessage({ riderName, riderMessage, currentWeekCompleted, changeRate, riskLevel }),
    [changeRate, currentWeekCompleted, riderMessage, riderName, riskLevel]
  );
  const defaultSmsText = useMemo(
    () => formatSmsRiderMessage({ riderName, currentWeekCompleted, changeRate, riskLevel }),
    [changeRate, currentWeekCompleted, riderName, riskLevel]
  );
  const [kakaoText, setKakaoText] = useState(defaultKakaoText);
  const [smsText, setSmsText] = useState(defaultSmsText);
  const [status, setStatus] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setStatus(`${label} 복사 완료`);
      window.setTimeout(() => setStatus(""), 1800);
    } catch {
      setCopyFailed(true);
      setStatus(`${label} 자동 복사 실패`);
    }
  }

  return (
    <div className="message-copy-panel">
      <div className="message-copy-buttons">
        <button className="copy-button" type="button" onClick={() => copyText(kakaoText, "카톡용")}>
          카톡용 복사
        </button>
        <button className="copy-button" type="button" onClick={() => copyText(smsText, "문자용")}>
          문자용 복사
        </button>
      </div>
      {status ? <span className={`copy-toast ${copyFailed ? "error" : ""}`}>{status}</span> : null}
      <details className="message-copy-editor">
        <summary>발송 문구 편집</summary>
        <label>
          <span>카톡용</span>
          <textarea value={kakaoText} onChange={(event) => setKakaoText(event.target.value)} rows={5} />
        </label>
        <label>
          <span>문자용</span>
          <textarea value={smsText} onChange={(event) => setSmsText(event.target.value)} rows={3} />
        </label>
      </details>
    </div>
  );
}
