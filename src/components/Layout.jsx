import { Link, useNavigate } from 'react-router-dom';
import { request } from '../lib/api.js';
import { useMember, forgetMember } from '../lib/useMember.js';

/** 헤더는 전 화면 공용이다. 로그인 여부는 실제 세션(GET /me)으로만 판단한다. */
export function Header() {
  const member = useMember();
  const navigate = useNavigate();

  async function logout() {
    try { await request('/api/v1/auth/logout', { method: 'POST', member: true, body: {} }); }
    catch { /* 이미 만료됐어도 화면은 로그아웃 상태로 보낸다 */ }
    forgetMember();
    navigate('/', { replace: true });
    location.reload();
  }

  return (
    /* 시안: 화면 끝까지 흰 띠. 회색 바탕 화면에서는 그림자로 띄운다. */
    <header className="relative z-10 flex w-full items-center justify-between bg-white px-6 py-4 shadow-[0_1px_10px_rgba(20,20,43,.06)]">
      <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold">
        <span className="grid size-7 place-items-center rounded-lg bg-brand text-[15px] font-extrabold text-white">B</span>
        YogoB
      </Link>
      <nav className="flex items-center gap-4">
        {member && <Link to="/mypage" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-ink-soft">마이페이지</Link>}
        {member && <button type="button" onClick={logout} className="btn btn-ghost">로그아웃</button>}
        {member === null && <Link to="/login" className="btn btn-brand">로그인</Link>}
      </nav>
    </header>
  );
}

export function Footer({ compact = false }) {
  return (
    <footer className={compact ? 'border-t border-ink/10 py-3' : 'mt-10 border-t border-line py-7'}>
      <div className={`flex flex-wrap justify-between ${compact ? 'flex-col items-center gap-2 sm:flex-row sm:gap-3' : 'gap-6'}`}>
        <div>
          <strong className={compact ? 'text-xs font-bold text-ink/70' : 'font-bold'}>요고비</strong>
          {!compact && <p className="mt-1.5 max-w-[34em] text-[13px] text-muted">
            통신비·구독료 최적화 서비스 · 정보 제공 목적으로만 운영됩니다.
          </p>}
        </div>
        <div className={`flex flex-wrap items-center ${compact ? 'justify-center gap-x-3 gap-y-1 text-[11px] text-ink/70 sm:text-xs' : 'gap-[18px] text-[13px] text-muted'}`}>
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/data-sources">데이터 출처</Link>
        </div>
      </div>
      {/* 운영자용. 누구나 열 수 있는 정적 페이지지만 데이터는 전부 인증이 필요하다(backoffice.md §2). */}
      {!compact && <div className="mt-[18px]">
        <Link to="/admin" rel="nofollow" className="text-xs text-muted hover:text-ink-soft hover:underline">
          관리자 로그인
        </Link>
      </div>}
    </footer>
  );
}
