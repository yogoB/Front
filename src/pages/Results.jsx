import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Footer } from '../components/Layout.jsx';
import { request, ApiError, backendUrl } from '../lib/api.js';
import { won, provenance, splitLines } from '../lib/model.js';
import { getInput, setResult, setNext } from '../lib/session.js';
import { useMember } from '../lib/useMember.js';
import GuestGate from '../components/GuestGate.jsx';

const DEFAULT_GB = 10;   // 데이터 사용량을 건너뛴 경우의 계산 기준. 숨기지 않고 화면에 적는다(원칙 5-①).

/** 유지하기로 한 구독만 추천 대상이다(디테일 모드의 '해지'는 제외). */
const keptSubs = source => (source.subs || []).filter(s => !s.disposition || s.disposition === '유지');

export default function Results() {
  const navigate = useNavigate();
  const member = useMember();
  const input = getInput();
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    // 비회원이면 **계산도 하지 않는다** — 금액이 한 줄도 비치지 않아야 하므로 아예 받아오지 않는다(D-36).
    if (member === undefined || member === null || !input) return;
    if (!keptSubs(input).length) { setFailure('추천에 포함할 구독 서비스를 고르지 않았어요. 다시 선택해 주세요.'); return; }
    request('/api/v1/recommendations', { method: 'POST', body: buildRequest(input) })
      .then(({ data }) => setData(data))
      .catch(e => setFailure(e instanceof ApiError ? e.message : '추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }, [member, input]);

  if (!input) return <Empty message="모드를 선택하고 조건을 입력하면 결과를 볼 수 있어요." />;
  if (member === undefined) return <><Header /><p className="p-10 text-center text-muted">불러오는 중…</p></>;
  if (member === null) {
    return <GuestGate onGoogle={() => { setNext('/results'); location.href = backendUrl('/oauth2/authorization/google'); }}
                      onBack={() => navigate('/modes')} />;
  }
  if (failure) return <Empty message={failure} />;
  if (!data) return <><Header /><p className="p-10 text-center text-muted">계산하는 중…</p></>;

  const best = data.results[0];
  const notices = buildNotices(input, data, best);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[980px] px-6 py-8">
        <span className="inline-block rounded-full bg-brand-tint px-3 py-1.5 text-[13px] font-bold text-brand-ink">
          AI 최적화 분석 완료
        </span>
        <h1 className="mb-2 mt-4 text-2xl font-extrabold tracking-[-.01em] md:text-[28px]">최적 요금 조합 비교 분석</h1>

        {best && <SaveHero best={best} />}
        <Summary message={data.message} />
        <p className="my-6 max-w-prose rounded-xl bg-warn-tint px-4 py-3 text-sm leading-relaxed text-warn-ink">
          ‘추천·정가’ 금액과 요금제는 계산 서버가 카탈로그로 계산한 값입니다. ‘현재’ 열은{' '}
          <strong>입력하신 값의 합계</strong>예요.
        </p>

        {notices.length > 0 && (
          <ul className="mb-6 grid list-none gap-2.5 rounded-xl bg-bg-soft px-5 py-4 text-sm leading-relaxed text-ink-soft">
            {notices.map(text => (
              <li key={text} className="max-w-[72ch]">
                <span className="text-brand-ink">ⓘ </span>
                {splitLines(text).map((line, i) => <span key={i} className="block first:inline">{line}</span>)}
              </li>
            ))}
          </ul>
        )}

        {input.mode === 'light' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-tint px-6 py-5">
            <div>
              <strong className="font-bold">더 정밀한 결과를 원하시나요?</strong>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">통신사·약정·결합 할인을 추가 반영하면 더 정확한 조합을 찾을 수 있어요.</p>
            </div>
            <button type="button" onClick={() => navigate('/detail')} className="btn btn-brand">더 정확한 절감받기</button>
          </div>
        )}

        {best && <CompareTable input={input} best={best} />}
        {best && <SaveResult input={input} best={best} />}

        <ul className="mt-8 flex list-none flex-wrap gap-2.5 p-0">
          {['금액마다 출처 표시', '안 쓰는 혜택은 0원으로 계산', '카드·계좌 연결 없음'].map(t => (
            <li key={t} className="chip"><span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />{t}</li>
          ))}
        </ul>

        {best && <Breakdown best={best} />}
        {best && <ReportWrong planId={best.planId} planName={best.planName} />}
        {data.reasons?.length > 0 && <Reasons reasons={data.reasons} />}

        <div className="mt-10 flex flex-wrap justify-between gap-3">
          <button type="button" onClick={() => navigate('/modes')} className="btn btn-ghost">← 다시 비교하기</button>
          <button type="button" onClick={() => navigate('/calendar')} className="btn btn-brand">이렇게 진행해보세요! →</button>
        </div>
      </main>
      <div className="mx-auto w-full max-w-[980px] px-6"><Footer /></div>
    </>
  );
}

