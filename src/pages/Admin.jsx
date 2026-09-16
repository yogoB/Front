import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../lib/api.js';

/* 백오피스(D-32). 숫자는 전부 서버가 만든다 — 여기서 계산하지 않는다.
   회원 화면과 같은 쿠키 세션 + CSRF 헤더를 쓴다(request 의 member:true).
   BE 가 내려주던 admin.html/admin.js 를 프론트 라우트로 옮긴 것이다(D-39). 기능·문구는 그대로다. */
const call = (path, opts = {}) => request(path, { member: true, ...opts }).then(r => r.data);

/** -1 은 "알 수 없음"이다(표가 없거나 조회 실패). 0 으로 적으면 거짓말이 된다. */
const show = value => (typeof value === 'number' && value >= 0 ? value.toLocaleString('ko-KR') : '—');
const pick = (data, path) => path.split('.').reduce((value, key) => (value ?? {})[key], data);

/* 주요 사용자 지표. 화면 맨 위 띠에 크게 올린다 — 운영자가 제일 먼저 읽는 줄이다.
   delta 는 우리가 실제로 가진 값만 붙인다. 지난주 대비 % 같은 건 과거 총계가 없어 만들 수 없다. */
const KPI = [
  ['members.total', '전체 회원', 'members.signedUp24h', '24시간'],
  ['members.signedUp7d', '7일 가입'],
  ['members.activeSessions', '활성 세션'],
  ['members.withSubscription', '구독 등록 회원'],
];
const CARDS = [
  ['카탈로그', [['catalog.mobilePlans', '요금제'], ['catalog.subscriptionServices', '구독 서비스'],
    ['catalog.subscriptionTiers', '구독 등급'], ['catalog.planBenefits', '제휴 혜택']]],
  ['검수', [['review.pendingRequests', '검수 대기'], ['review.mismatched', '불일치(차단)'],
    ['review.unverified', '미확인'], ['review.appliedToday', '24시간 반영']]],
  ['제보 · 결손', [['reports.pending', '제보 대기'], ['reports.total', '제보 전체'], ['gaps', '카탈로그 결손']]],
];
const ACTIVITY_ROWS = [['signups', '가입'], ['reports', '정보 오류 제보'], ['proposals', '수집 제안'], ['applied', '카탈로그 반영']];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 'YYYY-MM-DD' → 요일. 서버가 준 날짜 문자열만 쓰고 현지 시간대로 다시 해석하지 않는다. */
function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const TAG = {
  VERIFIED: 'bg-brand-tint border-[#a7e3c2] text-brand-ink', APPLIED: 'bg-brand-tint border-[#a7e3c2] text-brand-ink',
  MISMATCH: 'bg-danger-tint border-[#f0a9a2] text-[#8c2b22]', FAILED: 'bg-danger-tint border-[#f0a9a2] text-[#8c2b22]',
  DELETE: 'bg-danger-tint border-[#f0a9a2] text-[#8c2b22]',
  UNVERIFIED: 'bg-warn-tint border-[#f0cf95] text-warn-ink', UPDATE: 'bg-warn-tint border-[#f0cf95] text-warn-ink',
  SKIPPED: 'bg-[#f0f1f5] border-line text-ink-soft', CREATE: 'bg-detail-tint border-[#c3d0f7] text-detail',
};
const Tag = ({ value }) => (
  <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${TAG[value] ?? TAG.SKIPPED}`}>
    {value || '—'}
  </span>
);

const Section = ({ title, children }) => (
  <section className="my-5 rounded-card border border-line bg-white p-6 shadow-card">
    <h2 className="mb-2 text-[17px] font-extrabold tracking-[-.01em]">{title}</h2>
    {children}
  </section>
);
const Table = ({ head, children }) => (
  <table className="mt-3 w-full border-collapse text-sm">
    <thead><tr>{head.map((h, i) => <th key={i} scope="col" className="border-b border-line px-2.5 py-2 text-left text-xs text-muted">{h}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table>
);
const Td = ({ children, className = '' }) => <td className={`border-b border-line px-2.5 py-2 align-top whitespace-pre-line ${className}`}>{children}</td>;
const Empty = ({ cols, text }) => <tr><Td /><Td className="text-muted">{text}</Td>{Array.from({ length: cols - 2 }, (_, i) => <Td key={i} />)}</tr>;
const select = 'field mt-2 max-w-60';
const ghost = 'btn btn-ghost mt-3';

export default function Admin() {
  const [session, setSession] = useState(undefined);   // 확인 중 / null / 관리자
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [limit, setLimit] = useState('50');
  const [audit, setAudit] = useState([]);
  const [retention, setRetention] = useState('대상 건수를 확인하는 중…');

  useEffect(() => { document.title = '요고비 · 백오피스'; }, []);

  const say = setMessage;
  const fail = e => say(e.message);
  const loadDashboard = useCallback(() => call('/api/v1/admin/dashboard').then(setDashboard), []);
  const loadRequests = useCallback(() =>
    call(`/api/v1/admin/catalog/requests${status ? `?status=${status}` : ''}`).then(setRequests), [status]);
  const loadAudit = useCallback(() => call(`/api/v1/admin/catalog/audit?limit=${limit}`).then(setAudit), [limit]);
  /** 파기 대상 건수. 지우기 전에 항상 이걸 먼저 보여준다 — 파기는 되돌릴 수 없다. */
  const loadRetention = useCallback(() => call('/api/v1/admin/retention/pending').then(counts => {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    setRetention(total
      ? `지금 파기 대상 ${total}건 — ` + Object.entries(counts).filter(([, n]) => n).map(([name, n]) => `${name} ${n}`).join(', ')
      : '지금 파기 대상이 없어요.');
  }).catch(e => setRetention(`대상 건수를 읽지 못했어요: ${e.message}`)), []);

  /** 로그인 여부로 화면을 가른다. 관리자가 아니면 지표·검수는 아예 보이지 않는다. */
  const showSession = useCallback(async () => {
    try {
      setSession(await call('/api/v1/admin/session'));
      await Promise.all([loadDashboard(), loadRequests(), loadAudit(), loadRetention()]);
    } catch { setSession(null); }
  }, [loadDashboard, loadRequests, loadAudit, loadRetention]);

  useEffect(() => { showSession(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (session) loadRequests().catch(fail); }, [status]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (session) loadAudit().catch(fail); }, [limit]);   // eslint-disable-line react-hooks/exhaustive-deps

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
  async function decide(id, action) {
    const reason = action === 'reject' ? window.prompt('거절 사유를 적어주세요.') : null;
    if (action === 'reject' && reason === null) return;
    try {
      await call(`/api/v1/admin/catalog/requests/${id}/${action}`, { method: 'POST', body: action === 'reject' ? { reason } : {} });
      say(`#${id} ${action === 'approve' ? '승인했어요. 카탈로그에 반영됐습니다.' : '거절했어요.'}`);
      await Promise.all([loadRequests(), loadDashboard(), loadAudit()]);
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
      await loadDashboard();
    } catch (e) { fail(e); }
  }
  async function harvest() {
    say('수집하는 중이에요…');
    try {
      const r = await call('/api/v1/admin/harvest/run', { method: 'POST', body: {} });
      say(`수집 완료 — 요금제 ${r.proposedMobilePlans}건 · 구독 ${r.proposedSubscriptionTiers}건 제안, 검수 대기 ${r.pending}건`);
      await Promise.all([loadRequests(), loadDashboard(), loadAudit()]);
    } catch (e) { fail(e); }
  }
  async function fx() {
    say('환율을 갱신하는 중이에요…');
    try {
      const r = await call('/api/v1/admin/fx/refresh', { method: 'POST', body: {} });
      say(r.updated ? `환율 갱신 완료 — USD/KRW ${r.rate} (기준일 ${r.rateDate})`
        : `갱신하지 못해 이전 값을 유지했어요${r.rate ? ` — USD/KRW ${r.rate} (기준일 ${r.rateDate})` : ''}.`);
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
      await Promise.all([loadRetention(), loadDashboard()]);
    } catch (e) { fail(e); }
  }

  return (
    <div className="min-h-screen bg-bg-soft">
    <main className="mx-auto max-w-page px-6 pb-20 pt-10">
      <Link to="/" className="font-semibold text-brand-ink hover:underline">요고비 홈</Link>
      <h1 className="mt-2 text-[28px] font-extrabold tracking-[-.02em]">백오피스</h1>
      <p role="status" aria-live="polite" className="my-2 min-h-[2em] whitespace-pre-wrap font-semibold text-ink-soft">{message}</p>

      {session === null && (
        <Section title="운영자 로그인">
          <form onSubmit={login}>
            <label className="mt-3.5 block text-sm font-bold" htmlFor="admin-id">아이디</label>
            <input id="admin-id" name="id" autoComplete="username" required className="field" />
            <label className="mt-3.5 block text-sm font-bold" htmlFor="admin-password">비밀번호</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="field" />
            <button type="submit" className="btn btn-brand mt-3">로그인</button>
          </form>
        </Section>
      )}

      {session && (
        <>
          <Section title="사용 지표">
            <p>{session.loginId} (회원번호 {session.userId})로 로그인했어요.</p>
            <Dashboard data={dashboard} />
            <button type="button" onClick={() => Promise.all([loadDashboard(), loadAudit()]).catch(fail)} className={`${ghost} mr-2`}>새로고침</button>
            <button type="button" onClick={logout} className={ghost}>로그아웃</button>
          </Section>

          <Section title="수집 데이터 검수">
            <p>매일 오전 9시(한국시간)에 모은 변경 후보예요. <b>검토</b>는 스마트초이스 시세와 AI 조회 두 곳과 대조한 결과이고,{' '}
              <Tag value="MISMATCH" />는 승인할 수 없어요.</p>
            <label className="mt-3.5 block text-sm font-bold" htmlFor="status-filter">상태</label>
            <select id="status-filter" value={status} onChange={e => setStatus(e.target.value)} className={select}>
              <option value="PENDING">검수 대기</option><option value="APPROVED">승인됨</option>
              <option value="REJECTED">거절됨</option><option value="FAILED">반영 실패</option><option value="">전체</option>
            </select>
            <Table head={['#', '대상', '변경', '검토', '사유', '']}>
              {requests.length ? requests.map(r => (
                <tr key={r.id} title={status === '' ? r.status : undefined}>
                  <Td>#{r.id}</Td>
                  <Td>{r.dataset}{'\n'}{r.row_key ?? ''}</Td>
                  <Td>{r.payload ?? ''}</Td>
                  <Td><Tag value={r.review_status || 'SKIPPED'} /><div>{r.review_detail ?? ''}</div></Td>
                  <Td>{r.reason ?? ''}</Td>
                  <Td className="whitespace-nowrap">
                    {r.status === 'PENDING' ? (
                      <>
                        {/* 서버도 막지만 화면에서도 먼저 막는다 */}
                        <button type="button" disabled={r.review_status === 'MISMATCH'} onClick={() => decide(r.id, 'approve')}
                                className="btn btn-brand mr-1.5 px-3.5 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-45">승인</button>
                        <button type="button" onClick={() => decide(r.id, 'reject')}
                                className="btn border-[#f0a9a2] bg-white px-3.5 py-1.5 text-[13px] text-danger hover:bg-danger-tint">거절</button>
                      </>
                    ) : r.status}
                  </Td>
                </tr>
              )) : <Empty cols={6} text="대기 중인 항목이 없어요." />}
            </Table>
            <p className="mt-3">시세 스냅샷이 비어 있으면 요금제 제안이 만들어지지 않아요 — <b>시세 수집을 먼저</b> 돌리세요.
              배포 서버는 유휴 시 정지하므로 예약 시각에 잠들어 있으면 정기 실행이 건너뛰어집니다. 그때는 여기서 직접 돌립니다.</p>
            <button type="button" onClick={sweep} className={`${ghost} mr-2`}>① 시세 스냅샷 수집</button>
            <button type="button" onClick={harvest} className="btn btn-brand mt-3">② 지금 수집 실행</button>
          </Section>

          <Section title="정기 작업 수동 실행">
            <p>배포 서버는 유휴 시 정지하므로 예약 시각에 잠들어 있으면 정기 실행이 건너뛰어져요. 여기서 직접 돌립니다.</p>
            <Table head={['작업', '예정', '']}>
              <tr>
                <Td>환율 갱신 (USD→KRW)</Td>
                <Td className="whitespace-nowrap text-[13px] text-muted tnum">매일 09:15</Td>
                <Td className="whitespace-nowrap"><button type="button" onClick={fx} className="btn btn-ghost px-3.5 py-1.5 text-[13px]">지금 갱신</button></Td>
              </tr>
              <tr>
                <Td>개인정보 파기<br /><span>{retention}</span></Td>
                <Td className="whitespace-nowrap text-[13px] text-muted tnum">매일 04:00</Td>
                <Td className="whitespace-nowrap">
                  <button type="button" onClick={() => loadRetention()} className="btn btn-ghost mr-1.5 px-3.5 py-1.5 text-[13px]">대상 다시 세기</button>
                  <button type="button" onClick={purge} className="btn border-[#f0a9a2] bg-white px-3.5 py-1.5 text-[13px] text-danger hover:bg-danger-tint">파기 실행</button>
                </Td>
              </tr>
            </Table>
            <p className="mt-3"><b>파기는 되돌릴 수 없어요.</b> 실행하면 확인 문구를 한 번 더 묻습니다. 보유기간은 개인정보처리방침과 같은 값이에요.</p>
          </Section>

          <Section title="카탈로그 변경 이력">
            <p>원본이 파일이라 git 이력이 남지 않아요. <b>이 목록이 유일한 변경 기록</b>입니다(D-26).
              되돌린 변경(<Tag value="FAILED" />)도 시도 자체가 감사 대상이라 남습니다.</p>
            <label className="mt-3.5 block text-sm font-bold" htmlFor="audit-limit">표시 개수</label>
            <select id="audit-limit" value={limit} onChange={e => setLimit(e.target.value)} className={select}>
              <option value="50">최근 50건</option><option value="200">최근 200건</option><option value="500">최근 500건</option>
            </select>
            <Table head={['시각', '운영자', '동작', '대상', '결과']}>
              {audit.length ? audit.map((e, i) => <AuditRow key={i} entry={e} />) : <Empty cols={5} text="아직 변경 이력이 없어요." />}
            </Table>
          </Section>
        </>
      )}
    </main>
    </div>
  );
}

