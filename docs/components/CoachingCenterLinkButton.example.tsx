import type { MouseEvent } from "react";

type CoachingCenterRole = "admin" | "rider";

interface CoachingCenterLinkButtonProps {
  role: CoachingCenterRole;
  riderId?: string;
  riderName?: string;
  weekKey?: string;
  openInNewTab?: boolean;
  className?: string;
}

const coachingCenterUrl = import.meta.env.VITE_COACHING_CENTER_URL ?? "http://localhost:5173";

function buildCoachingCenterUrl({ role, riderId, riderName, weekKey }: CoachingCenterLinkButtonProps) {
  if (role === "admin") {
    return `${coachingCenterUrl}/admin`;
  }

  const params = new URLSearchParams();
  if (riderId) {
    params.set("riderId", riderId);
  } else if (riderName) {
    params.set("riderName", riderName);
  }
  if (weekKey) {
    params.set("weekKey", weekKey);
  }

  const query = params.toString();
  return `${coachingCenterUrl}/rider${query ? `?${query}` : ""}`;
}

export function CoachingCenterLinkButton(props: CoachingCenterLinkButtonProps) {
  const href = buildCoachingCenterUrl(props);
  const label = props.role === "admin" ? "배차 코칭센터 관리" : "내 배차 코칭 보기";
  const target = props.openInNewTab ? "_blank" : undefined;
  const rel = props.openInNewTab ? "noreferrer" : undefined;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (props.role === "rider" && !props.riderId && !props.riderName) {
      event.preventDefault();
      alert("라이더 연결에는 riderId 또는 riderName이 필요합니다.");
    }
  }

  return (
    <a className={props.className ?? "coaching-center-link-button"} href={href} target={target} rel={rel} onClick={handleClick}>
      {label}
    </a>
  );
}

export function AdminCoachingCenterButton() {
  return <CoachingCenterLinkButton role="admin" openInNewTab />;
}

export function RiderCoachingCenterButton({ riderId, riderName }: { riderId?: string; riderName?: string }) {
  return <CoachingCenterLinkButton role="rider" riderId={riderId} riderName={riderName} openInNewTab />;
}
