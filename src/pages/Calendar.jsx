import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Footer } from '../components/Layout.jsx';
import { request } from '../lib/api.js';
import { getInput, getResult, setInput, setNext } from '../lib/session.js';
import { useMember } from '../lib/useMember.js';
import GuestGate, { MemberCheckFailed } from '../components/GuestGate.jsx';
import { backendUrl } from '../lib/api.js';
import {
  WEEKDAYS, STEPS, GUIDES, STEP_COLORS, EVENTS_FROM_TODAY, EVENTS_FROM_EXPIRY,
  parseDay, startOfToday, dateOf, dayText, isoDay, relativeDay, googleUrl, icsText, monthGrid,
} from '../lib/schedule.js';

/* 전환 액션 캘린더. 요금제명·금액은 결과 화면이 BE 응답에서 넘긴 값을 그대로 쓴다(같은 숫자는 같은 출처).
   담기는 **링크 방식**이다 — Google 일정 추가 화면을 열거나 .ics 를 내려준다.
   사용자의 캘린더를 서버가 대신 쓰지 않으므로 OAuth 권한도 토큰 보관도 없다.
   시안: 흰 머리판(제목 · 실행 시점 칩 · 연동 버튼) 아래 회색 바탕에 왼쪽 범례·실행 가이드, 오른쪽 월간 격자,
   맨 아래 "확인하고 진행하기" 띠. 격자의 각 일정은 Google 일정 추가 링크(↗)를 달고 있다. */