function Dashboard({ data }) {
  if (!data) return null;
  return (
    <>
      <ul className="my-4 mb-5 flex list-none flex-wrap border-y border-line py-5">
        {KPI.map(([path, label, deltaPath, deltaLabel]) => {
          const delta = deltaPath === undefined ? null : pick(data, deltaPath);
          return (
            <li key={path} className="flex-[1_1_150px] border-l border-line px-5 first:border-l-0 first:pl-0">
              <span className="block text-[13px] font-semibold text-muted">{label}</span>
              <b className="block text-[32px] font-extrabold leading-tight tracking-[-.02em] tnum">{show(pick(data, path))}</b>
              {typeof delta === 'number' && delta >= 0 && (
                <span className={`mt-0.5 inline-block text-xs font-bold ${delta > 0 ? 'text-brand-ink' : 'text-muted'}`}>
                  {deltaLabel} {delta > 0 ? '+' : ''}{delta}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
        <div className="col-span-full rounded-xl border border-line bg-bg-soft p-4">
          <h3 className="text-sm font-bold">최근 7일 활동</h3>
          <Activity days={data.weeklyActivity || []} />
        </div>
        {CARDS.map(([title, rows]) => (
          <div key={title} className="rounded-xl border border-line bg-bg-soft p-4">
            <h3 className="text-sm font-bold">{title}</h3>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              {rows.map(([path, label]) => (
                <div key={path} className="contents">
                  <dt className="text-ink-soft">{label}</dt><dd className="m-0 font-bold tnum">{show(pick(data, path))}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <h3 className="mt-6 text-sm font-bold">요청이 많은 엔드포인트</h3>
      <p className="text-sm text-muted">서버가 켜진 뒤 누적값이에요. 재시작하면 0부터 다시 셉니다.</p>
      <Table head={['경로', '메서드', '상태', '요청', '평균(ms)']}>
        {(data.endpoints || []).map((row, i) => (
          <tr key={i}><Td>{row.uri}</Td><Td>{row.method}</Td><Td>{row.status}</Td><Td className="tnum">{show(row.count)}</Td><Td className="tnum">{row.avgMs}</Td></tr>
        ))}
      </Table>
    </>
  );
}

/* 최근 7일 활동. 숫자를 항상 적고, 막대는 셀 바닥의 가는 선으로만 둔다(숫자를 가리지 않게). 합계 열이 요약을 대신한다. */
function Activity({ days }) {
  if (!days.length) return <p className="text-sm text-muted">활동 기록을 읽지 못했어요.</p>;
  const today = days[days.length - 1].date;
  return (
    <div className="overflow-x-auto">
      <table className="mt-1 min-w-[560px] w-full text-[13px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left" />
            {days.map(day => (
              <th key={day.date} scope="col" className={`px-2 py-1.5 text-right text-[11px] ${day.date === today ? 'text-brand-ink' : ''}`}>
                {day.date.slice(5).replace('-', '/')} {weekday(day.date)}
              </th>
            ))}
            <th scope="col" className="border-l border-line bg-white px-2 py-1.5 text-right text-[11px] font-extrabold">합계</th>
          </tr>
        </thead>
        <tbody>
          {ACTIVITY_ROWS.map(([key, label]) => {
            const counts = days.map(day => Number(day[key]) || 0);
            const max = Math.max(...counts);
            return (
              <tr key={key}>
                <td className="whitespace-nowrap px-2 py-1.5 text-left text-ink-soft">{label}</td>
                {counts.map((n, i) => (
                  <td key={i} className={`px-2 py-1.5 text-right tnum ${n ? '' : 'text-[#c9ccd3]'}`}>
                    <span className="relative block pb-[5px]">
                      {n.toLocaleString('ko-KR')}
                      {n > 0 && <i className="absolute inset-x-0 bottom-0 block h-[3px] origin-right rounded-sm bg-brand"
                                   style={{ transform: `scaleX(${(n / max).toFixed(3)})` }} />}
                    </span>
                  </td>
                ))}
                <td className="border-l border-line bg-white px-2 py-1.5 text-right font-extrabold tnum">
                  {counts.reduce((a, b) => a + b, 0).toLocaleString('ko-KR')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* 카탈로그 변경 이력(D-26·D-27). 되돌린 변경(FAILED)도 시도 자체가 감사 대상이므로 숨기지 않는다. */
function AuditRow({ entry }) {
  // 서버가 준 시각을 그대로 보여준다. 파싱에 실패하면 원문을 남긴다 — 감사 기록은 지어내지 않는다.
  const at = new Date(entry.created_at);
  const when = Number.isNaN(at.getTime()) ? String(entry.created_at ?? '')
    : at.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'medium' });
  const diff = [['변경 전', entry.before_row], ['변경 후', entry.after_row]].filter(([, v]) => v);
  return (
    <tr>
      <Td className="whitespace-nowrap text-[13px] text-muted tnum">{when}</Td>
      <Td className="whitespace-nowrap">회원번호 {entry.actor_id}</Td>
      <Td className="whitespace-nowrap"><Tag value={entry.action} /></Td>
      <Td>
        {entry.dataset}{'\n'}{entry.row_key ?? ''}
        {/* 변경 전후는 CSV 한 줄이 최대 4,000자다. 기본은 접어두고 펼쳐서 본다. */}
        {diff.length > 0 && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[13px] font-semibold text-brand-ink">변경 전후 보기</summary>
            {diff.map(([label, value]) => (
              <p key={label} className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-ink-soft">
                <b className="mt-1.5 block text-[11px] font-bold text-muted">{label}</b>{value}
              </p>
            ))}
          </details>
        )}
      </Td>
      <Td><Tag value={entry.outcome} />{entry.detail && <div>{entry.detail}</div>}</Td>
    </tr>
  );
}
