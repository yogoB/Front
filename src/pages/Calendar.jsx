import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Footer } from '../components/Layout.jsx';
import { request } from '../lib/api.js';
import { won } from '../lib/model.js';
import { getInput, getResult, setInput, setNext } from '../lib/session.js';
import { useMember } from '../lib/useMember.js';
import GuestGate from '../components/GuestGate.jsx';
import { backendUrl } from '../lib/api.js';
import {
  WEEKDAYS, STEPS, STEP_COLORS, EVENTS_FROM_TODAY, EVENTS_FROM_EXPIRY,
  parseDay, startOfToday, dateOf, dayText, relativeDay, googleUrl, icsText, monthGrid,
} from '../lib/schedule.js';

/* 전환 액션 캘린더. 금액·요금제명은 결과 화면이 BE 응답에서 넘긴 값을 그대로 쓴다(같은 숫자는 같은 출처).
   담기는 **링크 방식**이다 — Google 일정 추가 화면을 열거나 .ics 를 내려준다.
   사용자의 캘린더를 서버가 대신 쓰지 않으므로 OAuth 권한도 토큰 보관도 없다.
   시안: 흰 머리판(제목·전환 금액 띠) 아래 회색 바탕에 카드 둘(가이드 범례 / 캘린더). 주간 보기는 시안대로 뺐다. */
