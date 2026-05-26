import { useEffect, useMemo, useState } from "react";
import { formatKakaoRiderMessage, formatSmsRiderMessage } from "../../utils/riderMessageFormatter";

interface MessageCopyPanelProps {
  riderName: string;
  weekKey?: string;
  riderMessage: string;
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: string;
  onCopied?: (payload: { copyType: CopyType; text: string; riderName: string; weekKey?: string }) => void;
}

type CopyType = "kakao" | "sms";

const copyLabels: Record<CopyType, string> = {
  kakao: "카톡용",
  sms: "문자용"
};

export function MessageCopyPanel({ riderName, weekKey, riderMessage, currentWeekCompleted, changeRate, riskLevel, onCopied }: MessageCopyPanelProps) {
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
  const [failedType, setFailedType] = useState<CopyType | null>(null);

  useEffect(() => {
    setKakaoText(defaultKakaoText);
    setSmsText(defaultSmsText);
    setStatus("");
    setFailedType(null);
  }, [defaultKakaoText, defaultSmsText]);

  async function copyText(type: CopyType) {
    const text = type === "kakao" ? kakaoText : smsText;
    try {
      await navigator.clipboard.writeText(text);
      setFailedType(null);
      setStatus(`${copyLabels[type]} 복사 완료`);
      onCopied?.({ copyType: type, text, riderName, weekKey });
      window.setTimeout(() => setStatus(""), 1800);
    } catch {
      setFailedType(type);
      setStatus(`${copyLabels[type]} 자동 복사 실패`);
    }
  }

  return (
    <div className="message-copy-panel">
      <div className="message-copy-buttons">
        <button className="copy-button" type="button" onClick={() => copyText("kakao")}>
          카톡용 복사
        </button>
        <button className="copy-button" type="button" onClick={() => copyText("sms")}>
          문자용 복사
        </button>
      </div>
      {status ? <span className={`copy-toast ${failedType ? "error" : ""}`}>{status}</span> : null}

      <details className="message-copy-editor">
        <summary>발송 문구 수정</summary>
        <label>
          <span>카톡용 문구</span>
          <textarea value={kakaoText} onChange={(event) => setKakaoText(event.target.value)} rows={6} />
        </label>
        <label>
          <span>문자용 문구</span>
          <textarea value={smsText} onChange={(event) => setSmsText(event.target.value)} rows={4} />
        </label>
      </details>

      {failedType ? (
        <textarea
          className="manual-copy-box"
          readOnly
          value={failedType === "kakao" ? kakaoText : smsText}
          aria-label={`${copyLabels[failedType]} 수동 복사용 문구`}
        />
      ) : null}
    </div>
  );
}
