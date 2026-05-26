import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { testUsers } from "../utils/authStore";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showAccounts, setShowAccounts] = useState(false);

  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  if (user?.role === "rider") return <Navigate to="/rider" replace />;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const nextUser = login({ id, password });
      const fallbackPath = nextUser.role === "admin" ? "/admin" : "/rider";
      const from = (location.state as { from?: string } | null)?.from;
      const nextPath = nextUser.role === "rider" && from?.startsWith("/rider") ? from : fallbackPath;
      navigate(nextPath, { replace: true });
    } catch (loginError) {
      setError((loginError as Error).message);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div>
          <p className="eyebrow">Coupang Eats Plus</p>
          <h1>라이더 코칭센터</h1>
          <p>관리자와 라이더 권한을 분리한 MVP 로그인입니다.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>아이디</span>
            <input value={id} onChange={(event) => setId(event.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="form-message error-text">{error}</p> : null}
          <button className="primary-button" type="submit">
            로그인
          </button>
        </form>

        <button className="secondary-button" type="button" onClick={() => setShowAccounts((value) => !value)}>
          테스트 계정 {showAccounts ? "접기" : "보기"}
        </button>

        {showAccounts ? (
          <div className="test-account-list">
            {testUsers.map((account) => (
              <div key={account.id}>
                <strong>{account.role === "admin" ? "관리자" : "라이더"} 계정</strong>
                <span>
                  {account.id} / {account.password}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="note-text">현재 비밀번호는 MVP 테스트용입니다. 실제 배포 전 보안 인증으로 교체해야 합니다.</p>
      </section>
    </main>
  );
}
