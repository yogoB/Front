import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';
import { request, ApiError } from '../lib/api.js';
import { loadCatalog } from '../lib/catalog-data.js';
import { won, matches, tierPrice, tierKrwGuess, integer } from '../lib/model.js';
import { useMember, forgetMember } from '../lib/useMember.js';

/** BE 카탈로그의 통신망 코드 → 화면 표기. 모르는 값은 그대로 보여준다. */
const NETWORKS = { FIVE_G: '5G', LTE: 'LTE', THREE_G: '3G' };

/** BE 탐지 규칙(docs/domain.md §7)의 화면 문구. 금액·판정은 BE 가 하고 여기선 이름만 붙인다. */
const RULES = {
  BENEFIT_OVERLAP: ['요금제에 포함된 구독을 따로 결제 중', '요금제 혜택으로 이미 제공돼요. 개별 결제를 해지하면 그만큼 줄어요.'],
  TIER_DUPLICATE: ['같은 서비스를 두 등급으로 결제 중', '더 비싼 등급 하나만 남기면 나머지가 줄어요.'],
  BUNDLE_OVERLAP: ['묶음 상품이 더 싼 조합', '개별 결제 합계가 묶음 상품보다 비싸요.'],
};

const message = e => (e instanceof ApiError ? e.message : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');

export default function MyPage() {
  const loaded = useMember();
  const [member, setMember] = useState(null);
  const [plans, setPlans] = useState([]);       // 현재 요금제 검색·이름 표시
  const [services, setServices] = useState([]); // 구독 추가 폼의 서비스·등급
  const [subscriptions, setSubscriptions] = useState([]);
  const [findings, setFindings] = useState([]);

  useEffect(() => { if (loaded) setMember(loaded); }, [loaded]);

  // 공개 카탈로그와 회원 데이터는 서로를 기다리지 않는다.
  useEffect(() => {
    if (!loaded) return;
    request('/api/v1/catalog/plans').then(({ data }) => setPlans(data)).catch(() => {});
    loadCatalog().then(setServices).catch(() => {});
    reloadSubs(); reloadDetections();
  }, [loaded]);   // eslint-disable-line react-hooks/exhaustive-deps

  const reloadSubs = () => request('/api/v1/me/subscriptions', { member: true })
    .then(({ data }) => setSubscriptions(data)).catch(() => {});
  const reloadDetections = () => request('/api/v1/me/detections', { member: true })
    .then(({ data }) => setFindings(data)).catch(() => {});

  if (loaded === undefined) return <><Header /><p className="p-10 text-center text-muted">불러오는 중…</p></>;

  // 비회원도 화면은 열린다(원칙 5-①). 저장이 필요한 부분만 로그인 안내로 바꾼다.
  if (loaded === null) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-[760px] px-6 py-8">
          <h1 className="text-[26px] font-extrabold">내 계정</h1>
          <p className="mt-3 rounded-card border border-line bg-bg-soft p-5 text-sm text-ink-soft">
            로그인하면 현재 요금제와 구독을 저장해 중복 결제를 점검해 드려요.{' '}
            <Link to="/login" className="font-semibold text-brand-ink underline">로그인하기</Link>
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[760px] px-6 py-8">
        <Profile member={member} onChange={setMember} />
        <CurrentPlan member={member} plans={plans} onSaved={id => { setMember(m => ({ ...m, currentPlanId: id })); reloadDetections(); }} />
        <Subscriptions services={services} rows={subscriptions} onChanged={() => { reloadSubs(); reloadDetections(); }} />
        <Detections findings={findings} services={services} hasPlan={Boolean(member?.currentPlanId)} />
        <DeleteAccount />
      </main>
    </>
  );
}

/** 회원 탈퇴. 개인정보처리방침 3·6조가 약속하는 권리인데 화면에 길이 없었다(BE 는 이미 DELETE /me 를 연다).
    되돌릴 수 없으므로 '탈퇴'를 직접 적게 한다 — confirm() 대화상자는 쓰지 않는다. */
function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setStatus('');
    try {
      await request('/api/v1/me', { method: 'DELETE', member: true });
      forgetMember();                       // 캐시된 /me 를 버려야 헤더가 곧장 비회원으로 돌아간다
      sessionStorage.clear();               // 같은 탭에 남은 입력·결과(금액)도 함께 지운다
      location.replace('/');
    } catch (e) { setStatus(message(e)); setBusy(false); }
  }

  return (
    <Card title="회원 탈퇴">
      <p className="text-sm text-ink-soft">
        계정과 저장한 현재 요금제·구독 정보를 파기합니다. 되돌릴 수 없어요.
      </p>
      {!open
        ? <button type="button" onClick={() => setOpen(true)}
                  className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-sm text-muted underline hover:text-danger">
            탈퇴하기
          </button>
        : (
          <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input value={typed} onChange={e => setTyped(e.target.value)} aria-label="확인 문구"
                   placeholder="탈퇴 라고 입력" className="field" />
            <button type="submit" disabled={typed.trim() !== '탈퇴' || busy}
                    className="btn btn-brand disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? '처리 중…' : '탈퇴'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(''); setStatus(''); }}
                    className="btn btn-ghost">취소</button>
          </form>
        )}
      <Status>{status}</Status>
    </Card>
  );
}

