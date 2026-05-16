import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "../../types/auth";
import { useAuth } from "../../hooks/useAuth";

export function ProtectedRoute({ allowedRoles, children }: { allowedRoles: UserRole[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="page-stack">
        <section className="panel auth-panel">
          <h3>접근 권한이 없습니다</h3>
          <p>관리자 계정으로 로그인해 주세요.</p>
          <Link className="secondary-link-button" to="/login">
            로그인 화면으로 이동
          </Link>
        </section>
      </div>
    );
  }

  return <>{children}</>;
}