/* 결론 먼저(원칙 5-③) — 다만 금액을 하나도 만들지 않는다(원칙 2).
   월·연 절감은 BE 의 monthlySavings·annualSavings 를 그대로 쓴다. 기준은 정가(baseline)이며
   사용자의 현재 청구액이 아니다(integration.md 결과 해석). */
function SaveHero({ best }) {
  const saving = best.monthlySavings > 0;
  return (
    <section className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-6 rounded-card bg-brand-tint px-6 py-6 md:px-8">
      <div>
        <span className="block text-sm font-semibold text-brand-ink">{saving ? '정가 대비 매달' : '추천 조합은 매달'}</span>
        <strong className="my-1 block text-[40px] font-extrabold leading-tight tracking-[-.02em] text-brand-strong tnum">
          {won(saving ? best.monthlySavings : best.monthlyTotal)}
        </strong>
        <span className="block text-sm font-semibold text-ink-soft">
          {saving ? `1년이면 ${won(best.annualSavings)}` : '정가보다 싼 조합을 찾지 못했어요'}
        </span>
      </div>
      <dl className="m-0 flex gap-2.5">
        <Delta label="추천 조합" value={won(best.monthlyTotal)} />
        <Delta label="정가 기준" value={won(best.baseline)} />
      </dl>
    </section>
  );
}

const Delta = ({ label, value }) => (
  <div className="min-w-[128px] rounded-xl bg-white px-4 py-3">
    <dt className="text-xs font-semibold text-muted">{label}</dt>
    <dd className="m-0 mt-0.5 text-lg font-bold tnum">{value}</dd>
  </div>
);

function buildRequest(source) {
  const optional = {};
  // 통신사 이름을 그대로 보낸다. BE 는 금액에 쓰지 않고, 카탈로그에 없는 이름이면 결손(catalog_candidate)으로
  // 기록해 수집 우선순위를 만든다 — 그래서 '알뜰폰'으로 뭉뚱그리지 않는다(QA 2026-09-17).
  if (source.carrier) optional.currentCarrier = source.carrier;
  // 모른다고 한 값은 빼서 missingInputs 안내가 그대로 남는다(원칙 5-①).
  if (source.networkType) optional.networkType = source.networkType;
  if (source.contractType) optional.contractType = source.contractType;
  if (typeof source.hasFamilyBundle === 'boolean') optional.hasFamilyBundle = source.hasFamilyBundle;
  // 결합 중일 때만 회선 수·월 할인액(G-28). 빈 값은 보내지 않는다 — 할인액이 없으면 BE 가 missingInputs 로 알려준다.
  if (source.hasFamilyBundle === true) {
    const lines = Number(source.familyLineCount), discount = Number(source.familyBundleDiscountKrw);
    if (source.familyLineCount !== '' && Number.isInteger(lines) && lines >= 2 && lines <= 10) optional.familyLineCount = lines;
    if (source.familyBundleDiscountKrw !== '' && Number.isInteger(discount) && discount >= 0) optional.familyBundleDiscountKrw = discount;
  }
  return {
    required: {
      monthlyDataGb: source.data?.gb ?? DEFAULT_GB,
      wantedServiceIds: keptSubs(source).map(s => s.id),
      // 사용자가 고른 등급을 그대로 보낸다. 없으면 BE 가 대표 등급을 고른다(챗봇 경로와 같은 기본값).
      wantedTierIds: keptSubs(source).map(s => s.tierId).filter(Boolean),
    },
    optional,
  };
}

