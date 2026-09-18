import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';

/* 라이트를 "정확도가 떨어진다"고 적지 않는다 — 디테일 미선택자를 불완전으로 표현하지 않는 것이 정책이다
   (UX_POLICY §2 두 수준 진단). 대신 각 모드가 **무엇을 받아 무엇을 더 해주는지**와 걸리는 품을 적는다(규칙 9). */
const MODES = [
  { to: '/light', title: '라이트모드', badge: '질문 3개',
    desc: ['데이터·통신비·구독만 답하면', '바로 절감액과 조합이 나와요'] },
  { to: '/detail', title: '디테일모드', badge: '질문 6개',
    desc: ['통신사·약정·가족결합까지 넣어', '위약금과 갈아탈 시점까지 챙겨요'] },
];

/* 시안: 민트 바탕을 화면 끝까지, 유리 카드 두 장. 동전·돋보기는 장식이라 aria-hidden 이고 좁은 화면에서는 뺀다. */
export default function Modes() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <main className="relative min-h-[calc(100vh-66px)] overflow-hidden bg-brand px-6 pb-20 pt-16 text-center text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
          <Coin className="-left-20 top-10 size-[260px] text-[120px]" />
          <Coin className="-right-10 top-24 size-[200px] text-[90px]" />
          <Coin className="-bottom-40 left-[45%] size-[300px] text-[140px]" />
          <span className="absolute right-[6%] top-1/4 -rotate-[20deg] text-[300px] leading-none drop-shadow-[0_30px_40px_rgba(0,0,0,.25)]">🔍</span>
        </div>

        <div className="relative mx-auto max-w-[1200px]">
          <button type="button" onClick={() => navigate('/')} className="btn-text -ml-2 mb-2 text-white/85 hover:text-white">
            ← 처음으로
          </button>
          <h1 className="text-[28px] font-extrabold leading-[1.5] tracking-[-.02em] md:text-[40px]">
            나의 <Chip>데이터사용량</Chip> <Chip>통신비</Chip> <Chip>구독서비스</Chip> 를 분석해서<br />
            얼마나 절감할 수 있을지 바로 알려드려요!
          </h1>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {MODES.map(m => (
              <Link key={m.to} to={m.to}
                    className="group relative flex min-h-64 flex-col justify-center rounded-xl bg-white/55 px-7 pb-20 pt-10
                               text-center text-ink backdrop-blur-[14px] transition duration-150 hover:-translate-y-[3px] hover:bg-white/70 md:min-h-80">
                <span className="mx-auto mb-3 rounded-full bg-ink/85 px-3 py-1 text-xs font-bold text-white">{m.badge}</span>
                <h2 className="text-[26px] font-extrabold tracking-[-.02em] md:text-[32px]">{m.title}</h2>
                <p className="mt-4 text-base leading-relaxed md:mt-6 md:text-lg">{m.desc[0]}<br />{m.desc[1]}</p>
                <span aria-hidden="true"
                      className="absolute bottom-7 right-7 grid size-16 place-items-center rounded-full bg-white text-[26px]
                                 transition-colors duration-150 group-hover:bg-ink group-hover:text-white">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

const Chip = ({ children }) => (
  <span className="mx-0.5 inline-block rounded-full bg-[#111] px-[18px] py-1.5 align-middle text-[.72em] font-bold leading-snug text-white">
    {children}
  </span>
);

function Coin({ className }) {
  return (
    <span className={`absolute grid place-items-center rounded-full bg-gradient-to-br from-[#ffd977] to-[#f5b93d] font-extrabold
      text-[#9a6b00] opacity-90 blur-[5px] ${className}`}>₩</span>
  );
}
