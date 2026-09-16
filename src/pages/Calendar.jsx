import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import { request } from '../lib/api.js';
import { won } from '../lib/model.js';
import { getInput, getResult, setInput } from '../lib/session.js';
import { useMember } from '../lib/useMember.js';
import {
  WEEKDAYS, STEPS, STEP_COLORS, EVENTS_FROM_TODAY, EVENTS_FROM_EXPIRY,
  parseDay, startOfToday, dateOf, dayText, relativeDay, googleUrl, icsText, monthGrid,
} from '../lib/schedule.js';

/* 전환 액션 캘린더. 금액·요금제명은 결과 화면이 BE 응답에서 넘긴 값을 그대로 쓴다(같은 숫자는 같은 출처).
   담기는 **링크 방식**이다 — Google 일정 추가 화면을 열거나 .ics 를 내려준다.
   사용자의 캘린더를 서버가 대신 쓰지 않으므로 OAuth 권한도 토큰 보관도 없다. */
export default function Calendar() {
  const navigate = useNavigate();
  const member = useMember();
  const today = useMemo(startOfToday, []);
  const result = getResult();
  const input = getInput();

  const [expiryText, setExpiryText] = useState(input?.contract?.endDate ?? '');
  const [note, setNote] = useState('');
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [mode, setMode] = useState('month');       // month | week | list
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
    a.href = url; a.download = '요고비-전환일정.ics'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1080px] px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" onClick={() => navigate('/results')}
                    className="cursor-pointer border-0 bg-transparent text-sm text-muted">← 추천 결과로 돌아가기</button>
            <span className="ml-2 inline-block rounded-full bg-brand-tint px-3 py-1 text-xs font-bold text-brand-ink">A안 선택됨</span>
          </div>
          {member
            ? <button type="button" onClick={() => setShowExport(v => !v)} className="btn btn-brand">캘린더에 담기</button>
            : <button type="button" onClick={() => navigate('/login')} className="btn btn-ghost">로그인하고 캘린더에 담기</button>}
        </div>

        <h1 className="my-1.5 text-[26px] font-extrabold">통신사 전환 액션 캘린더</h1>
        <p className="text-muted">계획된 전환 일정을 한눈에 확인하고, 준비 항목을 단계별로 챙기세요.</p>
        {note && <p className="my-2.5 rounded-xl bg-brand-tint px-3.5 py-2.5 text-sm font-semibold text-brand-ink">{note}</p>}

        <div className="my-3 flex flex-wrap items-center gap-3">
          <label htmlFor="expiry" className="text-sm font-semibold">약정 만료일을 알려주시면 그 날에 맞춰 일정을 잡아드려요</label>
          <input id="expiry" type="date" value={expiryText} onChange={e => rememberExpiry(e.target.value)}
                 className="rounded-field border border-line px-3.5 py-2.5" />
          <button type="button" onClick={() => rememberExpiry('')} className="btn btn-ghost">지우기</button>
        </div>

        {showExport && member && (
          <ExportPanel events={events} anchor={anchor} result={result} onDownload={downloadIcs} />
        )}

        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[320px_1fr]">
          <aside>
            <div className="flex items-center gap-3 rounded-2xl bg-bg-soft p-4">
              <div className="flex flex-col">
                <span className="text-xs text-muted">현재 월 납부요금</span>
                <strong className="text-lg tnum">{result?.currentTotal == null ? '—' : won(result.currentTotal)}</strong>
              </div>
              <span className="font-extrabold text-brand" aria-hidden="true">→</span>
              <div className="flex flex-col">
                <span className="text-xs text-muted">전환 예상요금</span>
                <strong className="text-lg text-brand-strong tnum">{result ? won(result.monthlyTotal) : '—'}</strong>
              </div>
            </div>

            <h2 className="mb-3 mt-[22px] text-[15px] font-extrabold">단계별 가이드</h2>
            <ol className="m-0 grid list-none gap-3.5 p-0">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[auto_1fr] gap-3">
                  <span className="mt-[5px] size-3 rounded-full" style={{ background: STEP_COLORS[i] }} />
                  <div>
                    <strong className="text-[13px] text-muted">{i + 1}단계 · {s.when}</strong>
                    <span className="my-0.5 block font-bold">{s.title}</span>
                    <p className="m-0 text-[13px] text-muted">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] text-muted">
              본 체크리스트와 일정은 정보 제공 목적이에요. 통신사·OTT 정책에 따라 요금·조건이 다를 수 있으니
              가입 전 공식 홈페이지에서 최종 확인해 주세요.
            </p>
          </aside>

          <section className="rounded-card border border-line p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {mode !== 'list' && (
                <div className="flex items-center gap-2">
                  <NavBtn onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} label="이전 달">‹</NavBtn>
                  <strong className="min-w-[110px] text-center text-base">{view.getFullYear()}년 {view.getMonth() + 1}월</strong>
                  <NavBtn onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} label="다음 달">›</NavBtn>
                  <button type="button" onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
                          className="cursor-pointer rounded-lg border border-line bg-white px-3 py-1 text-[13px] font-semibold text-ink-soft">
                    오늘로 이동
                  </button>
                </div>
              )}
              <div className="inline-flex gap-1 rounded-full bg-bg-soft p-1">
                {[['month', '월간'], ['week', '주간'], ['list', '리스트']].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setMode(key)}
                          className={`cursor-pointer rounded-full border-0 px-4 py-1.5 text-sm font-semibold
                            ${mode === key ? 'bg-white text-ink shadow-card' : 'bg-transparent text-muted'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {mode === 'list'
              ? <EventList events={events} anchor={anchor} today={today} />
              : <Grid view={view} mode={mode} anchor={anchor} events={events} today={today} />}
          </section>
        </div>
      </main>
    </>
  );
}

const NavBtn = ({ onClick, label, children }) => (
  <button type="button" onClick={onClick} aria-label={label}
          className="size-8 cursor-pointer rounded-lg border border-line bg-white text-base text-ink-soft">{children}</button>
);

function Grid({ view, mode, anchor, events, today }) {
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
  let weeks = monthGrid(y, m);
  if (mode === 'week') {
    const i = sameMonthAsToday ? weeks.findIndex(w => w.includes(today.getDate())) : 0;
    weeks = [weeks[i < 0 ? 0 : i]];
  }
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

/** 리스트 보기 — 일정이 여러 달에 걸치면 달을 오가야 흐름이 보인다. 목록은 한 번에 보여준다. */
function EventList({ events, anchor, today }) {
  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {events.map(e => {
        const date = dateOf(anchor, e.offset);
        const past = date < today;
        return (
          <li key={e.label}
              className={`grid grid-cols-[52px_auto_1fr_auto] items-center gap-3.5 rounded-xl border border-line px-4 py-3
                ${past ? 'opacity-55' : ''}`}>
            <div className="flex flex-col items-center leading-tight">
              <strong className="text-[15px] font-extrabold tnum">{date.getMonth() + 1}/{date.getDate()}</strong>
              <span className="text-[11px] font-semibold text-muted">{WEEKDAYS[date.getDay()]}</span>
            </div>
            <span className="size-2.5 rounded-full" style={{ background: STEP_COLORS[e.step] }} />
            <div>
              <span className="block text-sm font-bold">{e.label}</span>
              <small className="text-xs text-muted">{e.step + 1}단계 · {STEPS[e.step].when}</small>
            </div>
            <span className="whitespace-nowrap text-xs font-semibold text-muted">{relativeDay(date, today)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 담기는 링크 방식이다 — 서버가 사용자의 캘린더를 대신 쓰지 않는다. */
function ExportPanel({ events, anchor, result, onDownload }) {
  return (
    <section className="my-4 rounded-card border border-line p-5">
      <h2 className="mb-1.5 text-[17px] font-bold">캘린더에 담기</h2>
      <p className="text-[13px] text-muted">
        일정을 누르면 Google 캘린더 추가 화면이 새 탭에서 열려요. 저장은 직접 하시면 돼요 —
        요고비가 캘린더를 대신 수정하지 않아요.
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
