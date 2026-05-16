import { useEffect, useMemo, useState } from "react";
import { RiskBadge } from "../components/admin/RiskBadge";
import { SectionHeader } from "../components/common/SectionHeader";
import type { AdminNote } from "../types/adminNote";
import type { CoachingMessage, CustomCoachingMessage } from "../types/coaching";
import { fetchAdminNotes, saveAdminNote } from "../utils/adminNoteStore";
import { getAuthHeader } from "../utils/authStore";
import {
  fetchCustomCoachingMessages,
  resetCustomCoachingMessage,
  saveCustomCoachingMessage
} from "../utils/coachingMessageStore";

interface CoachingPayload {
  basisWeek: string;
  isFallbackWeek: boolean;
  notice: string;
  messages: CoachingMessage[];
}

const emptyPayload: CoachingPayload = {
  basisWeek: "",
  isFallbackWeek: false,
  notice: "업로드 데이터 기준 코칭 메시지를 불러오는 중입니다.",
  messages: []
};

function formatAutoMessage(coaching: CoachingMessage) {
  const actions = coaching.recommendedActions.map((item) => `- ${item}`).join("\n");
  const tips = coaching.profitTips.map((item) => `- ${item}`).join("\n");
  return [
    coaching.summary,
    "",
    `이번 주 실천 미션: ${coaching.weeklyMission}`,
    "",
    "추천 행동",
    actions || "- 현재 패턴을 유지하면서 포스트구간 참여를 확인하세요.",
    "",
    "수익 극대화 팁",
    tips || "- 피크타임 이후 짧은 추가 운행으로 완료건수를 방어하세요."
  ].join("\n");
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function CoachingMessagePage() {
  const [payload, setPayload] = useState<CoachingPayload>(emptyPayload);
  const [selectedId, setSelectedId] = useState("");
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [customMessages, setCustomMessages] = useState<CustomCoachingMessage[]>([]);
  const [adminMemo, setAdminMemo] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    fetch("/api/coaching", { headers: getAuthHeader() })
      .then((response) => response.json())
      .then((data) => {
        const next = Array.isArray(data)
          ? { basisWeek: "", isFallbackWeek: false, notice: "", messages: data as CoachingMessage[] }
          : (data as CoachingPayload);
        setPayload(next);
        setSelectedId(next.messages[0]?.riderId ?? "");
      })
      .catch(() => setStatusMessage("코칭 데이터를 불러오지 못했습니다. backend 서버 상태를 확인해 주세요."));
  }, []);

  useEffect(() => {
    if (!payload.basisWeek) return;
    Promise.all([fetchAdminNotes(payload.basisWeek), fetchCustomCoachingMessages(payload.basisWeek)])
      .then(([nextNotes, nextMessages]) => {
        setNotes(nextNotes);
        setCustomMessages(nextMessages);
      })
      .catch(() => setStatusMessage("저장된 관리자 데이터를 불러오지 못했습니다."));
  }, [payload.basisWeek]);

  const coaching = useMemo(
    () => payload.messages.find((message) => message.riderId === selectedId) ?? payload.messages[0],
    [payload.messages, selectedId]
  );
  const savedNote = notes.find((note) => note.riderId === coaching?.riderId && note.weekKey === payload.basisWeek);
  const savedCustom = customMessages.find(
    (message) => message.riderId === coaching?.riderId && message.weekKey === payload.basisWeek
  );
  const autoMessage = coaching ? formatAutoMessage(coaching) : "";

  useEffect(() => {
    setAdminMemo(savedNote?.note ?? "");
    setCustomMessage(savedCustom?.isCustom ? savedCustom.customMessage : autoMessage);
  }, [autoMessage, savedCustom, savedNote, selectedId]);

  async function handleSaveMemo() {
    if (!coaching) return;
    const saved = await saveAdminNote({
      riderId: coaching.riderId,
      riderName: coaching.riderName,
      weekKey: payload.basisWeek,
      note: adminMemo,
      updatedBy: "admin"
    });
    setNotes((current) => [
      ...current.filter((note) => !(note.riderId === saved.riderId && note.weekKey === saved.weekKey)),
      ...(saved.note.trim() ? [saved] : [])
    ]);
    setStatusMessage("관리자 메모를 저장했습니다.");
  }

  async function handleSaveCustomMessage() {
    if (!coaching) return;
    const saved = await saveCustomCoachingMessage({
      riderId: coaching.riderId,
      riderName: coaching.riderName,
      weekKey: payload.basisWeek,
      autoMessage,
      customMessage
    });
    setCustomMessages((current) => [
      ...current.filter((message) => !(message.riderId === saved.riderId && message.weekKey === saved.weekKey)),
      saved
    ]);
    setStatusMessage("라이더용 코칭 메시지를 저장했습니다.");
  }

  async function handleResetCustomMessage() {
    if (!coaching) return;
    await resetCustomCoachingMessage(coaching.riderId, payload.basisWeek);
    setCustomMessages((current) =>
      current.filter((message) => !(message.riderId === coaching.riderId && message.weekKey === payload.basisWeek))
    );
    setCustomMessage(autoMessage);
    setStatusMessage("자동 생성 메시지로 되돌렸습니다.");
  }

  if (!coaching) {
    return (
      <div className="page-stack">
        <SectionHeader title="코칭 메시지" description="표시할 라이더 데이터가 없습니다. Excel 업로드를 다시 확인해 주세요." />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <SectionHeader title="코칭 메시지" description="실제 주차별 운행 패턴을 기준으로 라이더별 코칭 문구를 관리합니다." />

      <section className={`panel ${payload.isFallbackWeek ? "notice-panel" : ""}`}>
        <h3>코칭 기준</h3>
        <p>{payload.notice || `${payload.basisWeek} 기준으로 생성되었습니다.`}</p>
      </section>

      <section className="panel">
        <label className="field">
          <span>라이더 선택</span>
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {payload.messages.map((message) => (
              <option key={message.riderId} value={message.riderId}>
                {message.riderName}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel coaching-card">
        <div className="analysis-title">
          <div>
            <h3>{coaching.riderName}</h3>
            <p>{savedCustom?.isCustom ? "저장된 수정 메시지를 우선 표시합니다." : "자동 생성 메시지를 기본으로 표시합니다."}</p>
          </div>
          <RiskBadge level={coaching.riskLevel} />
        </div>

        <label className="field">
          <span>자동 생성 메시지</span>
          <textarea value={autoMessage} readOnly rows={7} />
        </label>

        <label className="field">
          <span>관리자 수정 메시지</span>
          <textarea value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} rows={9} />
        </label>
        <p className="note-text">저장된 코칭 메시지는 추후 라이더 로그인 기능 연결 시 라이더 화면에 표시됩니다.</p>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={handleSaveCustomMessage}>
            코칭 메시지 저장
          </button>
          <button className="secondary-button" type="button" onClick={handleResetCustomMessage}>
            자동 생성 메시지로 되돌리기
          </button>
        </div>
        {savedCustom?.updatedAt ? <p className="note-text">마지막 메시지 저장: {formatDateTime(savedCustom.updatedAt)}</p> : null}
      </section>

      <section className="panel coaching-card">
        <h3>관리자 내부 메모</h3>
        <p className="note-text">
          이 메모는 관리자 전용이며, 라이더에게 노출되는 코칭 메시지와 별도로 저장됩니다. 라이더 화면에는 표시되지
          않습니다.
        </p>
        <label className="field">
          <span>라이더별 메모</span>
          <textarea
            value={adminMemo}
            onChange={(event) => setAdminMemo(event.target.value)}
            placeholder="예: 포스트런치 참여율이 낮음. 다음 주 14:00~16:30 구간 2콜 이상 유지 안내 필요."
            rows={5}
          />
        </label>
        <button className="primary-button" type="button" onClick={handleSaveMemo}>
          관리자 메모 저장
        </button>
        {savedNote?.updatedAt ? <p className="note-text">마지막 메모 저장: {formatDateTime(savedNote.updatedAt)}</p> : null}
      </section>

      {statusMessage ? <p className="form-message">{statusMessage}</p> : null}
    </div>
  );
}