export default function Calendar() {
  const navigate = useNavigate();
  const member = useMember();
  const today = useMemo(startOfToday, []);
  // 세션 값은 마운트 때 한 번만 읽는다 — 렌더마다 읽으면 새 객체라 효과 deps 가 흔들린다(Results 의 무한 요청 사고).
  const [result] = useState(getResult);
  const [input] = useState(getInput);
  const exportRef = useRef(null);

  const [expiryText, setExpiryText] = useState(input?.contract?.endDate ?? '');
  const [note, setNote] = useState('');
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  // 폰에서는 리스트로 연다. 7열 격자는 360px 에서 칸이 40px 남짓이라 일정 이름이 통째로 눌려 사라진다
  // (사용자 제보 2026-09-20). 토글은 그대로 두어 격자도 볼 수 있다.
  const [mode, setMode] = useState(() =>
    (typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches ? 'list' : 'month'));
  const [showExport, setShowExport] = useState(false);

  // 일정의 기준일. 기본은 오늘이며, 약정 만료일이 앞으로 남아 있으면 그 날로 옮긴다.
  // 같은 문자열이면 같은 Date 여야 한다 — 렌더마다 새 Date 면 아래 switch-timing 효과가 응답마다 다시 돌아 무한 요청이 된다.
  const expiry = useMemo(() => parseDay(expiryText), [expiryText]);
  const futureExpiry = expiry && expiry > today ? expiry : null;
  const [server, setServer] = useState(null);   // 서버 판정 { status, date?, events? } — 이기면 기준일이 바뀐다
  const anchor = server?.date ?? futureExpiry ?? today;
  const events = server?.events ?? (futureExpiry ? EVENTS_FROM_EXPIRY : EVENTS_FROM_TODAY);

  useEffect(() => {
    setNote(futureExpiry
      ? `약정 만료일 ${dayText(futureExpiry)} 기준으로 일정을 잡았어요.`
      : expiryText
        ? '입력하신 약정 만료일이 이미 지나서 오늘 기준으로 잡았어요.'
        : '약정 만료일을 넣으면 그 날에 맞춰 드려요. 지금은 오늘 기준이에요.');
    if (futureExpiry) setView(new Date(futureExpiry.getFullYear(), futureExpiry.getMonth(), 1));
  }, [expiryText]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* 현재 요금제를 알면 서버가 전환 시점을 판정한다 — 디테일에서 고른 것(input) 이 프로필 저장값보다 우선이고
     프로필은 건드리지 않는다(#5, BE 가 currentPlanId 파라미터를 받는다). 실패해도 입력 기반 기준일을 그대로 둔다(fail-soft). */
  const currentPlanId = input?.currentPlanId ?? member?.currentPlanId ?? null;
  useEffect(() => {
    if (!currentPlanId || !result?.planId) return;
    // 약정 잔여 개월은 사용자가 넣은 만료일에서 센다. 서버는 이 날짜를 모른다.
    const months = futureExpiry ? Math.max(0, Math.round((futureExpiry - today) / (1000 * 60 * 60 * 24 * 30.4375))) : 0;
    const query = new URLSearchParams({ targetPlanId: String(result.planId), currentPlanId: String(currentPlanId), remainingContractMonths: String(months) });
    // 만료일은 사용자가 여기 적은 값이라 서버가 모른다. 문구에 쓰라고 함께 보낸다(D-47).
    if (futureExpiry) query.set('expiryDate', isoDay(futureExpiry));
    request(`/api/v1/me/switch-timing?${query}`, { member: true })
      .then(({ data }) => {
        // 판정별 문장은 서버가 만든다(D-47). 화면은 기준일과 일정만 고른다.
        const status = data.timing?.status;
        if (status === 'SWITCH_NOW') setServer({ status, date: today, events: EVENTS_FROM_TODAY, headline: data.headline });
        else if (status === 'WAIT_UNTIL_EXPIRY' && futureExpiry) setServer({ status, date: futureExpiry, events: EVENTS_FROM_EXPIRY, headline: data.headline });
        else if (status === 'NO_BENEFIT') setServer({ status, headline: data.headline });
        else return;
        if (data.note) setNote(data.note);
      })
      .catch(() => { /* 현재 요금제 미저장·서버 오류 — 입력 기반 기준일을 유지한다 */ });
  }, [currentPlanId, result?.planId, futureExpiry, today]);

  function rememberExpiry(text) {
    setExpiryText(text);
    // 입력한 날짜는 결과 화면과 같은 곳에 둔다 — 같은 값을 두 벌로 관리하지 않는다.
    setInput({ ...(getInput() ?? {}), contract: { has: Boolean(text), endDate: text || null } });
  }

  function openExport() {
    setShowExport(true);
    setTimeout(() => exportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  function downloadIcs() {
    const blob = new Blob([icsText(events, anchor, result, today)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '요고비-전환일정.ics';
    // 문서에 붙여야 파이어폭스가 클릭을 받고, 해제는 다음 틱으로 미뤄야 사파리가 받아쓰기 전에 끊기지 않는다.
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // .ics 에는 전환 예상 금액이 들어간다. 결과 화면만 막고 여기를 열어 두면
  // 로그아웃 뒤 같은 탭에서 금액이 그대로 나간다(D-36 은 "금액은 한 줄도 비치지 않는다").
  if (member === undefined) return <><Header /><p className="p-10 text-center text-muted">불러오는 중…</p></>;
  if (member === false) return <><Header /><MemberCheckFailed /></>;
  if (member === null) {
    return <GuestGate onGoogle={() => { setNext('/calendar'); location.href = backendUrl('/oauth2/authorization/google'); }}
                      onBack={() => navigate('/modes')} />;
  }

  const stepName = i => (i < 3 ? `${i + 1}단계 · ` : '') + STEPS[i].when;
  // 범례 제목: 가입 단계는 추천 통신사 이름으로, 시점은 그 단계 첫 일정의 달로("KT 가입 (11월 초)").
  const stepTitle = i => (i === 1 && result?.carrier) ? `${result.carrier} 가입` : STEPS[i].title;
  const stepWhen = i => {
    const first = events.find(e => e.step === i);
    if (!first) return '';
    const d = dateOf(anchor, first.offset), day = d.getDate();
    return `${d.getMonth() + 1}월${day <= 10 ? ' 초' : day >= 21 ? ' 말' : ''}`;
  };
  const timing = server?.headline ? server.headline
    : server?.status === 'SWITCH_NOW' ? '지금이 최적 실행 시점'
    : server?.status === 'NO_BENEFIT' ? '절감 없음 · 참고용 일정'
    : anchor === futureExpiry ? `약정 만료일 ${anchor.getMonth() + 1}월 ${anchor.getDate()}일이 실행 시점`
    : '오늘 기준 일정';

  return (
    <div className="min-h-screen bg-bg-page">
      <Header />
      {/* 흰 머리판 — 제목 · 실행 시점 칩 · 연동 버튼 */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 pb-6 pt-5">
          <div>
            <div className="flex items-center gap-2 text-[13px]">
              <button type="button" onClick={() => navigate('/results')} className="btn-text -ml-2">← 이전 단계로 돌아가기</button>
              <span className="text-line" aria-hidden="true">|</span>
              <span className="font-bold text-ink-soft">전환 플랜 상세</span>
            </div>
            <h1 className="mb-1.5 mt-1 text-[26px] font-extrabold">통신사 전환 액션 캘린더</h1>
            <p className="max-w-prose text-sm leading-relaxed text-muted">월간 캘린더로 전환 일정을 확인하고, 단계별 실행 가이드를 따라 진행해보세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* 이 화면이 추천하는 것은 "언제 바꾸느냐"다 — 강조색이 남는 유일한 자리다. */}
            <span className="rounded-lg bg-brand-tint px-3.5 py-2 text-[13px] font-bold text-brand-ink">{timing}</span>
            <button type="button" onClick={openExport} className="btn btn-dark">Google 캘린더 연동하기</button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-6 pb-10">
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor="expiry" className="text-sm font-semibold">약정 만료일을 알려주시면 그 날에 맞춰 일정을 잡아드려요</label>
          <input id="expiry" type="date" value={expiryText} onChange={e => rememberExpiry(e.target.value)} className="field w-auto" />
          <button type="button" onClick={() => rememberExpiry('')} className="btn btn-ghost">지우기</button>
          {note && <p className="basis-full text-[13px] font-semibold text-ink-soft">{note}</p>}
        </div>

        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="grid gap-6">
            <div className="card p-5">
              <h2 className="mb-3.5 text-[15px] font-extrabold">단계별 가이드 범례</h2>
              <ol className="m-0 grid list-none gap-2.5 p-0">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="rounded-[10px] px-3.5 py-3" style={{ background: STEP_COLORS[i] + '14' }}>
                    <strong className="text-xs font-bold" style={{ color: STEP_COLORS[i] }}>
                      <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: STEP_COLORS[i] }} />
                      {stepName(i)}
                    </strong>
                    <span className="mb-0.5 mt-1 block text-sm font-bold text-ink">{stepTitle(i)} {stepWhen(i) && `(${stepWhen(i)})`}</span>
                    <p className="m-0 text-xs leading-relaxed text-muted">{s.desc}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="card p-5">
              <h2 className="text-[15px] font-extrabold">실행 상세 및 가이드</h2>
              <p className="mb-3.5 mt-1 text-xs leading-relaxed text-muted">각 단계별 간단한 실행 가이드를 확인하고 일정에 맞춰 진행하세요.</p>
              <div className="grid gap-2">
                {GUIDES.map((g, i) => (
                  <details key={i} open={i === 0} className="group rounded-[10px]" style={{ background: STEP_COLORS[i] + '14' }}>
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-[13px] font-bold [&::-webkit-details-marker]:hidden"
                             style={{ color: STEP_COLORS[i] }}>
                      <span className="size-2 rounded-full" style={{ background: STEP_COLORS[i] }} />
                      {stepName(i)}
                      <svg className="ml-auto transition-transform group-open:rotate-180" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                    </summary>
                    <div className="px-3.5 pb-3.5">
                      <p className="m-0 text-[13px] leading-relaxed text-ink-soft">{g.intro}</p>
                      <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                        {g.items.map(t => (
                          <li key={t} className="flex gap-2 text-xs leading-relaxed text-muted">
                            <span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: STEP_COLORS[i] }} />{t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-2 text-[15px] font-extrabold">안내사항</h2>
              <p className="text-xs leading-relaxed text-muted">
                본 체크리스트와 일정은 정보 제공 목적이에요. 통신사·OTT 정책에 따라 요금·조건이 다를 수 있으니
                가입 전 공식 홈페이지에서 최종 확인해 주세요.
              </p>
            </div>
          </aside>

          <section className="card p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              {mode !== 'list' ? (
                <div className="flex items-center gap-1.5">
                  <strong className="mr-2 text-xl font-extrabold">{view.getFullYear()}년 {view.getMonth() + 1}월</strong>
                  <NavBtn onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} label="이전 달">‹</NavBtn>
                  <NavBtn onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} label="다음 달">›</NavBtn>
                  <button type="button" onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
                          className="ml-2 min-h-10 cursor-pointer rounded-lg border border-line bg-white px-3.5 text-xs font-bold text-ink-soft hover:bg-bg-soft">
                    오늘로 이동
                  </button>
                </div>
              ) : <span />}
              <div className="inline-flex gap-0.5 rounded-lg border border-line bg-white p-[3px]">
                {[['month', '캘린더'], ['list', '리스트']].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key}
                          className={`min-h-9 cursor-pointer rounded-md border-0 px-3.5 text-[13px] font-semibold transition-colors duration-150
                            ${mode === key ? 'bg-ink text-white' : 'bg-transparent text-muted hover:text-ink-soft'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {mode === 'list'
              ? <EventList events={events} anchor={anchor} today={today} stepName={stepName} />
              : <Grid view={view} anchor={anchor} events={events} today={today} result={result} />}
          </section>
        </div>

        {showExport && (
          <ExportPanel ref={exportRef} events={events} anchor={anchor} result={result} onDownload={downloadIcs} />
        )}

        {/* 맨 아래 띠(시안) — 체크포인트를 훑었으면 캘린더에 담는 것이 '진행'이다 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-ink bg-white px-6 py-5">
          <div>
            <strong className="block text-[15px] font-extrabold">확인하고 진행하세요</strong>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft">
              위약금, 결합 할인, 구독 해지, 첫 청구서까지 주요 체크포인트를 모두 확인한 뒤 전환을 시작하세요.
            </p>
          </div>
          <button type="button" onClick={openExport} className="btn btn-lg bg-[#7c5cf5] text-white hover:bg-[#6a4be0]">확인하고 진행하기</button>
        </div>
      </main>
      <div className="mx-auto w-full max-w-[1200px] px-6"><Footer /></div>
    </div>
  );
}

const NavBtn = ({ onClick, label, children }) => (
  <button type="button" onClick={onClick} aria-label={label}
          className="size-10 cursor-pointer rounded-lg border border-line bg-white text-lg text-ink-soft hover:bg-bg-soft">{children}</button>
);

/** 새 탭에서 열림을 알리는 화살표 아이콘 */
const Ext = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);

/** 월간 격자(시안) — 표 선, 이웃 달 날짜는 흐리게, 오늘은 TODAY 배지, 일정 있는 날은 단계 색 테두리.
    지난 일정은 회색 ✓ — 실제 완료 여부는 모르므로 날짜가 지났다는 뜻일 뿐이다. */
function Grid({ view, anchor, events, today, result }) {
  const y = view.getFullYear(), m = view.getMonth();
  const byDay = new Map();
  for (const e of events) {
    const d = dateOf(anchor, e.offset);
    (byDay.get(+d) || byDay.set(+d, []).get(+d)).push(e);
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`border-l border-line py-2.5 text-center text-xs font-bold first:border-l-0 ${i === 0 || i === 6 ? 'text-danger' : 'text-ink-soft'}`}>{w}</div>
        ))}
      </div>
      {monthGrid(y, m).map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
          {week.map(date => {
            const outside = date.getMonth() !== m, isToday = +date === +today;
            const items = byDay.get(+date) ?? [];
            const live = items.find(e => date >= today);   // 지나지 않은 날의 일정 → 그 단계 색으로 칸을 두른다
            const color = live && STEP_COLORS[live.step];
            return (
              <div key={+date} className="flex min-h-[120px] flex-col gap-1 border-l border-line p-2 first:border-l-0"
                   style={color ? { outline: `2px solid ${color}`, outlineOffset: -2 } : undefined}>
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-semibold ${outside ? 'text-muted/60' : ''}`} style={color ? { color } : undefined}>{date.getDate()}</span>
                  {isToday && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">TODAY</span>}
                </div>
                {items.map(e => {
                  const past = date < today, c = STEP_COLORS[e.step];
                  return (
                    <a key={e.label} href={googleUrl(e, anchor, result)} target="_blank" rel="noopener noreferrer" title={`${e.label} — Google 캘린더에 추가`}
                       className="flex items-start gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold leading-snug hover:opacity-80"
                       style={{ background: past ? '#eef0f3' : c + '1f', color: past ? '#6e6f85' : c }}>
                      {/* 좁은 화면에서는 점과 ↗ 를 접는다 — 그 둘이 자리를 먹어 이름이 0폭으로 눌렸다. */}
                      <span className="mt-px hidden size-3 shrink-0 place-items-center rounded-full border-[1.5px] border-current text-[7px] sm:grid">{past ? '✓' : '●'}</span>
                      <span className="line-clamp-3 min-w-0 flex-1">{e.label}</span>
                      {!past && <span className="ml-auto hidden shrink-0 sm:block"><Ext /></span>}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** 리스트 보기 — 날짜별로 묶어 한 줄씩. 달을 오가지 않고 전체 흐름을 본다. */
function EventList({ events, anchor, today, stepName }) {
  const days = new Map();
  for (const e of events) {
    const date = dateOf(anchor, e.offset);
    (days.get(+date) || days.set(+date, { date, events: [] }).get(+date)).events.push(e);
  }
  return (
    <ol className="m-0 list-none p-0">
      {[...days.values()].map(({ date, events: items }) => {
        const past = date < today, isToday = +date === +today;
        return (
          <li key={+date} className={`grid gap-4 border-b border-line py-4 last:border-b-0 md:grid-cols-[150px_1fr] ${past ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <span>{date.getMonth() + 1}월 {date.getDate()}일 {WEEKDAYS[date.getDay()]}</span>
              {isToday
                ? <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-extrabold text-white">TODAY</span>
                : <span className="text-xs font-semibold text-muted">{relativeDay(date, today)}</span>}
            </div>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {items.map(e => (
                <li key={e.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 text-sm">
                  <span className={`grid size-[18px] place-items-center rounded-full border-[1.5px] text-[11px] font-extrabold
                    ${past ? 'border-ink bg-ink text-white' : 'border-[#cfd3da]'}`}>{past ? '✓' : ''}</span>
                  <span className="font-semibold">{e.label}</span>
                  <span className="whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: STEP_COLORS[e.step] + '1f', color: STEP_COLORS[e.step] }}>{stepName(e.step)}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** 담기는 링크 방식이다 — 서버가 사용자의 캘린더를 대신 쓰지 않는다. */
function ExportPanel({ ref, events, anchor, result, onDownload }) {
  return (
    <section ref={ref} className="card mt-6 scroll-mt-6 p-6">
      <h2 className="mb-2 text-lg font-bold">Google 캘린더에 담기</h2>
      <p className="max-w-prose text-[13px] leading-relaxed text-muted">
        일정을 누르면 Google 캘린더 추가 화면이 새 탭에서 열려요. 저장은 직접 하시면 돼요 —
        요고비가 캘린더를 대신 수정하지 않아요. Google 링크에는 <strong>금액을 넣지 않아요</strong>.
        금액까지 함께 담으려면 아래에서 .ics 파일을 받으세요(기기 안에서만 처리돼요).
      </p>
      <ul className="my-3.5 grid list-none gap-2 p-0">
        {events.map(e => {
          const date = dateOf(anchor, e.offset);
          return (
            <li key={e.label} className="flex flex-wrap items-baseline gap-3">
              <span className="min-w-[68px] text-[13px] text-muted tnum">{date.getMonth() + 1}월 {date.getDate()}일</span>
              <a href={googleUrl(e, anchor, result)} target="_blank" rel="noopener noreferrer"
                 className="text-sm font-semibold text-ink underline hover:text-ink-soft">{e.label}</a>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onDownload} className="btn btn-ghost">전체 일정 내려받기 (.ics)</button>
      <p className="mt-2 text-[13px] text-muted">애플 캘린더·아웃룩은 내려받은 파일을 열어 추가하세요.</p>
    </section>
  );
}