export default function Calendar() {
  const navigate = useNavigate();
  const member = useMember();
  const today = useMemo(startOfToday, []);
  const result = getResult();
  const input = getInput();

  const [expiryText, setExpiryText] = useState(input?.contract?.endDate ?? '');
  const [note, setNote] = useState('');
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [mode, setMode] = useState('month');       // month | list
  const [showExport, setShowExport] = useState(false);

  // 일정의 기준일. 기본은 오늘이며, 약정 만료일이 앞으로 남아 있으면 그 날로 옮긴다.
  const expiry = parseDay(expiryText);
  const futureExpiry = expiry && expiry > today ? expiry : null;
  const [serverAnchor, setServerAnchor] = useState(null);   // 서버 판정이 이기면 여기에 들어온다
  const anchor = serverAnchor?.date ?? futureExpiry ?? today;
  const events = serverAnchor?.events ?? (futureExpiry ? EVENTS_FROM_EXPIRY : EVENTS_FROM_TODAY);

  useEffect(() => {
    setNote(futureExpiry
      ? `약정 만료일 ${dayText(futureExpiry)} 기준으로 일정을 잡았어요.`
      : expiryText
        ? '입력하신 약정 만료일이 이미 지나서 오늘 기준으로 잡았어요.'
        : '약정 만료일을 넣으면 그 날에 맞춰 드려요. 지금은 오늘 기준이에요.');
    if (futureExpiry) setView(new Date(futureExpiry.getFullYear(), futureExpiry.getMonth(), 1));
  }, [expiryText]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* 회원 + 현재 요금제 저장 시 서버가 전환 시점을 판정한다. 실패해도 입력 기반 기준일을 그대로 둔다(fail-soft). */
  useEffect(() => {
    if (!member?.currentPlanId || !result?.planId) return;
    // 약정 잔여 개월은 사용자가 넣은 만료일에서 센다. 서버는 이 날짜를 모른다.
    const months = futureExpiry ? Math.max(0, Math.round((futureExpiry - today) / (1000 * 60 * 60 * 24 * 30.4375))) : 0;
    const query = new URLSearchParams({ targetPlanId: String(result.planId), remainingContractMonths: String(months) });
    request(`/api/v1/me/switch-timing?${query}`, { member: true })
      .then(({ data }) => {
        if (data.status === 'SWITCH_NOW') {
          setServerAnchor({ date: today, events: EVENTS_FROM_TODAY });
          setNote(`지금 옮기는 게 이득이라 오늘 기준으로 잡았어요 (전환비용 회수 ${data.paybackMonths}개월, 약정 잔여 ${months}개월).`);
        } else if (data.status === 'WAIT_UNTIL_EXPIRY' && futureExpiry) {
          setServerAnchor({ date: futureExpiry, events: EVENTS_FROM_EXPIRY });
          setNote(`약정 만료일 ${dayText(futureExpiry)}까지 기다리는 게 이득이에요. 그 날에 맞춰 일정을 잡았어요.`);
        } else if (data.status === 'NO_BENEFIT') {
          setNote('지금 조건에서는 옮겨도 절감이 없어요. 아래 일정은 참고용이에요.');
        }
      })
      .catch(() => { /* 현재 요금제 미저장·서버 오류 — 입력 기반 기준일을 유지한다 */ });
  }, [member, result?.planId, futureExpiry, today]);

  function rememberExpiry(text) {
    setExpiryText(text);
    // 입력한 날짜는 결과 화면과 같은 곳에 둔다 — 같은 값을 두 벌로 관리하지 않는다.
    setInput({ ...(getInput() ?? {}), contract: { has: Boolean(text), endDate: text || null } });
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

  // 전환 일정에도 현재·전환 예상 금액이 들어간다. 결과 화면만 막고 여기를 열어 두면
  // 로그아웃 뒤 같은 탭에서 금액이 그대로 보인다(D-36 은 "금액은 한 줄도 비치지 않는다").
  if (member === undefined) return <><Header /><p className="p-10 text-center text-muted">불러오는 중…</p></>;
  if (member === null) {
    return <GuestGate onGoogle={() => { setNext('/calendar'); location.href = backendUrl('/oauth2/authorization/google'); }}
                      onBack={() => navigate('/modes')} />;
  }

  const stepName = i => (i < 3 ? `${i + 1}단계 · ` : '') + STEPS[i].when;

  return (
    <div className="min-h-screen bg-bg-page">
      <Header />
      <main className="mx-auto max-w-[1200px] pb-10">
        {/* 흰 머리판 — 제목·담기 버튼·전환 금액 띠 */}
        <div className="rounded-b-card border border-line bg-white px-6 pb-6 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => navigate('/results')} className="btn-text -ml-2 text-[13px]">← 추천 결과로 돌아가기</button>
                <span className="inline-block rounded bg-detail-tint px-2 py-0.5 text-[11px] font-bold text-detail">A안 선택됨</span>
              </div>
              <h1 className="mb-1 mt-1.5 text-2xl font-extrabold">통신사 전환 액션 캘린더</h1>
              <p className="max-w-prose text-sm leading-relaxed text-muted">Google 캘린더에 일정을 담고, 계획된 전환 일정을 관리하세요.</p>
            </div>
            <button type="button" onClick={() => setShowExport(v => !v)} className="btn btn-dark">Google 캘린더에 담기</button>
          </div>
          {/* 절감이 결론이므로 전환 후 금액만 강조색 */}
          <div className="mt-5 flex items-center gap-8 rounded-xl bg-bg-page px-6 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">현재 월 납부요금</span>
              <strong className="text-[22px] tracking-[-.01em] tnum">{result?.currentTotal == null ? '—' : won(result.currentTotal)}</strong>
            </div>
            <span className="text-xl font-extrabold text-brand" aria-hidden="true">→</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted">{result?.planLabel ? `${result.planLabel} 전환 예상요금` : '전환 예상요금'}</span>
              <strong className="text-[22px] tracking-[-.01em] text-brand-strong tnum">{result ? won(result.monthlyTotal) : '—'}</strong>
            </div>
          </div>
        </div>

        <div className="px-6">
          {note && <p className="mt-4 rounded-xl bg-brand-tint px-4 py-3 text-sm font-semibold leading-relaxed text-brand-ink">{note}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="expiry" className="text-sm font-semibold">약정 만료일을 알려주시면 그 날에 맞춰 일정을 잡아드려요</label>
            <input id="expiry" type="date" value={expiryText} onChange={e => rememberExpiry(e.target.value)}
                   className="field w-auto" />
            <button type="button" onClick={() => rememberExpiry('')} className="btn btn-ghost">지우기</button>
          </div>

          {showExport && member && (
            <ExportPanel events={events} anchor={anchor} result={result} onDownload={downloadIcs} />
          )}

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[300px_1fr]">
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
                      <span className="mb-0.5 mt-1 block text-sm font-bold text-ink">{s.title}</span>
                      <p className="m-0 text-xs leading-relaxed text-muted">{s.desc}</p>
                    </li>
                  ))}
                </ol>
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
                            className="ml-2 min-h-10 cursor-pointer rounded-lg bg-brand-tint px-3.5 text-xs font-bold text-brand-ink hover:bg-brand/30">
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
                : <Grid view={view} anchor={anchor} events={events} today={today} />}
            </section>
          </div>
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

function Grid({ view, anchor, events, today }) {
  const y = view.getFullYear(), m = view.getMonth();
  const sameMonthAsToday = today.getFullYear() === y && today.getMonth() === m;
  const byDay = new Map();
  for (const e of events) {
    const d = dateOf(anchor, e.offset);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const list = byDay.get(d.getDate()) ?? [];
      list.push(e); byDay.set(d.getDate(), list);
    }
  }
  const weeks = monthGrid(y, m);
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map(w => <div key={w} className="py-1 text-center text-xs font-bold text-muted">{w}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1.5">
          {week.map((day, di) => {
            const isToday = sameMonthAsToday && day === today.getDate();
            if (day == null) return <div key={di} className="min-h-[84px]" />;
            return (
              <div key={di} className={`flex min-h-[84px] flex-col gap-1 overflow-hidden rounded-[10px] border p-1.5
                ${isToday ? 'border-brand bg-brand-tint' : 'border-line'}`}>
                <span className={`text-[13px] font-semibold ${isToday ? 'text-brand-strong' : 'text-ink-soft'}`}>{day}</span>
                {(byDay.get(day) ?? []).map(e => (
                  <span key={e.label} title={e.label}
                        className="truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight"
                        style={{ background: STEP_COLORS[e.step] + '1f', color: STEP_COLORS[e.step] }}>
                    {e.label}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** 리스트 보기(시안) — 날짜별로 묶어 한 줄씩. 달을 오가지 않고 전체 흐름을 본다.
    지난 일정은 체크 표시 — 실제 완료 여부는 모르므로 날짜가 지났다는 뜻일 뿐이다. */
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
              <span>{date.getDate()}일 {WEEKDAYS[date.getDay()]}요일</span>
              {isToday
                ? <span className="rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-extrabold text-brand-ink">TODAY</span>
                : <span className="text-xs font-semibold text-muted">{relativeDay(date, today)}</span>}
            </div>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {items.map(e => (
                <li key={e.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 text-sm">
                  <span className={`grid size-[18px] place-items-center rounded-full border-[1.5px] text-[11px] font-extrabold
                    ${past ? 'border-brand bg-brand text-white' : 'border-[#cfd3da]'}`}>{past ? '✓' : ''}</span>
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
function ExportPanel({ events, anchor, result, onDownload }) {
  return (
    <section className="card mt-6 p-6">
      <h2 className="mb-2 text-lg font-bold">캘린더에 담기</h2>
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
                 className="text-sm font-semibold text-brand-ink underline hover:text-brand-strong">{e.label}</a>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onDownload} className="btn btn-ghost">전체 일정 내려받기 (.ics)</button>
      <p className="mt-2 text-[13px] text-muted">애플 캘린더·아웃룩은 내려받은 파일을 열어 추가하세요.</p>
    </section>
  );
}