function Card({ title, children, right }) {
  return (
    <section className="mb-5 rounded-card border border-line bg-white p-6 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const Status = ({ children }) => children ? <p className="mt-3 text-[13px] text-muted">{children}</p> : null;

function Profile({ member, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  if (!member) return null;

  // 이름이 없는 계정(Google 로그인)은 닉네임을 이름 자리에 쓴다.
  const display = member.name || member.nickname || member.email.split('@')[0];

  async function save(event) {
    event.preventDefault();
    const nickname = value.trim();
    if (!nickname) return;
    setStatus('저장 중…');
    try {
      const { data } = await request('/api/v1/me/nickname', { method: 'POST', member: true, body: { nickname } });
      onChange(data); setEditing(false); setStatus('');
    } catch (e) { setStatus(message(e)); }   // 중복이면 서버가 그 사실을 알려준다
  }

  return (
    <Card title="내 계정">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-brand text-xl font-extrabold text-white">
          {[...display][0] ?? '·'}
        </span>
        <div>
          <strong className="block text-lg font-bold">{display}</strong>
          {member.nickname && <span className="text-sm text-muted">@{member.nickname}</span>}
          <p className="text-sm text-ink-soft">{member.email}</p>
          <p className="text-[13px] text-muted">
            로그인 수단: {[member.localLogin && '비밀번호', member.googleLogin && 'Google'].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 grid gap-2">
          <input value={value} onChange={e => setValue(e.target.value)} autoFocus
                 aria-label="새 닉네임" className="field" />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-brand">저장</button>
            <button type="button" onClick={() => { setEditing(false); setStatus(''); }} className="btn btn-ghost">취소</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setValue(member.nickname ?? ''); setEditing(true); }}
                className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-brand-ink underline underline-offset-[3px]">
          닉네임 바꾸기
        </button>
      )}
      <Status>{status}</Status>
    </Card>
  );
}

