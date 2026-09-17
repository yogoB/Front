import { useNavigate } from 'react-router-dom';
import { Header, Footer } from '../components/Layout.jsx';
import AuthReturn from '../components/AuthReturn.jsx';

const TRUST = ['카드·계좌 연결 없음', '금액마다 출처 표시', '안 쓰는 혜택은 0원으로 계산'];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* Google 은 랜딩으로 복귀한다 — 게이트에서 출발했으면 그 화면으로 돌려보낸다. */}
      <AuthReturn />
      <main className="mx-auto flex w-full max-w-page flex-1 flex-col px-6">
        <section className="grid flex-1 items-center gap-8 py-12 md:grid-cols-[1.35fr_.65fr] md:py-16">
          <div>
            {/* ⚠️ DUMMY: 아래 data-dummy 두 곳은 시안 값이다. 집계가 아직 없다.
                서비스 후 대상이 추려지면 실제 사용자 기반 값으로 바꾼다(이름·금액·인원).
                바꿀 때 `grep -rn data-dummy` 로 한 번에 찾는다. */}
            <p className="mb-6 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-brand-tint px-3 py-1.5 text-[13px] font-bold text-brand-ink">
                통신비 · 구독료 최적화 진단
              </span>
              <span data-dummy="집계 전 시안 값" className="text-sm text-ink-soft">
                평균 <b className="font-extrabold text-ink">월 31,200원</b> 절감 ·{' '}
                <b className="font-extrabold text-ink">23,847명</b> 이용
              </span>
            </p>

            <h1 data-dummy="집계 전 시안 값"
                className="text-[34px] font-extrabold leading-[1.24] tracking-[-.03em] md:text-[52px]">
              38세 곽두팔님,<br />
              <span className="text-brand">얼마 전 월 38,000원</span> 아끼셨네요!
            </h1>

            <p className="mb-8 mt-6 max-w-prose text-base leading-relaxed text-ink-soft md:text-lg">
              몇 가지 질문에 답하다 보면 복잡한 내 통신비와 요금제가 정리되고,
              내 상황에 딱 맞는 선택지가 만들어집니다.
            </p>

            <button type="button" onClick={() => navigate('/modes')} className="btn btn-dark btn-lg">
              내 요금제 진단받기
            </button>

            <ul className="mt-8 flex list-none flex-wrap gap-2.5 p-0">
              {TRUST.map(text => (
                <li key={text} className="chip">
                  <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* 장식용. 의미 없는 그림이라 aria-hidden 이고 좁은 화면에서는 뺀다. */}
          <div aria-hidden="true" className="relative hidden min-h-[340px] md:block">
            <Coin className="left-[-14%] top-[8%] size-[72px] text-3xl" />
            <Coin className="right-[8%] top-[2%] size-10 text-[17px]" />
            <Coin className="right-[-6%] top-[34%] size-14 text-2xl" />
            <span className="absolute bottom-[6%] right-[4%] text-[150px] leading-none drop-shadow-[0_18px_30px_rgba(20,20,43,.18)]">
              💰
            </span>
          </div>
        </section>
        <Footer />
      </main>
    </div>
  );
}

function Coin({ className }) {
  return (
    <span className={`absolute grid place-items-center rounded-full bg-gradient-to-br from-[#ffd977] to-[#f5b93d]
      font-extrabold text-[#9a6b00] shadow-[0_10px_20px_rgba(245,185,61,.35)] ${className}`}>₩</span>
  );
}
