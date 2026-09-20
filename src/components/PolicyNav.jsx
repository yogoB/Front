import { NavLink } from 'react-router-dom';

const DOCS = [
  ['/terms', '이용약관'],
  ['/privacy', '개인정보처리방침'],
  ['/data-sources', '데이터 출처'],
];

/** 정책 문서 3종 사이 이동. 현재 문서는 aria-current 로도 알린다. */
export default function PolicyNav() {
  return (
    <nav className="mb-7 flex flex-wrap gap-2" aria-label="정책 문서">
      {DOCS.map(([to, label]) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => `rounded-full px-3.5 py-2 text-sm font-semibold ${
            isActive ? 'bg-ink text-white' : 'bg-bg-soft text-ink-soft hover:bg-[#eceef2]'}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
