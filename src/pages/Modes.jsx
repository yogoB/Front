import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';

const MODES = [
  { to: '/light', title: '라이트모드', desc: ['3개의 질문으로 분석해드려요!', '단 정확도는 조금 떨어질 수 있어요'] },
  { to: '/detail', title: '디테일모드', desc: ['통신사·약정·희망 조건까지 넣어', '더 정확한 조합을 찾아드려요'] },
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
                    className="group relative flex min-h-80 flex-col justify-center rounded-xl bg-white/55 px-7 pb-24 pt-12
                               text-center text-ink backdrop-blur-[14px] transition duration-150 hover:-translate-y-[3px] hover:bg-white/70 md:min-h-[480px]">
                <h2 className="text-[26px] font-extrabold tracking-[-.02em] md:text-[32px]">{m.title}</h2>
                <p className="mt-6 text-base leading-relaxed md:mt-11 md:text-xl">{m.desc[0]}<br />{m.desc[1]}</p>
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