/* 모르면 막히지 않는다(원칙 5-①): 빠진 입력과 카탈로그 결손을 그대로 안내한다. */
/* ⓘ 안내. missingInputs 문장은 서버(notices)가 만든다 — 같은 값으로 두 곳에서 문장을
   만들면 표현이 갈라진다(D-46). 여기 남는 둘은 서버가 알 수 없는 것뿐이다:
   데이터 입력을 건너뛴 화면 상태와, 결과가 없어 서버가 내레이터를 부르지 않은 경우. */
function buildNotices(source, data, best) {
  const notices = [];
  if (!source.data) notices.push(`데이터 사용량을 건너뛰어 ${DEFAULT_GB}GB 기준으로 계산했어요. 실제 사용량을 넣으면 결과가 정확해져요.`);
  notices.push(...(data.notices || []));
  if (!best) notices.push('조건에 맞는 요금제를 아직 찾지 못했어요. 조건을 바꾸거나 잠시 후 다시 시도해 주세요.');
  return notices;
}

/** 사용자가 입력한 현재 월 지출 합계 — 화면의 메모다. 절감액 계산에는 쓰지 않는다. */
function currentTotal(source) {
  if (source.fee?.amount === undefined) return null;
  return source.fee.amount + keptSubs(source).reduce((sum, s) => sum + (s.price || 0), 0);
}

