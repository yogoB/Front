import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';

/* 라이트를 "정확도가 떨어진다"고 적지 않는다 — 디테일 미선택자를 불완전으로 표현하지 않는 것이 정책이다
   (UX_POLICY §2 두 수준 진단). 대신 각 모드가 **무엇을 받아 무엇을 더 해주는지**와 걸리는 품을 적는다(규칙 9). */
const MODES = [
  { to: '/light', title: '라이트모드', badge: '질문 3개',
    desc: '데이터·통신비·구독만 답하면 바로 절감액과 조합이 나와요.' },
  { to: '/detail', title: '디테일모드', badge: '질문 6개',
    desc: '통신사·약정·가족결합까지 넣어 위약금과 갈아탈 시점까지 챙겨요.' },
];

/* 입력받는 것을 두 덩어리로 적는다 — 데이터·통신비를 따로 세던 칩을 '통신요금정보'로 합쳤다(사용자 결정 2026-09-21).
   화면이 받는 항목 수가 아니라 사람이 떠올리는 단위로 말하는 편이 읽힌다. */
const INPUTS = ['통신요금정보', '구독서비스정보'];

export default function Modes() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-bg-page">
      <Header />
      <main className="mx-auto flex min-h-[calc(100dvh-68px)] max-w-[1250px] items-center px-5 py-10 sm:px-6">
        <section className="w-full text-center">
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-xl font-extrabold leading-snug tracking-[-.03em] sm:gap-3 sm:text-[30px] lg:flex-nowrap">
            {INPUTS.map(name => <Chip key={name}>{name}</Chip>)}
            <span>입력하고 분석합니다.</span>
          </h1>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {MODES.map(m => (
              <Link key={m.to} to={m.to}
                    className="group relative flex min-h-48 flex-col items-center justify-center rounded-card border border-line bg-white px-6 py-10 text-center shadow-card
                               transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-ink sm:min-h-64 sm:px-9">
                <span className="absolute left-6 top-6 text-xs font-bold text-muted sm:left-7 sm:top-7">{m.badge}</span>
                {/* 상세 설명은 호버로 띄운다(사용자 결정 2026-09-21). 손가락에는 호버가 없으므로
                    hover 가 되는 기기에서만 숨기고, 그때는 흐름에서 빼 제목이 카드 정중앙에 오게 한다.
                    숨기는 방식은 opacity 라 스크린리더는 그대로 읽는다 — .hover-reveal 은 index.css 에 있다. */}
                <div className="relative flex flex-col items-center">
                  <h2 className="text-[32px] font-extrabold tracking-[-.03em] sm:text-[42px]">{m.title}</h2>
                  <p className="hover-reveal mt-3 max-w-[32ch] text-sm leading-relaxed text-ink-soft transition-opacity duration-150 sm:text-[15px]">
                    {m.desc}
                  </p>
                </div>
                {/* 호버가 되는 기기에서만 오른쪽 아래에 띄운다(card-arrow, index.css).
                    손가락 기기에서는 설명이 흐름에 남아 있어 겹친다 — 320px 카드에서 실제로 겹쳤다. */}
                <span aria-hidden="true"
                      className="card-arrow grid size-11 place-items-center rounded-full bg-ink text-lg text-white
                                 transition-transform duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            ))}
          </div>

          <button type="button" onClick={() => navigate('/')} className="btn-text mt-6 text-ink-soft hover:text-ink">
            ← 처음으로
          </button>
        </section>
      </main>
    </div>
  );
}

const Chip = ({ children }) => (
  <span className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 py-2 text-[.68em] font-extrabold leading-none text-white sm:min-h-12 sm:px-5">
    {children}
  </span>
);
