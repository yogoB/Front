import { useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../lib/api.js';

const EMPTY = { age14: false, terms: false, privacy: false, savingsAlerts: false, marketing: false };

/** Google OAuth 직전 동의. 서버 세션에 먼저 남겨 OAuth 주소 직접 진입으로 필수 동의를 우회하지 못하게 한다. */
export default function GoogleConsent({ onContinue, dark = false, label = 'Google로 계속하기' }) {
  const [checked, setChecked] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const all = Object.values(checked).every(Boolean);

  const toggle = (name, value) => setChecked(current => ({ ...current, [name]: value }));

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await request('/api/v1/auth/consent', { method: 'POST', member: true, body: checked });
      onContinue();
    } catch (e) {
      setError(e.message || '동의를 저장하지 못했어요. 다시 시도해 주세요.');
      setPending(false);
    }
  }

  const tone = dark ? 'text-white/85' : 'text-ink-soft';
  const link = dark ? 'text-white' : 'text-ink';
  return (
    <form onSubmit={submit} className={`text-left ${tone}`}>
      <fieldset disabled={pending} className="grid gap-3">
        <legend className="sr-only">가입 및 로그인 동의</legend>
        <Consent id="age14" checked={checked.age14} onChange={toggle} required>
          [필수] 만 14세 이상입니다.
        </Consent>
        <Consent id="terms" checked={checked.terms} onChange={toggle} required
                 after={<Link to="/terms" target="_blank" rel="noreferrer" className={`underline underline-offset-2 ${link}`}>보기</Link>}>
          [필수] 서비스 이용약관 동의
        </Consent>
        <Consent id="privacy" checked={checked.privacy} onChange={toggle} required
                 after={<Link to="/privacy" target="_blank" rel="noreferrer" className={`underline underline-offset-2 ${link}`}>보기</Link>}>
          [필수] 개인정보 수집·이용 동의
        </Consent>
        <Consent id="savingsAlerts" checked={checked.savingsAlerts} onChange={toggle}>
          [선택] 절감 추천 알림
          <span className={`mt-0.5 block text-xs ${dark ? 'text-white/55' : 'text-muted'}`}>요금제 변경 시점을 놓치지 않아요!</span>
        </Consent>
        <Consent id="marketing" checked={checked.marketing} onChange={toggle}>
          [선택] 이벤트·혜택 정보 수신 동의
        </Consent>
        <div className={`mt-1 border-t pt-3 ${dark ? 'border-white/15' : 'border-line'}`}>
          <Consent id="all-consent" checked={all} onChange={(_, value) => setChecked(Object.fromEntries(Object.keys(EMPTY).map(key => [key, value])))}>
            <strong className={dark ? 'text-white' : 'text-ink'}>전체 동의</strong>
          </Consent>
        </div>
      </fieldset>
      {error && <p role="alert" className={`mt-3 text-sm ${dark ? 'text-[#ffb4ab]' : 'text-danger'}`}>{error}</p>}
      <button type="submit" className={`btn btn-lg btn-block mt-6 ${dark ? 'btn-brand' : 'btn-dark'}`}>
        <GoogleMark />
        {pending ? '연결하는 중…' : label}
      </button>
    </form>
  );
}

function Consent({ id, checked, onChange, required = false, after, children }) {
  return (
    <div className="flex min-h-7 items-start gap-3">
      <input id={id} name={id} type="checkbox" checked={checked} required={required}
             onChange={event => onChange(id, event.target.checked)}
             className="mt-0.5 size-5 shrink-0 cursor-pointer accent-brand" />
      <div className="text-sm leading-relaxed">
        <label htmlFor={id} className="cursor-pointer">{children}</label>
        {after && <> · {after}</>}
      </div>
    </div>
  );
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true" className="size-5 shrink-0 rounded-sm bg-white p-0.5">
    <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" />
    <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
    <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
  </svg>
);