function CompareTable({ input, best }) {
  const current = currentTotal(input);
  const dataLabel = input.data ? `${input.data.label} 충족` : `${DEFAULT_GB}GB 기준 충족`;
  const planLabel = `${best.carrier} ${best.planName}`;
  // 내역 줄의 금액은 '비용'이다. 제휴 혜택은 note 로 표시되므로 그 줄만 혜택으로 센다.
  const benefits = best.breakdown.filter(l => l.note === '제휴 혜택 적용').map(l => `${l.label} ${won(l.amount)}`);
  const discounts = best.breakdown.filter(l => l.amount < 0).map(l => `${l.label} ${won(l.amount)}`);

  const rows = [
    ['요금제 (Plan)', input.carrier ? `${input.carrier} · 현재 요금제` : '현재 요금제', planLabel, planLabel],
    ['데이터 (Data)', input.data ? input.data.label : '모름', dataLabel, dataLabel],
    ['통화 (Calls)', '확인 필요', '확인 필요', '확인 필요'],
    ['부가혜택 (Benefits)', '—', benefits.length ? benefits : ['포함된 구독 혜택 없음'], '정가 기준(혜택 미반영)'],
    ['할인/적립 (Discounts)', '—', discounts.length ? discounts : ['적용된 할인 없음'], '할인 미적용'],
    ['약정 기간 (Contract)',
      input.contract?.has ? ['약정 있음', input.contract.endDate && `종료 ${input.contract.endDate}`].filter(Boolean) : ['무약정'],
      '선택약정 미반영', '선택약정 미반영'],
    ['위약금 (Penalty)', input.contract?.has ? '확인 필요' : '없음', '확인 필요', '확인 필요'],
  ];

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      {/* fixed: 내용 길이와 무관하게 비교 3열의 가로 폭을 똑같이 준다. */}
      <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
        <colgroup><col className="w-[19%]" /><col className="w-[27%]" /><col className="w-[27%]" /><col className="w-[27%]" /></colgroup>
        <thead>
          <tr>
            <th scope="col" className="border-b-2 border-line bg-bg-soft px-4.5 py-3.5 text-left align-top" />
            <ColHead title="현재 상황" sub="현재 통신사 및 납부 요금" total={current === null ? '—' : won(current)} />
            <ColHead title="추천 · 최적값 🌟" best sub="체감 환산 월 요금" total={won(best.monthlyTotal)}
                     save={best.monthlySavings > 0 ? `정가 대비 월 ${won(best.monthlySavings)} 절감` : ''} />
            <ColHead title="정가 기준" sub="할인 전 정가 합계" total={won(best.baseline)} />
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cur, rec, low]) => (
            <tr key={label}>
              <th scope="row" className="border-b border-line bg-bg-soft px-4.5 py-3.5 text-left align-top font-semibold text-ink-soft">
                {label}
              </th>
              <Cell value={cur} />
              <Cell value={rec} best />
              <Cell value={low} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 머리 셀의 각 줄에 같은 높이를 주어 총액이 한 선에 놓이게 한다(세로 균일). */
function ColHead({ title, sub, total, save, best }) {
  return (
    <th scope="col" className={`border-b-2 px-4.5 py-3.5 text-left align-top
      ${best ? 'border-brand bg-brand/[.06] shadow-[inset_2px_0_0_var(--color-brand),inset_-2px_0_0_var(--color-brand)]' : 'border-line'}`}>
      <span className="block min-h-5 text-[13px] font-bold text-ink-soft">{title}</span>
      <span className="my-1.5 mb-2 block min-h-[2.9em] text-xs font-medium text-muted">{sub}</span>
      <span className={`block text-[22px] font-extrabold tnum ${best ? 'text-brand-strong' : ''}`}>{total}</span>
      <span className="mt-1 block min-h-[1.5em] text-xs font-bold text-brand-strong">{save}</span>
    </th>
  );
}

/** 항목마다 한 줄. 쉼표로 이어 붙이면 줄 중간에서 끊긴다. */
function Cell({ value, best }) {
  const lines = Array.isArray(value) ? value : [value];
  return (
    <td className={`border-b border-line px-4.5 py-3.5 align-top
      ${best ? 'bg-brand/[.06] shadow-[inset_2px_0_0_var(--color-brand),inset_-2px_0_0_var(--color-brand)]' : ''}`}>
      {lines.map((line, i) => <span key={i} className="block first:mt-0 [&+span]:mt-[3px]">{line}</span>)}
    </td>
  );
}

/* 근거는 접되 버리지 않는다(원칙 5-④): 기본은 금액만, 펼치면 계산 과정과 출처. */
function Breakdown({ best }) {
  return (
    <details className="my-6 rounded-xl border border-line px-5 py-4">
      <summary className="cursor-pointer text-sm font-semibold">계산 과정과 출처 보기</summary>
      <ul className="mt-4 grid list-none gap-2.5 p-0">
        {best.breakdown.map((line, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2.5 text-sm">
            <span>{line.label}</span>
            <strong className="tnum">{won(line.amount)}</strong>
            <em className="text-xs not-italic text-ink-soft">{provenance[line.provenance] ?? line.provenance}</em>
            {line.note && <p className="col-span-full text-xs text-ink-soft">{line.note}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

const REPORT_FIELDS = [['PRICE', '금액이 달라요'], ['DATA', '데이터·통화가 달라요'],
  ['BENEFIT', '포함 혜택이 달라요'], ['AVAILABILITY', '지금 가입할 수 없어요'], ['OTHER', '그 밖의 오류']];

/** 정보 오류 제보(POST /api/v1/catalog/reports). 접수만 하고 회원 정보는 보내지 않는다.
    React 전환 때 통째로 빠져 있던 화면을 되살린 것이다. */
function ReportWrong({ planId, planName }) {
  const [field, setField] = useState('PRICE');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setStatus('');
    try {
      const body = { targetType: 'MOBILE_PLAN', targetId: planId, field, description: description.trim() };
      if (sourceUrl.trim()) body.sourceUrl = sourceUrl.trim();
      // 공개 엔드포인트지만 CSRF 면제 목록(/recommendations·/calculator)에 없다.
      // member:true 여야 request 가 토큰을 받아 붙인다 — 없으면 전부 403 이다.
      await request('/api/v1/catalog/reports', { method: 'POST', body, member: true });
      setDone(true);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : '제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { setBusy(false); }
  }

  return (
    <details className="mt-4 rounded-card border border-line p-5">
      <summary className="cursor-pointer text-sm font-semibold">정보가 잘못되었나요?</summary>
      {done
        ? <p className="mt-3 text-sm text-ink-soft">접수했어요. 확인한 뒤 카탈로그에 반영할게요. 고맙습니다.</p>
        : (
          <form onSubmit={submit} className="mt-3 grid gap-2">
            <p className="text-[13px] text-muted">
              <strong className="text-ink-soft">{planName}</strong> 의 정보가 실제와 다르면 알려주세요.
              개인정보(이름·전화번호·계약번호)는 적지 말아 주세요.
            </p>
            <select value={field} onChange={e => setField(e.target.value)} aria-label="잘못된 항목" className="field">
              {REPORT_FIELDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={2000}
                      aria-label="무엇이 다른지" placeholder="예: 월 39,000원이 아니라 41,000원이에요." className="field" />
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} inputMode="url"
                   aria-label="출처 링크(선택)" placeholder="출처 링크(선택) — 통신사 공식 페이지 https://…" className="field" />
            <div className="flex items-center gap-3">
              <button type="submit" disabled={!description.trim() || busy}
                      className="btn btn-brand disabled:cursor-not-allowed disabled:opacity-45">
                {busy ? '보내는 중…' : '제보 보내기'}
              </button>
              {status && <span className="text-[13px] text-danger">{status}</span>}
            </div>
          </form>
        )}
    </details>
  );
}

/* 상황 정리 문장은 BE(/recommendations 의 message)가 준다 — 내레이터의 결정론적 템플릿이라
   모델 키가 없어도 나온다(D-38). AI 에 아예 닿지 못하면 null 이고, 그때는 화면이 최소 설명을 적는다.
   화면이 금액을 문장으로 다시 쓰지 않는다 — 숫자를 만드는 곳은 계산 서버 하나다(절대 원칙 2). */
function Summary({ message }) {
  if (!message) {
    return (
      <p className="mb-6 max-w-prose leading-relaxed text-muted">
        절감액은 계산 서버가 준 <strong className="text-ink">정가 대비</strong> 값이에요. 월 기준으로 비교했어요.
      </p>
    );
  }
  return (
    <p className="mb-6 max-w-prose leading-relaxed text-muted">
      {splitLines(message).map((line, i) => (
        <span key={i} className="block [&+span]:mt-1">{line}</span>
      ))}
    </p>
  );
}

/* 추천 사유는 BE(/recommendations 의 reasons)가 만든다. AI 장애 시 빈 배열이고 그때는 섹션을 숨긴다. */
function Reasons({ reasons }) {
  return (
    <section className="mt-8 rounded-card border border-line bg-bg-soft p-6">
      <h2 className="mb-4 text-lg font-extrabold">💡 왜 나에게 이 상품이 추천됐나요?</h2>
      <ul className="m-0 grid list-none gap-3 p-0">
        {reasons.map((text, i) => (
          <li key={i} className="max-w-prose text-sm leading-relaxed text-ink-soft">
            {splitLines(text).map((line, j) => <span key={j} className="block [&+span]:mt-[3px]">{line}</span>)}
          </li>
        ))}
      </ul>
      <p className="mt-3.5 text-[13px] text-muted">
        상기 분석 결과는 통신사별 결합 형태에 따라 실제 고지 금액과 다를 수 있습니다.
      </p>
    </section>
  );
}

/** 캘린더가 같은 숫자를 쓰도록 결과를 넘긴다(원칙 5-⑤: 같은 숫자는 같은 출처). */
function SaveResult({ input, best }) {
  useEffect(() => {
    setResult({
      planId: best.planId,
      currentTotal: currentTotal(input),
      planLabel: `${best.carrier} ${best.planName}`,
      monthlyTotal: best.monthlyTotal, monthlySavings: best.monthlySavings, annualSavings: best.annualSavings,
    });
  }, [input, best]);
  return null;
}

function Empty({ message }) {
  return (
    <>
      <Header />
      <main className="mx-auto my-20 max-w-[560px] px-6 text-center">
        <span className="inline-block rounded-full bg-brand-tint px-3 py-1.5 text-[13px] font-bold text-brand-ink">안내</span>
        <h1 className="mt-5 text-[26px] font-extrabold">비교할 입력이 없어요</h1>
        <p className="mt-3 text-muted">{message}</p>
        <a href="/modes" className="btn btn-brand mt-7 inline-flex">모드 선택으로</a>
      </main>
    </>
  );
}
