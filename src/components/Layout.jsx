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
      {/* 로고 이미지(사용자 제공 2026-09-21). 글자가 그림 안에 있으므로 alt 로 읽어 준다.
          width/height 를 적어 두면 이미지가 늦게 와도 헤더 높이가 흔들리지 않는다.
          그림 안쪽에 투명 여백이 꽤 있어(글자가 세로 55% 정도만 차지한다) 40px 로 키워야
          예전 마크와 비슷하게 읽힌다 — 32px 로 두면 글자가 17px 밖에 안 된다. */}
      <Link to="/" className="inline-flex items-center" aria-label="요고비 홈">
        <img src="/logo.png" alt="YogoB" width={756} height={328} className="h-10 w-auto" />
      </Link>
      <nav className="flex items-center gap-4">
        {member && <Link to="/mypage" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-ink-soft">마이페이지</Link>}
        {member && <button type="button" onClick={logout} className="btn btn-ghost">로그아웃</button>}
        {member === null && <Link to="/login" className="btn btn-primary">로그인</Link>}
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
          {/* 운영자용. 누구나 열 수 있는 정적 페이지지만 데이터는 전부 인증이 필요하다(backoffice.md §2).
              전에는 압축 푸터(랜딩)에서 숨겼는데, 랜딩이 운영자가 들어오는 자리라 입구가 사라져 있었다
              (사용자 제보 2026-09-21). 링크 줄 안에 두면 줄이 늘지 않아 랜딩 높이도 그대로다. */}
          <Link to="/admin" rel="nofollow" className="hover:underline">관리자 로그인</Link>
        </div>
      </div>
    </footer>
  );
}
