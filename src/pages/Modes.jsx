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

export default function Modes() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-bg-page">
      <Header />
      <main className="mx-auto flex min-h-[calc(100dvh-68px)] max-w-[960px] items-center px-5 py-10 sm:px-6">
        <section className="w-full text-center">
          <button type="button" onClick={() => navigate('/')} className="btn-text mb-5 text-ink-soft hover:text-ink">
            ← 처음으로
          </button>
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-xl font-extrabold leading-snug tracking-[-.03em] sm:gap-3 sm:text-[30px] lg:flex-nowrap">
            <Chip>데이터사용량</Chip>
            <Chip>통신비</Chip>
            <Chip>구독서비스</Chip>
            <span>입력하고 분석합니다.</span>
          </h1>
          <div className="mt-8 grid gap-3 text-left sm:grid-cols-2 sm:gap-4">
            {MODES.map(m => (
              <Link key={m.to} to={m.to}
                    className="group relative flex min-h-44 flex-col justify-between rounded-card border border-line bg-white p-6 shadow-card
                               transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-ink sm:min-h-52 sm:p-7">
                <span className="text-xs font-bold text-muted">{m.badge}</span>
                <div className="mt-5 pr-14">
                  <h2 className="text-[24px] font-extrabold tracking-[-.02em] sm:text-[28px]">{m.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft sm:text-[15px]">{m.desc}</p>
                </div>
                <span aria-hidden="true"
                      className="absolute bottom-6 right-6 grid size-11 place-items-center rounded-full bg-ink text-lg text-white
                                 transition-transform duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            ))}
          </div>
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