function CurrentPlan({ member, plans, onSaved }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const current = plans.find(p => p.id === member?.currentPlanId);

  // 1,700여 개 중 검색어에 맞는 8개만 보여준다 — 목록 전체를 그리면 화면이 못 쓰게 된다.
  // 공백·대소문자를 무시한다 — "요고38"로도 "KT 요고 38"을 찾는다.
  const found = query.trim() ? plans.filter(p => matches(`${p.carrier} ${p.name}`, query)).slice(0, 8) : [];

  async function save(plan) {
    setStatus('저장 중…');
    try {
      await request('/api/v1/me/current-plan', { method: 'POST', member: true, body: { planId: plan.id } });
      onSaved(plan.id); setQuery('');
      setStatus('저장했어요. 이 요금제 기준으로 점검해요.');
    } catch (e) { setStatus(message(e)); }
  }

  return (
    <Card title="현재 요금제">
      <p className={`text-[15px] ${member?.currentPlanId ? 'font-bold text-ink' : 'text-muted'}`}>
        {current ? `${current.carrier} ${current.name}`
          : member?.currentPlanId ? `요금제 #${member.currentPlanId}` : '아직 저장하지 않았어요'}
      </p>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="통신사나 요금제명으로 검색"
             aria-label="요금제 검색" className="field mt-3" />
      {query.trim() && (
        <div className="mt-2 overflow-hidden rounded-card border border-line">
          {found.length ? found.map(plan => (
            <button key={plan.id} type="button" onClick={() => save(plan)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-line px-4 py-3.5 text-left
                      font-semibold last:border-b-0 ${plan.id === member?.currentPlanId ? 'bg-brand-tint text-brand-ink' : 'bg-white hover:bg-bg-soft'}`}>
              <span>{plan.carrier} {plan.name}</span>
              <small className="text-xs font-medium text-muted">
                {NETWORKS[plan.networkType] ?? plan.networkType} · 월 {won(plan.basePrice)}
              </small>
            </button>
          )) : <p className="px-4 py-3.5 text-sm text-muted">검색 결과가 없어요. 통신사나 요금제명 일부로 다시 찾아보세요.</p>}
        </div>
      )}
      <Status>{status}</Status>
    </Card>
  );
}

function Subscriptions({ services, rows, onChanged }) {
  const [serviceId, setServiceId] = useState('');
  const [tierId, setTierId] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('');

  const service = services.find(s => String(s.id) === serviceId) ?? services[0];
  const tiers = service?.tiers ?? [];

  useEffect(() => {
    if (!services.length) return;
    setServiceId(String(services[0].id));
  }, [services]);

  /** 등급을 고르면 공식 가격을 채운다 — 빈 입력창을 사용자에게 떠넘기지 않는다(원칙 5-②). */
  useEffect(() => {
    const first = tiers[0];
    if (!first) return;
    const chosen = tiers.find(t => String(t.id) === tierId) ?? first;
    setTierId(String(chosen.id));
    const guess = tierKrwGuess(chosen);
    setPrice(guess === null ? '' : String(guess));
    // 해외 결제는 환율 환산 추정치를 채워 주고 사용자가 실제 결제액으로 고치게 한다.
    setStatus(guess === null || chosen.currency === 'KRW'
      ? '등급을 고르면 공식 가격을 채워드려요. 실제 내는 금액과 다르면 고쳐 주세요.'
      : `해외 결제라 원화가 확정되지 않아 ${chosen.krwRateDate} 환율로 환산한 추정치예요. 실제 결제액으로 고쳐 주세요.`);
  }, [serviceId, tierId, services]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** BE 는 등급 이름만 준다. 어떤 서비스의 등급인지는 카탈로그에서 찾아 붙인다(못 찾으면 등급 이름만). */
  const tierLabel = (id, name) => {
    const owner = services.find(s => s.tiers.some(t => t.id === id));
    return owner ? `${owner.icon} ${owner.name} · ${name}` : name;
  };

  async function add(event) {
    event.preventDefault();
    let body;
    try {
      body = { tierId: integer(tierId, '구독 등급', 1), monthlyPrice: integer(price, '월 결제액') };
    } catch (e) { setStatus(e.message); return; }
    setStatus('추가하는 중…');
    try {
      await request('/api/v1/me/subscriptions', { method: 'POST', member: true, body });
      onChanged(); setStatus('추가했어요.');
    } catch (e) { setStatus(message(e)); }
  }

  async function remove(id) {
    try {
      await request(`/api/v1/me/subscriptions/${id}`, { method: 'DELETE', member: true });
      onChanged();
    } catch (e) { setStatus(message(e)); }
  }

  // 합계는 붙이지 않는다 — 프론트가 금액을 만들면 출처(원칙 4)가 없는 숫자가 된다(절대 원칙 2).
  // 해외 결제 등급은 원화 추정치라 단순 합산이 출처가 다른 숫자를 한 줄로 섞기도 한다.
  return (
    <Card title="내 구독" right={rows.length ? <span className="text-sm text-muted">{rows.length}개</span> : null}>
      <ul className="m-0 grid list-none gap-2 p-0">
        {rows.length ? rows.map(row => (
          <li key={row.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-line px-4 py-3">
            <span className="font-semibold">{tierLabel(row.tierId, row.tierName)}</span>
            <span className="text-sm text-ink-soft tnum">{won(row.monthlyPrice)}</span>
            <button type="button" onClick={() => remove(row.id)}
                    className="cursor-pointer border-0 bg-transparent text-sm text-muted hover:text-danger">삭제</button>
          </li>
        )) : <li className="rounded-xl bg-bg-soft px-4 py-3 text-sm text-muted">등록한 구독이 없어요. 아래에서 추가하면 중복 결제를 점검해 드려요.</li>}
      </ul>

      <form onSubmit={add} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <select value={serviceId} onChange={e => { setServiceId(e.target.value); setTierId(''); }}
                aria-label="구독 서비스" className="field">
          {services.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
        <select value={tierId} onChange={e => setTierId(e.target.value)} aria-label="구독 등급" className="field">
          {tiers.map(t => <option key={t.id} value={t.id}>{t.name} · {tierPrice(t)}</option>)}
        </select>
        <input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric"
               aria-label="월 결제액" className="field sm:w-28" />
        <button type="submit" className="btn btn-brand">추가</button>
      </form>
      <Status>{status}</Status>
    </Card>
  );
}

function Detections({ findings, services, hasPlan }) {
  /** BE 가 주는 참조는 `service:{id}` / `bundle:{id}` 다. 서비스는 카탈로그 이름으로 바꾸고 나머지는 그대로 둔다. */
  const targetName = ref => {
    const [kind, id] = String(ref).split(':');
    if (kind === 'service') {
      const s = services.find(x => String(x.id) === id);
      return s ? `${s.icon} ${s.name}` : `서비스 #${id}`;
    }
    return kind === 'bundle' ? '묶음 상품' : ref;
  };

  return (
    // 결론을 먼저 낸다(원칙 5-③)지만 합계·연 환산은 BE 가 줄 때까지 붙이지 않는다(절대 원칙 2).
    <Card title="중복 결제 점검"
          right={findings.length ? <span className="font-bold text-danger">{findings.length}건</span> : null}>
      <ul className="m-0 grid list-none gap-2 p-0">
        {findings.map((f, i) => {
          const [title, how] = RULES[f.rule] ?? [f.rule, ''];
          return (
            <li key={i} className="rounded-xl border border-line px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <strong className="font-bold">{title}</strong>
                <span className="text-sm font-bold text-danger tnum">월 {won(f.wastedAmount)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{targetName(f.targetRef)}</p>
              <p className="mt-0.5 text-[13px] text-muted">{how}</p>
            </li>
          );
        })}
      </ul>
      <Status>
        {findings.length ? '해지·변경은 각 서비스에서 직접 해주세요. 요고비는 금액만 알려드려요.'
          : hasPlan ? '중복으로 새는 금액이 없어요.'
            : '현재 요금제를 저장하면 요금제 혜택과 겹치는 구독까지 찾아드려요.'}
      </Status>
    </Card>
  );
}
