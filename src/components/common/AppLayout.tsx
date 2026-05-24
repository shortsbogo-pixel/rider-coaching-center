import { BarChart3, ChevronUp, Database, FileSpreadsheet, Home, LogOut, Menu, MessageSquareText, ShieldCheck, Target, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const adminPrimaryNavItems: NavItem[] = [
  { to: "/admin", label: "대시보드", icon: Home },
  { to: "/upload", label: "업로드", icon: FileSpreadsheet },
  { to: "/validation", label: "검수", icon: ShieldCheck },
  { to: "/coaching", label: "코칭", icon: MessageSquareText }
];

const adminSecondaryNavItems: NavItem[] = [
  { to: "/analysis", label: "분석", icon: BarChart3 },
  { to: "/missions", label: "미션", icon: Target },
  { to: "/data-management", label: "데이터", icon: Database },
  { to: "/rider", label: "라이더", icon: UserRound }
];

const riderNavItems: NavItem[] = [{ to: "/rider", label: "내 코칭", icon: UserRound }];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const primaryNavItems = isAdmin ? adminPrimaryNavItems : riderNavItems;
  const secondaryNavItems = isAdmin ? adminSecondaryNavItems : [];
  const isSecondaryActive = secondaryNavItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

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

      <div className={`bottom-nav-shell ${isAdmin ? "has-more" : "single"}`}>
        {secondaryNavItems.length ? (
          <div className={`nav-more-panel ${moreOpen ? "open" : ""}`} id="secondary-menu">
            <div className="nav-more-grid">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-more-link ${isActive ? "active" : ""}`}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              <button className="nav-more-link nav-logout" type="button" onClick={handleLogout}>
                <LogOut size={18} aria-hidden="true" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        ) : null}

        <nav className={`bottom-nav ${isAdmin ? "admin" : "single"}`} aria-label="주요 메뉴">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          {isAdmin ? (
            <button
              className={`nav-item nav-more-toggle ${moreOpen || isSecondaryActive ? "active" : ""}`}
              type="button"
              aria-expanded={moreOpen}
              aria-controls="secondary-menu"
              onClick={() => setMoreOpen((value) => !value)}
            >
              {moreOpen ? <ChevronUp size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              <span>더보기</span>
            </button>
          ) : (
            <button className="nav-item nav-logout" type="button" onClick={handleLogout}>
              <LogOut size={20} aria-hidden="true" />
              <span>로그아웃</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
