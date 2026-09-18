import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../lib/api.js';

/* 백오피스(D-32 → D-52 고도화). 숫자는 전부 서버가 만든다 — 여기서 합계·비율을 계산하지 않는다.
   회원 화면과 같은 쿠키 세션 + CSRF 헤더를 쓴다(request 의 member:true).
   화면은 레퍼런스(다크 대시보드 "Nexus")를 따른다: 좌측 고정 사이드바, KPI 4장, 면적/막대/도넛 차트, 최근 활동.
   차트는 SVG 를 직접 그린다 — 라이브러리 없이 값과 좌표만 옮긴다. */
const call = (path, opts = {}) => request(path, { member: true, ...opts }).then(r => r.data);

/** -1 은 "알 수 없음"이다(표가 없거나 조회 실패). 0 으로 적으면 거짓말이 된다. */
const show = value => (typeof value === 'number' && value >= 0 ? value.toLocaleString('ko-KR') : '—');
const pick = (data, path) => path.split('.').reduce((value, key) => (value ?? {})[key], data);
/** 서버가 준 시각을 그대로 보여준다. 파싱에 실패하면 원문을 남긴다 — 기록은 지어내지 않는다. */
const when = (iso, style = 'short') => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? String(iso ?? '') : at.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: style });
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/* ---------- 아이콘(feather 계열 선 아이콘, 24 격자) ---------- */
const ICON = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  quality: 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4zM9 12l2 2 4-4',
  gaps: 'M2 12h6l2 3h4l2-3h6M5 4h14l3 8v8H2v-8z',
  stats: 'M4 20V10M10 20V4M16 20v-6M22 20H2',
  audit: 'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  catalog: 'M12 3c-4.4 0-8 1.3-8 3v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3zM4 6c0 1.7 3.6 3 8 3s8-1.3 8-3M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  jobs: 'M5 3l14 9-14 9V3z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  refresh: 'M21 12a9 9 0 1 1-3-6.7M21 3v6h-6',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  up: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  home: 'M3 10l9-7 9 7v11h-6v-7H9v7H3z',
};
const Icon = ({ name, size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={ICON[name]} /></svg>
);

/* ---------- 공용 조각 ---------- */
const TONE = {
  ok: 'bg-adm-mint/15 text-adm-mint border-adm-mint/30', warn: 'bg-adm-amber/15 text-adm-amber border-adm-amber/30',
  bad: 'bg-adm-red/15 text-adm-red border-adm-red/30', info: 'bg-adm-cyan/15 text-adm-cyan border-adm-cyan/30',
  dim: 'bg-adm-raise text-adm-muted border-adm-line',
};
const TAG_TONE = {
  VERIFIED: 'ok', APPLIED: 'ok', RESOLVED: 'ok', MISMATCH: 'bad', FAILED: 'bad', DELETE: 'bad', REJECTED: 'dim',
  UNVERIFIED: 'warn', UPDATE: 'warn', PENDING: 'warn', IN_PROGRESS: 'warn', REQUESTED: 'info', CREATE: 'info', SYSTEM: 'info', SKIPPED: 'dim',
};
const Tag = ({ value, tone }) => (
  <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${TONE[tone ?? TAG_TONE[value] ?? 'dim']}`}>
    {value || '—'}
  </span>
);
const Card = ({ title, sub, action, children, className = '' }) => (
  <section className={`animate-fade-in rounded-2xl border border-adm-line bg-adm-card p-5 ${className}`}>
    {(title || action) && (
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          {title && <h2 className="text-[15px] font-extrabold tracking-[-.01em]">{title}</h2>}
          {sub && <p className="mt-0.5 text-xs text-adm-muted">{sub}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);
const Table = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="mt-2 w-full border-collapse text-sm">
      <thead><tr>{head.map((h, i) => <th key={i} scope="col" className="border-b px-2.5 py-2 text-left text-xs font-semibold">{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);
const Td = ({ children, className = '' }) => <td className={`border-b px-2.5 py-2.5 align-top whitespace-pre-line ${className}`}>{children}</td>;
const Empty = ({ cols, text }) => <tr><Td /><Td className="text-adm-muted">{text}</Td>{Array.from({ length: cols - 2 }, (_, i) => <Td key={i} />)}</tr>;
const Label = ({ htmlFor, children }) => <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-adm-muted">{children}</label>;
const small = 'btn px-3.5 py-1.5 text-[13px]';
const danger = `${small} border-adm-red/40 bg-transparent text-adm-red hover:bg-adm-red/10`;

/* ---------- 차트(SVG 직접) ---------- */
/** 면적 차트. rows 는 날짜 오름차순, series 는 [{key,label,color}]. dimUntil 이전 날짜는 회색 띠로 표시한다. */
function AreaChart({ rows, series, dimUntil, note }) {
  const W = 640, H = 220, L = 36, R = 12, T = 16, B = 28;
  if (!rows.length) return <p className="text-sm text-adm-muted">집계가 없어요.</p>;
  const max = Math.max(1, ...rows.flatMap(r => series.map(s => Number(r[s.key]) || 0)));
  const x = i => L + (rows.length > 1 ? (i * (W - L - R)) / (rows.length - 1) : 0);
  const y = v => H - B - (v / max) * (H - T - B);
  const line = s => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(Number(r[s.key]) || 0).toFixed(1)}`).join(' ');
  const dimCount = dimUntil ? rows.filter(r => r.date <= dimUntil).length : 0;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map(s => s.label).join(', ')}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity=".35" /><stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#1f2a44" strokeDasharray="3 4" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="#8a97b3">{f === 0 ? 0 : f === 1 ? max : ''}</text>
          </g>
        ))}
        {dimCount > 0 && (
          <rect x={x(0)} y={T} width={Math.max(0, x(dimCount - 1) - x(0))} height={H - T - B} fill="#8a97b3" fillOpacity=".12" />
        )}
        {series.map(s => (
          <g key={s.key}>
            <path d={`${line(s)} L${x(rows.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`} fill={`url(#g-${s.key})`} />
            <path d={line(s)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(Number(r[s.key]) || 0)} r="2.5" fill={s.color} />)}
          </g>
        ))}
        {rows.map((r, i) => (i % 2 === rows.length % 2 || rows.length < 8) && (
          <text key={r.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8a97b3">{r.date.slice(5).replace('-', '/')}</text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-adm-muted">
        {series.map(s => <span key={s.key} className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
        {dimCount > 0 && <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-adm-muted/40" />{note}</span>}
      </div>
    </div>
  );
}

/** 막대 차트. items 는 [{label, value}]. 값은 막대 위에 그대로 적는다. */
function BarChart({ items, color = '#22d3ee', empty = '집계가 없어요.' }) {
  const W = 640, H = 200, L = 8, R = 8, T = 22, B = 26;
  if (!items.length) return <p className="text-sm text-adm-muted">{empty}</p>;
  const max = Math.max(1, ...items.map(i => Number(i.value) || 0));
  const slot = (W - L - R) / items.length, bw = Math.min(40, slot * 0.6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={items.map(i => `${i.label} ${i.value}`).join(', ')}>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#1f2a44" />
      {items.map((it, i) => {
        const v = Number(it.value) || 0, h = (v / max) * (H - T - B), cx = L + slot * i + slot / 2;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={H - B - h} width={bw} height={h} rx="5" fill={color} fillOpacity=".85" />
            <text x={cx} y={H - B - h - 6} textAnchor="middle" fontSize="10" fill="#e6edf7">{show(v)}</text>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#8a97b3">{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 도넛. parts 는 [{label, value, color}]. 합이 0 이면 "없음" 한 줄 — 비율은 화면이 만들지 않고 값만 적는다. */
function Donut({ parts, zero = '없음' }) {
  const total = parts.reduce((s, p) => s + (Number(p.value) || 0), 0);
  if (!total) return <p className="text-sm text-adm-mint">{zero}</p>;
  const C = 2 * Math.PI * 40;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-36" role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(', ')}>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#1f2a44" strokeWidth="14" />
        {parts.map(p => {
          const v = Number(p.value) || 0, len = (v / total) * C, off = acc; acc += len;
          return v > 0 && (
            <circle key={p.label} cx="50" cy="50" r="40" fill="none" stroke={p.color} strokeWidth="14"
                    strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 50 50)" />
          );
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="16" fontWeight="800" fill="#e6edf7">{show(total)}</text>
      </svg>
      <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
        {parts.map(p => (
          <li key={p.label} className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: p.color }} />{p.label}<b className="ml-auto pl-4 tnum">{show(Number(p.value) || 0)}</b></li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 라우팅(페이지) ---------- */
const PAGES = [
  ['dashboard', '대시보드'], ['quality', '데이터 품질'], ['gaps', '결손 · 제보'], ['stats', '통계'], ['audit', '감사 로그'],
  ['catalog', '카탈로그 검수'], ['jobs', '정기 작업'],
];
const ACTION = {
  CATALOG_UPDATE: '카탈로그 수정', CATALOG_CREATE: '카탈로그 추가', CATALOG_DELETE: '카탈로그 삭제',
  REPORT_RESOLVED: '제보 처리', REPORT_REJECTED: '제보 반려', REPORT_PENDING: '제보 대기로',
  GAP_REQUESTED: '결손 요청', GAP_IN_PROGRESS: '결손 진행', GAP_PENDING: '결손 보류', GAP_VERIFIED: '결손 확인', GAP_REJECTED: '결손 반려',
  JOB_HARVEST: '수집 실행', JOB_PURGE: '파기 실행', JOB_SWEEP: '시세 수집', JOB_FX: '환율 갱신',
};

export default function Admin() {
  const [session, setSession] = useState(undefined);   // 확인 중 / null / 관리자
  const [message, setMessage] = useState('');
  const [page, setPage] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [audit, setAudit] = useState([]);

  useEffect(() => { document.title = '요고비 · 백오피스'; }, []);

  const say = setMessage;
  const fail = e => say(e.message);
  const loadDashboard = useCallback(() => call('/api/v1/admin/dashboard').then(setDashboard), []);
  const loadAudit = useCallback(() => call('/api/v1/admin/audit?limit=100').then(setAudit), []);
  const refresh = useCallback(() => Promise.all([loadDashboard(), loadAudit()]).catch(fail), [loadDashboard, loadAudit]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 로그인 여부로 화면을 가른다. 관리자가 아니면 지표·검수는 아예 보이지 않는다. */
  const showSession = useCallback(async () => {
    try {
      setSession(await call('/api/v1/admin/session'));
      await Promise.all([loadDashboard(), loadAudit()]);
    } catch { setSession(null); }
  }, [loadDashboard, loadAudit]);
  useEffect(() => { showSession(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    say('');
    try {
      await call('/api/v1/admin/login', { method: 'POST', body: { id: form.id.value, password: form.password.value } });
      form.password.value = '';
      await showSession();
    } catch (e) { fail(e); }
  }
  async function logout() {
    try { await call('/api/v1/auth/logout', { method: 'POST', body: {} }); } catch { /* 이미 만료됐을 수 있다 */ }
    await showSession();
  }

  if (session === undefined) return <div className="adm grid min-h-screen place-items-center bg-adm-bg text-adm-muted">확인하는 중…</div>;
  if (session === null) {
    return (
      <div className="adm grid min-h-screen place-items-center bg-adm-bg px-6 text-adm-text">
        <form onSubmit={login} className="w-full max-w-[380px] animate-fade-in rounded-2xl border border-adm-line bg-adm-card p-7">
          <Brand />
          <h1 className="mt-6 text-xl font-extrabold">운영자 로그인</h1>
          <p role="status" aria-live="polite" className="mt-1 min-h-[1.5em] text-sm text-adm-red">{message}</p>
          <Label htmlFor="admin-id">아이디</Label>
          <input id="admin-id" name="id" autoComplete="username" required className="field mb-3.5" />
          <Label htmlFor="admin-password">비밀번호</Label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="field" />
          <button type="submit" className="btn btn-brand btn-block mt-5">로그인</button>
          <Link to="/" className="mt-4 block text-center text-xs text-adm-muted hover:text-adm-text">요고비 홈으로</Link>
        </form>
      </div>
    );
  }

  const pending = pick(dashboard, 'reports.pending');
  const title = PAGES.find(([k]) => k === page)?.[1];
  return (
    <div className="adm min-h-screen bg-adm-bg text-adm-text lg:grid lg:grid-cols-[236px_1fr]">
      {/* 좌측 고정 사이드바 */}
      <aside className="flex flex-col border-b border-adm-line bg-adm-card p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <Brand />
        <nav className="mt-6 grid gap-1">
          {PAGES.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setPage(key)} aria-current={page === key ? 'page' : undefined}
                    className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border-0 px-3 text-left text-sm font-semibold transition-colors
                      ${page === key ? 'bg-adm-raise text-adm-text' : 'bg-transparent text-adm-muted hover:bg-adm-raise/60 hover:text-adm-text'}`}>
              <Icon name={key} className={page === key ? 'text-adm-mint' : ''} />{label}
              {key === 'gaps' && typeof pending === 'number' && pending > 0 && (
                <span className="ml-auto rounded-full bg-adm-amber/20 px-2 py-0.5 text-[11px] font-bold text-adm-amber tnum">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-1 pt-6">
          <Link to="/" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-adm-muted hover:bg-adm-raise/60 hover:text-adm-text"><Icon name="home" />요고비 홈</Link>
          <button type="button" onClick={logout} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-sm font-semibold text-adm-muted hover:bg-adm-raise/60 hover:text-adm-text"><Icon name="logout" />로그아웃</button>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-adm-line bg-adm-bg/60 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-adm-mint/20 text-sm font-extrabold uppercase text-adm-mint">{String(session.loginId ?? '?').slice(0, 1)}</span>
            <div className="min-w-0">
              <b className="block truncate text-sm">{session.loginId}</b>
              <span className="block truncate text-xs text-adm-muted">회원번호 {session.userId}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-.02em]">{page === 'dashboard' ? `안녕하세요, ${session.loginId}` : title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-adm-muted"><Icon name="calendar" size={15} />{new Date().toLocaleDateString('ko-KR', { dateStyle: 'full' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage('gaps')} aria-label={`제보 대기 ${show(pending)}건`}
                    className="relative grid size-10 cursor-pointer place-items-center rounded-xl border border-adm-line bg-adm-card text-adm-muted hover:text-adm-text">
              <Icon name="bell" />
              {typeof pending === 'number' && pending > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-adm-amber px-1.5 text-[10px] font-extrabold text-adm-bg tnum">{pending}</span>}
            </button>
            <button type="button" onClick={refresh} className="btn btn-ghost min-h-10 gap-2"><Icon name="refresh" size={16} />새로고침</button>
          </div>
        </header>
        <p role="status" aria-live="polite" className="my-3 min-h-[1.5em] whitespace-pre-wrap text-sm font-semibold text-adm-cyan">{message}</p>

        {page === 'dashboard' && <DashboardPage data={dashboard} audit={audit} />}
        {page === 'quality' && <QualityPage quality={dashboard?.quality} />}
        {page === 'gaps' && <><GapsBoard say={say} onChanged={refresh} /><ReportsBoard say={say} onChanged={refresh} /></>}
        {page === 'stats' && <StatsPage data={dashboard} />}
        {page === 'audit' && <AuditPage rows={audit} />}
        {page === 'catalog' && <CatalogPage say={say} onChanged={refresh} />}
        {page === 'jobs' && <JobsPage say={say} onChanged={refresh} />}
      </main>
    </div>
  );
}

const Brand = () => (
  <Link to="/admin" className="inline-flex items-center gap-2.5 text-[15px] font-extrabold text-adm-text">
    <span className="grid size-8 place-items-center rounded-lg bg-adm-mint text-sm text-adm-bg">B</span>
    YogoB <span className="font-semibold text-adm-muted">백오피스</span>
  </Link>
);

/* ---------- 대시보드 ---------- */
function DashboardPage({ data, audit }) {
  if (!data) return <p className="text-sm text-adm-muted">지표를 읽는 중…</p>;
  const health = data.health ?? {};
  const failures = pick(data, 'health.narrationFailures');
  // Tailwind 는 문자열을 그대로 훑으므로 클래스는 조립하지 않고 통째로 둔다.
  const BADGE = { mint: 'bg-adm-mint/15 text-adm-mint', cyan: 'bg-adm-cyan/15 text-adm-cyan', red: 'bg-adm-red/15 text-adm-red', violet: 'bg-adm-violet/15 text-adm-violet' };
  const kpis = [
    { label: '전체 회원', value: pick(data, 'members.total'), icon: 'users', color: 'mint',
      delta: typeof pick(data, 'members.signedUp7d') === 'number' ? `최근 7일 +${show(pick(data, 'members.signedUp7d'))}` : '', up: true },
    { label: '오늘 리포트 본 사람', value: health.reportViewersToday, icon: 'eye', color: 'cyan', delta: '사람 수 · 오늘' },
    { label: '설명 실패(켜진 뒤)', value: failures, icon: 'alert', color: failures ? 'red' : 'mint',
      delta: failures === 0 ? '실패 없음' : failures > 0 ? '내레이터 확인 필요' : '', up: failures === 0 },
    { label: '결손 대기', value: data.gaps, icon: 'gaps', color: 'violet', delta: '요청됐지만 카탈로그에 없는 것' },
  ];
  const unique = [...(pick(data, 'funnel.uniqueDaily') ?? [])].reverse();   // 서버는 최신순 — 차트는 시간순
  const kinds = Object.entries(health.narrationFailuresByKind ?? {});
  const palette = ['#f87171', '#fbbf24', '#a78bfa', '#22d3ee', '#3ed4af'];
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="animate-fade-in rounded-2xl border border-adm-line bg-adm-card p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-semibold text-adm-muted">{k.label}</span>
              <span className={`grid size-9 place-items-center rounded-xl ${BADGE[k.color]}`}><Icon name={k.icon} /></span>
            </div>
            <b className="mt-2 block text-[30px] font-extrabold leading-tight tracking-[-.02em] tnum">{show(k.value)}</b>
            {k.delta && (
              <span className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold ${k.up ? 'text-adm-mint' : 'text-adm-muted'}`}>
                {k.up && <Icon name="up" size={13} />}{k.delta}
              </span>
            )}
          </div>
        ))}
      </div>

      <Card title="운영 상태" sub="어제 같은 사고(설명 경로 실패·결과 화면 반복 호출)는 여기서 먼저 드러난다. 켜진 뒤 누적값이며 재시작하면 0부터.">
        <dl className="m-0 grid grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
          {[
            ['추천 호출 · 오늘', health.recommendationsToday],
            ['리포트 표시 · 오늘', health.reportShownToday],
            ['본 사람 · 오늘', health.reportViewersToday],
            ['내레이터 호출', health.narrationCalls],
            ['내레이터 평균 / 최대', health.narrationAvgMs == null ? null : `${show(health.narrationAvgMs)} / ${show(health.narrationMaxMs)} ms`],
            ['마지막 정상 응답', health.narratorLastOkAt ? when(health.narratorLastOkAt, 'medium') : '—'],
          ].map(([label, value, cls = '']) => (
            <div key={label} className="rounded-xl border border-adm-line bg-adm-bg/60 p-3">
              <dt className="text-xs text-adm-muted">{label}</dt>
              <dd className={`m-0 mt-1 text-lg font-extrabold tnum ${cls}`}>{typeof value === 'number' ? show(value) : (value ?? '—')}</dd>
            </div>
          ))}
        </dl>
        {/* 판정은 적지 않는다. 호출 수를 '본 사람'(회원)과만 견주면 비회원 계산까지 반복 호출로 몰려 오탐이 난다 —
            2026-09-18 운영에서 실제로 그렇게 떴다. 숫자를 나란히 두고 사람이 읽는다. 판정이 필요하면 BE 가 값으로 준다. */}
        <p className="mt-3 text-xs text-adm-muted">
          추천 호출은 회원·비회원을 합한 횟수고, ‘본 사람’은 회원만 하루 한 번 센 수다.
          사람 수는 그대로인데 호출만 몇 배로 뛰면 결과 화면 반복 호출을 의심한다(2026-09-17 사고의 모양).
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="퍼널 · 최근 14일 (사람 수)" sub="같은 사람은 하루 단계당 한 번만 센다. 횟수가 아니라 사람 수다.">
          {pick(data, 'funnel.unavailable')
            ? <p className="text-sm text-adm-muted">퍼널 표를 읽지 못했어요.</p>
            : <AreaChart rows={unique} dimUntil={pick(data, 'funnel.contaminatedUntil')} note="결과 화면 반복 호출로 횟수가 부풀어 있던 구간(사람 수 집계 전)"
                         series={[{ key: 'gateShown', label: '게이트 본 사람', color: '#22d3ee' }, { key: 'reportShown', label: '리포트 본 사람', color: '#3ed4af' }]} />}
        </Card>
        <Card title="최근 7일 활동" sub="가입 · 제보 · 수집 제안 · 카탈로그 반영">
          <BarChart color="#22d3ee" items={(data.weeklyActivity ?? []).map(d => ({ label: `${d.date.slice(5).replace('-', '/')} ${weekday(d.date)}`, value: (Number(d.signups) || 0) }))} empty="활동 기록을 읽지 못했어요." />
          <p className="mt-1 text-xs text-adm-muted">막대는 가입 수. 아래 표가 나머지 활동이다.</p>
          <Activity days={data.weeklyActivity ?? []} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="설명 실패 종류" sub="내레이터가 못 준 이유별(켜진 뒤 누적)">
          <Donut zero="실패 없음" parts={kinds.map(([k, v], i) => ({ label: k, value: v, color: palette[i % palette.length] }))} />
        </Card>
        <Card title="최근 활동" sub="운영자 행위와 카탈로그 변경을 한 줄로 — 감사 로그 페이지에 전체가 있다.">
          <ol className="m-0 grid max-h-[320px] list-none gap-2.5 overflow-y-auto p-0 pr-1">
            {audit.slice(0, 20).map((e, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-adm-cyan" />
                <div className="min-w-0">
                  <b>{ACTION[e.action] ?? e.action}</b>{e.target && <span className="text-adm-muted"> · {e.target}</span>}
                  <span className="block text-xs text-adm-muted">{when(e.at)}{e.actor && ` · ${e.actor}`}{e.detail && ` · ${e.detail}`}</span>
                </div>
              </li>
            ))}
            {!audit.length && <li className="text-sm text-adm-muted">아직 기록이 없어요.</li>}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['카탈로그', [['catalog.mobilePlans', '요금제'], ['catalog.subscriptionServices', '구독 서비스'], ['catalog.subscriptionTiers', '구독 등급'], ['catalog.planBenefits', '제휴 혜택']]],
          ['검수', [['review.pendingRequests', '검수 대기'], ['review.mismatched', '불일치(차단)'], ['review.unverified', '미확인'], ['review.appliedToday', '24시간 반영']]],
          ['회원 · 제보', [['members.signedUp24h', '24시간 가입'], ['members.activeSessions', '활성 세션'], ['members.withSubscription', '구독 등록 회원'], ['reports.pending', '제보 대기'], ['reports.total', '제보 전체']]],
        ].map(([title, rows]) => (
          <Card key={title} title={title}>
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
              {rows.map(([path, label]) => (
                <div key={path} className="contents"><dt className="text-adm-muted">{label}</dt><dd className="m-0 font-bold tnum">{show(pick(data, path))}</dd></div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* 최근 7일 활동 표. 숫자를 항상 적고 막대는 셀 바닥의 가는 선으로만 둔다. */
const ACTIVITY_ROWS = [['signups', '가입'], ['reports', '정보 오류 제보'], ['proposals', '수집 제안'], ['applied', '카탈로그 반영']];
function Activity({ days }) {
  if (!days.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full min-w-[480px] text-[12px]">
        <thead><tr><th className="px-2 py-1 text-left" />{days.map(d => <th key={d.date} scope="col" className="px-2 py-1 text-right text-adm-muted">{d.date.slice(5).replace('-', '/')}</th>)}</tr></thead>
        <tbody>
          {ACTIVITY_ROWS.map(([key, label]) => {
            const counts = days.map(d => Number(d[key]) || 0), max = Math.max(...counts);
            return (
              <tr key={key}>
                <td className="whitespace-nowrap px-2 py-1 text-adm-muted">{label}</td>
                {counts.map((n, i) => (
                  <td key={i} className={`px-2 py-1 text-right tnum ${n ? '' : 'text-adm-line'}`}>
                    <span className="relative block pb-[4px]">{n.toLocaleString('ko-KR')}
                      {n > 0 && <i className="absolute inset-x-0 bottom-0 block h-[2px] origin-right rounded-sm bg-adm-cyan" style={{ transform: `scaleX(${(n / max).toFixed(3)})` }} />}
                    </span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- 데이터 품질(D-52 ②) ---------- */
const QUALITY = [
  ['carrierNameVariants', '통신사 표기 중복', '같은 통신사가 띄어쓰기·대소문자만 다르게 두 번 있다'],
  ['duplicateTierNames', '등급명 중복', '한 서비스 안에 같은 이름의 등급이 둘 이상'],
  ['samePriceTiers', '같은 가격 등급', '한 서비스 안에 가격이 같은 등급 — 이름만 다른 중복일 수 있다'],
  ['placeholderPlans', '출처 없는 더미 요금제', '가격 0 이거나 출처가 진짜 URL 이 아닌 행'],
  ['plansWithoutSource', '출처 미기재 요금제', '출처 칸이 빈 활성 요금제'],
  ['mnoNetworkGaps', 'MNO 망 결손', '통신 3사인데 5G 나 LTE 요금제가 하나도 없다'],
];
function QualityPage({ quality }) {
  if (!quality) return <p className="text-sm text-adm-muted">품질 검사 결과를 읽는 중…</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {QUALITY.map(([key, title, desc]) => {
        const q = quality[key] ?? { count: -1, sample: [] };
        const tone = q.count === 0 ? 'ok' : q.count > 0 ? 'warn' : 'dim';
        return (
          <Card key={key} title={title} sub={desc} action={<Tag tone={tone} value={q.count === 0 ? '이상 없음' : q.count > 0 ? `${show(q.count)}건` : '검사 실패'} />}>
            {q.sample?.length > 0 && (
              <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
                {q.sample.map((s, i) => <li key={i} className="rounded-lg bg-adm-bg/60 px-3 py-2 font-mono text-xs">{s}</li>)}
                {q.count > q.sample.length && <li className="text-xs text-adm-muted">… 외 {show(q.count - q.sample.length)}건</li>}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- 결손 게시판(D-52) ---------- */
const GAP_STATUS = [['REQUESTED', '요청됨'], ['IN_PROGRESS', '진행 중'], ['PENDING', '보류'], ['VERIFIED', '확인됨'], ['REJECTED', '반려']];
// BE CatalogCandidateRecorder.Kind 와 같은 값이어야 한다 — 모르는 값은 원문 그대로 적는다(지어내지 않는다).
const GAP_KIND = { MOBILE_PLAN: '요금제', SUBSCRIPTION_TIER: '구독 등급', SUBSCRIPTION_SERVICE: '구독 서비스', CARRIER: '통신사' };
function GapsBoard({ say, onChanged }) {
  const [status, setStatus] = useState('');   // '' = 할 일(REQUESTED·IN_PROGRESS)
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);     // 편집 중인 id

  const load = useCallback(() => {
    const query = new URLSearchParams({ limit: '100' });
    if (status) query.set('status', status);
    return call(`/api/v1/admin/gaps?${query}`).then(list => { setRows(list); setError(''); }).catch(e => setError(e.message));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  async function save(event, row) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await call(`/api/v1/admin/gaps/${row.id}`, { method: 'PATCH', body: { status: form.status.value, note: form.note.value } });
      say(`결손 #${row.id} 을(를) ${GAP_STATUS.find(([v]) => v === form.status.value)?.[1] ?? form.status.value}(으)로 표시했어요.`);
      setOpen(null);
      await Promise.all([load(), onChanged()]);
    } catch (e) { say(e.message); }
  }

  return (
    <Card title="카탈로그 결손" sub="사용자가 찾았지만 카탈로그에 없던 것. 요청이 많은 순이라 수집 우선순위 그대로다. 행을 누르면 상태와 메모를 바꾼다."
          action={
            <select aria-label="상태" value={status} onChange={e => setStatus(e.target.value)} className="field min-h-9 w-auto py-1.5 text-sm">
              <option value="">할 일(요청됨 · 진행 중)</option>{GAP_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          }>
      {error && <p className="text-sm text-adm-red">{error}</p>}
      <Table head={['요청', '종류', '검색어', '상태', '마지막 요청', '메모']}>
        {rows === null ? <Empty cols={6} text="불러오는 중…" />
          : rows.length ? rows.map(row => (
            <FragmentRow key={row.id} row={row} open={open === row.id} onToggle={() => setOpen(open === row.id ? null : row.id)} onSave={save} />
          )) : <Empty cols={6} text="해당하는 결손이 없어요." />}
      </Table>
    </Card>
  );
}
function FragmentRow({ row, open, onToggle, onSave }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-adm-raise/50">
        <Td className="font-extrabold tnum">{show(row.requestedCount)}</Td>
        <Td className="whitespace-nowrap">{GAP_KIND[row.kind] ?? row.kind}</Td>
        <Td className="font-semibold">{row.queryText}</Td>
        <Td><Tag value={row.status} /></Td>
        <Td className="whitespace-nowrap text-xs text-adm-muted tnum">{when(row.lastRequestedAt)}</Td>
        <Td className="max-w-[32ch] text-xs text-adm-muted">{row.note ?? ''}</Td>
      </tr>
      {open && (
        <tr><td colSpan={6} className="border-b bg-adm-bg/50 px-3 py-3">
          <form onSubmit={e => onSave(e, row)} className="flex flex-wrap items-end gap-3">
            <div><Label htmlFor={`gap-status-${row.id}`}>상태</Label>
              <select id={`gap-status-${row.id}`} name="status" defaultValue={row.status} className="field min-h-10 w-auto">{GAP_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="min-w-[260px] flex-1"><Label htmlFor={`gap-note-${row.id}`}>메모</Label>
              <input id={`gap-note-${row.id}`} name="note" defaultValue={row.note ?? ''} maxLength={1000} className="field min-h-10" placeholder="어디까지 봤는지, 왜 보류인지" /></div>
            <button type="submit" className="btn btn-brand min-h-10">저장</button>
          </form>
        </td></tr>
      )}
    </>
  );
}

/* ---------- 제보 게시판(D-41·D-42 후속) ---------- */
const REPORT_STATUS = [['PENDING', '처리 대기'], ['RESOLVED', '처리완료'], ['REJECTED', '반려'], ['', '전체']];
const REPORT_DETAIL = { PRICE: '요금·가격', DATA: '데이터·통화', BENEFIT: '포함 혜택', AVAILABILITY: '가입 가능 여부', OTHER: '기타', SYSTEM: '화면·기능 오류' };
const TARGET_TYPE = { MOBILE_PLAN: '요금제', SUBSCRIPTION_SERVICE: '구독 서비스', SUBSCRIPTION_TIER: '구독 등급', BUNDLE_PRODUCT: '묶음 상품' };
function ReportsBoard({ onChanged, say }) {
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});   // 행별 처리 메모 입력값

  const load = useCallback(() => {
    const query = new URLSearchParams({ limit: '100' });
    if (status) query.set('status', status);
    return call(`/api/v1/admin/reports?${query}`).then(list => { setRows(list); setError(''); }).catch(e => setError(e.message));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  async function mark(row, next) {
    const key = `${row.kind}-${row.id}`;
    try {
      await call(`/api/v1/admin/reports/${row.kind}/${row.id}`, { method: 'PATCH', body: { status: next, note: notes[key] ?? row.note ?? '' } });
      say(`제보를 ${REPORT_STATUS.find(([v]) => v === next)[1]}로 표시했어요. 카탈로그는 바뀌지 않아요.`);
      await Promise.all([load(), onChanged()]);
    } catch (e) { say(e.message); }
  }

  return (
    <Card className="mt-4" title="제보 게시판" sub="처리완료는 운영자가 봤다는 표시일 뿐이고 카탈로그는 바뀌지 않는다. 가격은 카탈로그 검수 경로로. 제보자 신원은 서버가 내보내지 않는다."
          action={
            <select aria-label="상태" value={status} onChange={e => setStatus(e.target.value)} className="field min-h-9 w-auto py-1.5 text-sm">
              {REPORT_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          }>
      {error && <p className="text-sm text-adm-red">{error}</p>}
      <Table head={['시각', '종류', '대상 · 화면', '내용', '상태', '처리 메모', '']}>
        {rows === null ? <Empty cols={7} text="불러오는 중…" />
          : rows.length ? rows.map(row => {
            const key = `${row.kind}-${row.id}`;
            return (
              <tr key={key}>
                <Td className="whitespace-nowrap text-xs text-adm-muted tnum">{when(row.createdAt)}</Td>
                <Td className="whitespace-nowrap"><Tag value={row.detail} tone={row.detail === 'SYSTEM' ? 'info' : 'warn'} /><div className="mt-1 text-xs text-adm-muted">{REPORT_DETAIL[row.detail] ?? row.detail}</div></Td>
                <Td>
                  {row.kind === 'CATALOG'
                    ? <>{row.target ?? <span className="text-adm-muted">(삭제된 상품)</span>}<div className="text-xs text-adm-muted">{TARGET_TYPE[row.targetType] ?? row.targetType}{row.targetId != null && ` #${row.targetId}`}</div></>
                    : <>{row.pageUrl ?? '—'}<div className="text-xs text-adm-muted">화면 경로</div></>}
                </Td>
                <Td>
                  {/* 사용자 입력 그대로다. React 가 텍스트로만 그리므로 HTML 이 실행되지 않는다. */}
                  <div className="max-w-[44ch] whitespace-pre-wrap break-words">{row.description}</div>
                  {row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block max-w-[44ch] truncate text-xs text-adm-cyan underline">{row.sourceUrl}</a>}
                </Td>
                <Td className="whitespace-nowrap"><Tag value={row.status} />{row.updatedAt && <div className="mt-1 text-[11px] text-adm-muted tnum">{when(row.updatedAt)}</div>}</Td>
                <Td>
                  <input aria-label="처리 메모" value={notes[key] ?? row.note ?? ''} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))}
                         maxLength={1000} placeholder="처리 메모" className="field min-h-9 min-w-[160px] py-1.5 text-xs" />
                </Td>
                <Td className="whitespace-nowrap">
                  {row.status !== 'RESOLVED' && <button type="button" onClick={() => mark(row, 'RESOLVED')} className={`btn btn-brand mr-1.5 ${small}`}>처리완료</button>}
                  {row.status !== 'REJECTED' && <button type="button" onClick={() => mark(row, 'REJECTED')} className={danger}>반려</button>}
                </Td>
              </tr>
            );
          }) : <Empty cols={7} text="해당하는 제보가 없어요." />}
      </Table>
    </Card>
  );
}

/* ---------- 통계(D-52 ⑦) ---------- */
function StatsPage({ data }) {
  if (!data) return <p className="text-sm text-adm-muted">통계를 읽는 중…</p>;
  const stats = data.stats ?? {};
  const Ranked = ({ rows, empty }) => {
    const max = Math.max(1, ...rows.map(r => Number(r.count) || 0));
    return rows.length ? (
      <ol className="m-0 grid list-none gap-2 p-0 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2">
            <span className="text-xs text-adm-muted tnum">{i + 1}</span>
            <span className="relative block overflow-hidden rounded-md bg-adm-bg/60 px-2.5 py-1.5">
              <i className="absolute inset-y-0 left-0 bg-adm-cyan/20" style={{ width: `${((Number(r.count) || 0) / max) * 100}%` }} />
              <span className="relative">{r.carrier} {r.plan}</span>
            </span>
            <b className="tnum">{show(Number(r.count))}</b>
          </li>
        ))}
      </ol>
    ) : <p className="text-sm text-adm-muted">{empty}</p>;
  };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title={`1순위 추천 상위 · 최근 ${show(stats.windowDays)}일`} sub="추천 응답에서 1순위였던 요금제. 개인 단위 값은 없다.">
        <Ranked rows={stats.topRecommended ?? []} empty="아직 추천 기록이 없어요." />
      </Card>
      <Card title="데이터 사용량 분포" sub="추천 요청의 월 데이터(GB) 분포 · 최근 7일">
        <BarChart color="#a78bfa" items={(stats.dataGbHistogram ?? []).map(r => ({ label: `${r.dataGb}GB`, value: Number(r.count) }))} empty="아직 추천 기록이 없어요." />
      </Card>
      <Card title="많이 저장된 요금제" sub={`저장된 결과 전체 ${show(stats.savedTotal)}건`}>
        <Ranked rows={stats.topSaved ?? []} empty="아직 저장된 결과가 없어요." />
      </Card>
      <Card title="요청이 많은 엔드포인트" sub="서버가 켜진 뒤 누적값. 재시작하면 0부터 다시 센다.">
        <Table head={['경로', '메서드', '상태', '요청', '평균(ms)']}>
          {(data.endpoints ?? []).map((row, i) => (
            <tr key={i}><Td className="font-mono text-xs">{row.uri}</Td><Td>{row.method}</Td><Td>{row.status}</Td><Td className="tnum">{show(row.count)}</Td><Td className="tnum">{row.avgMs}</Td></tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

/* ---------- 감사 로그(D-52 ⑧) ---------- */
function AuditPage({ rows }) {
  return (
    <Card title="감사 로그" sub="운영자 행위(admin_action)와 카탈로그 변경(catalog_audit)을 시간순으로. 최근 100건.">
      <Table head={['시각', '운영자', '행위', '대상', '상세']}>
        {rows.length ? rows.map((e, i) => (
          <tr key={i}>
            <Td className="whitespace-nowrap text-xs text-adm-muted tnum">{when(e.at, 'medium')}</Td>
            <Td className="whitespace-nowrap text-xs">{e.actor ?? '—'}</Td>
            <Td className="whitespace-nowrap"><Tag tone={String(e.action).startsWith('JOB_') ? 'info' : String(e.action).includes('REJECT') ? 'dim' : 'ok'} value={ACTION[e.action] ?? e.action} /></Td>
            <Td className="font-mono text-xs">{e.target ?? ''}</Td>
            <Td className="max-w-[48ch] text-xs text-adm-muted">{e.detail ?? ''}</Td>
          </tr>
        )) : <Empty cols={5} text="아직 기록이 없어요." />}
      </Table>
    </Card>
  );
}

/* ---------- 카탈로그 검수(기존 기능 그대로) ---------- */
function CatalogPage({ say, onChanged }) {
  const [status, setStatus] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [limit, setLimit] = useState('50');
  const [audit, setAudit] = useState([]);
  const fail = e => say(e.message);
  const loadRequests = useCallback(() => call(`/api/v1/admin/catalog/requests${status ? `?status=${status}` : ''}`).then(setRequests), [status]);
  const loadAudit = useCallback(() => call(`/api/v1/admin/catalog/audit?limit=${limit}`).then(setAudit), [limit]);
  useEffect(() => { loadRequests().catch(fail); }, [loadRequests]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadAudit().catch(fail); }, [loadAudit]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(id, action) {
    const reason = action === 'reject' ? window.prompt('거절 사유를 적어주세요.') : null;
    if (action === 'reject' && reason === null) return;
    try {
      await call(`/api/v1/admin/catalog/requests/${id}/${action}`, { method: 'POST', body: action === 'reject' ? { reason } : {} });
      say(`#${id} ${action === 'approve' ? '승인했어요. 카탈로그에 반영됐습니다.' : '거절했어요.'}`);
      await Promise.all([loadRequests(), loadAudit(), onChanged()]);
    } catch (e) { fail(e); }
  }
  /* 시세 스냅샷 수집. 결과를 셋으로 나눠 읽어준다 — 키 없음 / 못 닿음 / 정상. */
  async function sweep() {
    say('스마트초이스 시세를 모으는 중이에요…');
    try {
      const r = await call('/api/v1/admin/smartchoice/sweep', { method: 'POST', body: {} });
      if (!r.enabled) say('스마트초이스 키(SMARTCHOICE_API_KEY)가 설정돼 있지 않아요. 배포 secret 을 확인해 주세요.');
      else if (!r.reachable) say(`스마트초이스 서버에 닿지 못했어요 (조건 ${r.conditions}건 시도). 등록 IP·접속 국가 제한일 수 있어요. 스냅샷 ${r.snapshotRows}행은 그대로 유지했어요.`);
      else say(`시세 수집 완료 — 조건 ${r.conditions}건에서 ${r.stored}행 갱신, 스냅샷 총 ${r.snapshotRows}행.`);
      await onChanged();
    } catch (e) { fail(e); }
  }
  async function harvest() {
    say('수집하는 중이에요…');
    try {
      const r = await call('/api/v1/admin/harvest/run', { method: 'POST', body: {} });
      say(`수집 완료 — 요금제 ${r.proposedMobilePlans}건 · 구독 ${r.proposedSubscriptionTiers}건 제안, 검수 대기 ${r.pending}건`);
      await Promise.all([loadRequests(), loadAudit(), onChanged()]);
    } catch (e) { fail(e); }
  }

  return (
    <div className="grid gap-4">
      <Card title="수집 데이터 검수" sub="매일 오전 9시(한국시간)에 모은 변경 후보. 검토는 스마트초이스 시세와 AI 조회 두 곳과 대조한 결과이고, MISMATCH 는 승인할 수 없다."
            action={
              <select aria-label="상태" value={status} onChange={e => setStatus(e.target.value)} className="field min-h-9 w-auto py-1.5 text-sm">
                <option value="PENDING">검수 대기</option><option value="APPROVED">승인됨</option><option value="REJECTED">거절됨</option><option value="FAILED">반영 실패</option><option value="">전체</option>
              </select>
            }>
        <Table head={['#', '대상', '변경', '검토', '사유', '']}>
          {requests.length ? requests.map(r => (
            <tr key={r.id} title={status === '' ? r.status : undefined}>
              <Td className="tnum">#{r.id}</Td>
              <Td>{r.dataset}{'\n'}{r.row_key ?? ''}</Td>
              <Td className="font-mono text-xs">{r.payload ?? ''}</Td>
              <Td><Tag value={r.review_status || 'SKIPPED'} /><div className="mt-1 text-xs text-adm-muted">{r.review_detail ?? ''}</div></Td>
              <Td>{r.reason ?? ''}</Td>
              <Td className="whitespace-nowrap">
                {r.status === 'PENDING' ? (
                  <>
                    {/* 서버도 막지만 화면에서도 먼저 막는다 */}
                    <button type="button" disabled={r.review_status === 'MISMATCH'} onClick={() => decide(r.id, 'approve')}
                            className={`btn btn-brand mr-1.5 ${small} disabled:cursor-not-allowed disabled:opacity-45`}>승인</button>
                    <button type="button" onClick={() => decide(r.id, 'reject')} className={danger}>거절</button>
                  </>
                ) : r.status}
              </Td>
            </tr>
          )) : <Empty cols={6} text="대기 중인 항목이 없어요." />}
        </Table>
        <p className="mt-3 text-sm text-adm-muted">시세 스냅샷이 비어 있으면 요금제 제안이 만들어지지 않는다 — 시세 수집을 먼저 돌린다. 배포 서버는 유휴 시 정지하므로 예약 시각에 잠들어 있으면 정기 실행이 건너뛰어진다.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={sweep} className="btn btn-ghost">① 시세 스냅샷 수집</button>
          <button type="button" onClick={harvest} className="btn btn-brand">② 지금 수집 실행</button>
        </div>
      </Card>

      <Card title="카탈로그 변경 이력" sub="원본이 파일이라 git 이력이 남지 않는다. 이 목록이 유일한 변경 기록이다(D-26). 되돌린 변경(FAILED)도 시도 자체가 감사 대상이라 남는다."
            action={
              <select aria-label="표시 개수" value={limit} onChange={e => setLimit(e.target.value)} className="field min-h-9 w-auto py-1.5 text-sm">
                <option value="50">최근 50건</option><option value="200">최근 200건</option><option value="500">최근 500건</option>
              </select>
            }>
        <Table head={['시각', '운영자', '동작', '대상', '결과']}>
          {audit.length ? audit.map((e, i) => <CatalogAuditRow key={i} entry={e} />) : <Empty cols={5} text="아직 변경 이력이 없어요." />}
        </Table>
      </Card>
    </div>
  );
}
function CatalogAuditRow({ entry }) {
  const diff = [['변경 전', entry.before_row], ['변경 후', entry.after_row]].filter(([, v]) => v);
  return (
    <tr>
      <Td className="whitespace-nowrap text-xs text-adm-muted tnum">{when(entry.created_at, 'medium')}</Td>
      <Td className="whitespace-nowrap text-xs">회원번호 {entry.actor_id}</Td>
      <Td className="whitespace-nowrap"><Tag value={entry.action} /></Td>
      <Td>
        {entry.dataset}{'\n'}{entry.row_key ?? ''}
        {/* 변경 전후는 CSV 한 줄이 최대 4,000자다. 기본은 접어두고 펼쳐서 본다. */}
        {diff.length > 0 && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs font-semibold">변경 전후 보기</summary>
            {diff.map(([label, value]) => (
              <p key={label} className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-adm-muted"><b className="block text-[11px] text-adm-text">{label}</b>{value}</p>
            ))}
          </details>
        )}
      </Td>
      <Td><Tag value={entry.outcome} />{entry.detail && <div className="mt-1 text-xs text-adm-muted">{entry.detail}</div>}</Td>
    </tr>
  );
}

/* ---------- 정기 작업 수동 실행(기존 기능 그대로) ---------- */
function JobsPage({ say, onChanged }) {
  const [retention, setRetention] = useState('대상 건수를 확인하는 중…');
  const fail = e => say(e.message);
  /** 파기 대상 건수. 지우기 전에 항상 이걸 먼저 보여준다 — 파기는 되돌릴 수 없다. */
  const loadRetention = useCallback(() => call('/api/v1/admin/retention/pending').then(counts => {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    setRetention(total ? `지금 파기 대상 ${total}건 — ` + Object.entries(counts).filter(([, n]) => n).map(([name, n]) => `${name} ${n}`).join(', ') : '지금 파기 대상이 없어요.');
  }).catch(e => setRetention(`대상 건수를 읽지 못했어요: ${e.message}`)), []);
  useEffect(() => { loadRetention(); }, [loadRetention]);

  async function fx() {
    say('환율을 갱신하는 중이에요…');
    try {
      const r = await call('/api/v1/admin/fx/refresh', { method: 'POST', body: {} });
      say(r.updated ? `환율 갱신 완료 — USD/KRW ${r.rate} (기준일 ${r.rateDate})` : `갱신하지 못해 이전 값을 유지했어요${r.rate ? ` — USD/KRW ${r.rate} (기준일 ${r.rateDate})` : ''}.`);
      await onChanged();
    } catch (e) { fail(e); }
  }
  /* 파기는 되돌릴 수 없다. 확인 문구를 직접 입력받고, 서버도 같은 문구를 요구한다. */
  async function purge() {
    const typed = window.prompt('보유기간이 지난 개인정보를 지금 파기합니다. 되돌릴 수 없어요.\n계속하려면 "파기"를 입력해 주세요.');
    if (typed === null) return;
    if (typed.trim() !== '파기') { say('확인 문구가 달라서 취소했어요. 아무것도 지우지 않았습니다.'); return; }
    say('파기하는 중이에요…');
    try {
      const deleted = await call('/api/v1/admin/retention/purge', { method: 'POST', body: { confirm: '파기' } });
      const total = Object.values(deleted).reduce((sum, n) => sum + n, 0);
      say(`파기 완료 — 총 ${total}건 삭제 (${Object.entries(deleted).map(([name, n]) => `${name} ${n}`).join(', ')})`);
      await Promise.all([loadRetention(), onChanged()]);
    } catch (e) { fail(e); }
  }

  return (
    <Card title="정기 작업 수동 실행" sub="배포 서버는 유휴 시 정지하므로 예약 시각에 잠들어 있으면 정기 실행이 건너뛰어진다. 여기서 직접 돌린다.">
      <Table head={['작업', '예정', '']}>
        <tr>
          <Td>환율 갱신 (USD→KRW)</Td>
          <Td className="whitespace-nowrap text-xs text-adm-muted tnum">매일 09:15</Td>
          <Td className="whitespace-nowrap"><button type="button" onClick={fx} className={`btn btn-ghost ${small}`}>지금 갱신</button></Td>
        </tr>
        <tr>
          <Td>개인정보 파기<br /><span className="text-xs text-adm-muted">{retention}</span></Td>
          <Td className="whitespace-nowrap text-xs text-adm-muted tnum">매일 04:00</Td>
          <Td className="whitespace-nowrap">
            <button type="button" onClick={() => loadRetention()} className={`btn btn-ghost mr-1.5 ${small}`}>대상 다시 세기</button>
            <button type="button" onClick={purge} className={danger}>파기 실행</button>
          </Td>
        </tr>
      </Table>
      <p className="mt-3 text-sm text-adm-muted"><b className="text-adm-text">파기는 되돌릴 수 없다.</b> 실행하면 확인 문구를 한 번 더 묻는다. 보유기간은 개인정보처리방침과 같은 값이다.</p>
    </Card>
  );
}
