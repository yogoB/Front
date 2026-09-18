import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';

/* 라이트를 "정확도가 떨어진다"고 적지 않는다 — 디테일 미선택자를 불완전으로 표현하지 않는 것이 정책이다
   (UX_POLICY §2). 카드는 **무엇을 묻고 무엇을 돌려주는지** 두 줄로만 말한다(규칙 9: 진행을 의미화).
   라이트에만 질문 수를 적는다 — 세 개가 사실이고 부담이 적다는 것이 이 모드의 강점이다.
   디테일은 조건에 따라 질문이 늘어(약정 종료일·결합 회선 수) 숫자를 못 박으면 거짓이 되므로 무엇을 더 묻는지로 적는다. */
const MODES = [
  {
    to: '/light', title: '라이트모드', pick: true,
    asks: '데이터·통신비·구독, 세 가지만 물어요',
    gets: '지금보다 얼마나 줄일 수 있는지 바로 보여드려요',
  },
  {
    to: '/detail', title: '디테일모드',
    asks: '통신사·약정·가족결합까지 물어요',
    gets: '지금 쓰는 요금제와 나란히 비교하고 갈아탈 시점까지 잡아드려요',
  },
];

/* 시안: 민트 바탕을 화면 끝까지, 유리 카드 두 장. 동전·돋보기는 장식이라 aria-hidden 이고 좁은 화면에서는 뺀다. */
export default function Modes() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      {/* 배경(민트 바탕·동전·돋보기)은 그대로 두고, 그 위 내용만 세로 가운데로 모아 아래 빈 공간을 없앤다. */}
      <main className="relative flex min-h-[calc(100vh-66px)] flex-col justify-center overflow-hidden bg-brand px-6 py-14 text-center text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
          <Coin className="-left-20 top-10 size-[260px] text-[120px]" />
          <Coin className="-right-10 top-24 size-[200px] text-[90px]" />
          <Coin className="-bottom-40 left-[45%] size-[300px] text-[140px]" />
          <span className="absolute right-[6%] top-1/4 -rotate-[20deg] text-[300px] leading-none drop-shadow-[0_30px_40px_rgba(0,0,0,.25)]">🔍</span>
        </div>

        <div className="relative mx-auto max-w-[1200px]">
          {/* 뒤로 가는 길은 왼쪽 위에 둔다 — 가운데 정렬된 제목과 섞이면 내비게이션으로 읽히지 않는다. */}
          <div className="text-left">
            <button type="button" onClick={() => navigate('/')} className="btn-text -ml-2 text-white/85 hover:text-white">
              ← 처음으로
            </button>
          </div>
          <h1 className="text-[28px] font-extrabold leading-[1.5] tracking-[-.02em] md:text-[40px]">
            나의 <Chip>데이터사용량</Chip> <Chip>통신비</Chip> <Chip>구독서비스</Chip> 를 분석해서<br />
            얼마나 절감할 수 있을지 바로 알려드려요!
          </h1>
          {/* 요고비가 하나를 민다(UX 정책 규칙 2) — 라이트를 기본 경로로 두고 카드 무게를 다르게 준다.
              디테일을 고르는 길은 여기서도, 라이트 결과의 '더 정확한 절감받기'에서도 열려 있다. */}
          <div className="mx-auto mt-12 grid max-w-[920px] gap-5 text-left md:grid-cols-2">
            {MODES.map(m => (
              <Link key={m.to} to={m.to}
                    className={`group relative flex flex-col gap-3 rounded-2xl p-7 text-ink backdrop-blur-[14px]
                                transition duration-150 hover:-translate-y-[3px] focus-visible:outline-ink md:p-9
                                ${m.pick ? 'bg-white shadow-[0_18px_40px_rgba(20,20,43,.18)] hover:bg-white'
                                         : 'bg-white/60 hover:bg-white/75'}`}>
                <span className="flex items-center gap-2">
                  <h2 className="text-[24px] font-extrabold tracking-[-.02em] md:text-[28px]">{m.title}</h2>
                  {m.pick && <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">추천</span>}
                </span>
                {/* 묻는 것 → 돌려주는 것. 라벨을 붙이지 않고 무게로 구분한다. */}
                <p className="text-[15px] leading-relaxed text-ink-soft">{m.asks}</p>
                <p className="text-[15px] font-bold leading-relaxed md:text-base">{m.gets}</p>
                {/* mt-auto: 두 카드의 글 길이가 달라도 화살표는 같은 선에서 끝난다. */}
                <span aria-hidden="true"
                      className={`mt-auto grid size-11 place-items-center rounded-full text-xl transition-colors duration-150
                                  ${m.pick ? 'bg-ink text-white' : 'bg-white/80 text-ink group-hover:bg-ink group-hover:text-white'}`}>
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
