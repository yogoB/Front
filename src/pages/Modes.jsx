import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout.jsx';

const MODES = [
  { to: '/light', title: '라이트모드', desc: ['3개의 질문으로 분석해드려요!', '단 정확도는 조금 떨어질 수 있어요'], tone: 'brand' },
  { to: '/detail', title: '디테일모드', desc: ['통신사·약정·희망 조건까지 넣어', '더 정확한 조합을 찾아드려요'], tone: 'detail' },
];

export default function Modes() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[900px] px-6 py-12 text-center">
        <button type="button" onClick={() => navigate('/')}
                className="mb-2 block w-fit cursor-pointer border-0 bg-transparent text-sm text-muted">
          ← 처음으로
        </button>
        <h1 className="text-[30px] font-extrabold leading-[1.4] tracking-[-.01em]">
          나의 <Chip>데이터사용량</Chip> <Chip>통신비</Chip> <Chip>구독서비스</Chip> 를 분석해서<br />
          얼마나 절감할 수 있을지 바로 알려드려요!
        </h1>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {MODES.map(m => (
            <Link key={m.to} to={m.to}
                  className="group flex min-h-[220px] flex-col rounded-[20px] border border-line bg-white p-7
                             text-left shadow-card transition hover:-translate-y-[3px] hover:border-[#d9d9e2]">
              <h2 className="text-2xl font-extrabold">{m.title}</h2>
              <p className="mt-2.5 text-muted">{m.desc[0]}<br />{m.desc[1]}</p>
              <span aria-hidden="true"
                    className={`mt-auto grid size-11 place-items-center self-end rounded-full border border-line text-xl
                      ${m.tone === 'brand'
                        ? 'group-hover:border-brand group-hover:bg-brand group-hover:text-white'
                        : 'group-hover:border-detail group-hover:bg-detail group-hover:text-white'}`}>
                →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

const Chip = ({ children }) => (
  <span className="mx-0.5 inline-block rounded-full bg-[#f0f1f5] px-3 py-0.5 align-middle text-[.78em] font-bold text-ink-soft">
    {children}
  </span>
);
