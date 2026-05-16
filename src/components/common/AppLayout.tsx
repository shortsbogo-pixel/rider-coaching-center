import { BarChart3, Database, FileSpreadsheet, Home, LogOut, MessageSquareText, ShieldCheck, Target, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const adminNavItems = [
  { to: "/admin", label: "대시보드", icon: Home },
  { to: "/upload", label: "업로드", icon: FileSpreadsheet },
  { to: "/validation", label: "검수", icon: ShieldCheck },
  { to: "/analysis", label: "분석", icon: BarChart3 },
  { to: "/missions", label: "미션", icon: Target },
  { to: "/coaching", label: "코칭", icon: MessageSquareText },
  { to: "/data-management", label: "데이터", icon: Database },
  { to: "/rider", label: "라이더", icon: UserRound }
];

const riderNavItems = [{ to: "/rider", label: "내 코칭", icon: UserRound }];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = user?.role === "admin" ? adminNavItems : riderNavItems;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Coupang Eats Plus</p>
          <h1>라이더 코칭센터</h1>
        </div>
        <div className="topbar-actions">
          <span className="status-pill">{user ? `${user.displayName} · ${user.role}` : "로그인 필요"}</span>
          <button className="logout-button" type="button" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      <main className="page-wrap">{children}</main>

      <nav className={`bottom-nav ${user?.role === "rider" ? "single" : ""}`} aria-label="주요 메뉴" style={{ gridTemplateColumns: `repeat(${navItems.length + 1}, 1fr)` }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <button className="nav-item nav-logout" type="button" onClick={handleLogout}>
          <LogOut size={20} aria-hidden="true" />
          <span>로그아웃</span>
        </button>
      </nav>
    </div>
  );
}
