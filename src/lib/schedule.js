import { won } from './model.js';

/* 전환 일정. 날짜 계산·내보내기는 화면과 무관한 순수 로직이라 여기 모은다 — 테스트가 붙는다. */

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const STEP_COLORS = ['#22b892', '#4f6bed', '#a855f7', '#6b7280']; // 준비·가입·구독 정리·완료

export const STEPS = [
  { when: '준비', title: '통신사 변경 준비', desc: '약정일·해지조건·명의서류를 체크합니다.' },
  { when: '가입', title: '추천 요금제 가입', desc: '통신사 공식 채널에서 번호이동 가입을 진행합니다.' },
  { when: '구독 정리', title: '구독 및 요금제 확인', desc: '가입 후 기존 구독을 해지·연동합니다.' },
  { when: '완료', title: '최종 납부액 체크', desc: '첫 청구서에서 정상 할인을 검증합니다.' },
];

/** 오늘 기준(약정 없음/이미 만료): 지금부터 순서대로 진행한다. */
export const EVENTS_FROM_TODAY = [
  { offset: 0, label: '전환 준비 시작', step: 0 },
  { offset: 3, label: '명의확인 서류 준비', step: 0 },
  { offset: 8, label: '구독 결제일 확인', step: 2 },
  { offset: 14, label: '추천 요금제 가입 진행', step: 1 },
  { offset: 21, label: '첫 청구서 확인', step: 3 },
];

/** 약정 만료일 기준: 만료 전에 준비를 끝내고 만료 당일에 옮긴다(위약금 없이). */
export const EVENTS_FROM_EXPIRY = [
  { offset: -14, label: '전환 준비 시작', step: 0 },
  { offset: -7, label: '명의확인 서류 준비', step: 0 },
  { offset: -3, label: '구독 결제일 확인', step: 2 },
  { offset: 0, label: '약정 만료 · 추천 요금제 가입', step: 1 },
  { offset: 30, label: '첫 청구서 확인', step: 3 },
];

/** 'YYYY-MM-DD' → 자정 Date. 형식이 아니거나 없는 날짜면 null. */
export function parseDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return null;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) ? date : null;
}

export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const dateOf = (anchor, offset) => { const d = new Date(anchor); d.setDate(anchor.getDate() + offset); return d; };
export const dayText = date => `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

/** 오늘로부터 며칠인지. 모든 날짜가 자정이라 하루 단위로 딱 떨어진다. */
export function relativeDay(date, today = startOfToday()) {
  const days = Math.round((date - today) / 86400000);
  return days === 0 ? '오늘' : days > 0 ? `${days}일 뒤` : `${-days}일 전`;
}

const pad = n => String(n).padStart(2, '0');
/** 종일 일정용 날짜. Google·ICS 모두 시작일과 '다음 날'(끝은 배타적)을 쓴다. */
export const dayStamp = date => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const nextDay = date => { const d = new Date(date); d.setDate(d.getDate() + 1); return d; };

/** 일정 설명. 결과 화면이 넘긴 실제 금액만 쓰고, 없으면 그 문장을 빼 버린다(지어내지 않는다).
    money=false 면 금액 줄을 뺀다 — Google 링크는 이 설명이 **질의문자열로 구글에 전달**되므로
    개인정보처리방침 4조("외부에 제공하지 않습니다")와 어긋나지 않게 금액을 싣지 않는다.
    금액까지 담고 싶은 사용자는 기기 안에서 끝나는 .ics 를 받는다. */
export function details(event, result, money = true) {
  const lines = [STEPS[event.step].desc, `추천: ${result?.planLabel ?? '추천 요금제'}`];
  if (money && result?.monthlyTotal != null) lines.push(`전환 후 예상 월 요금: ${won(result.monthlyTotal)}`);
  if (money && result?.monthlySavings > 0) lines.push(`정가 대비 월 ${won(result.monthlySavings)} 절감`);
  lines.push('요고비에서 만든 전환 일정입니다. 금액은 가입 전 통신사 공식 안내에서 확인해 주세요.');
  return lines.join('\n');
}

export function googleUrl(event, anchor, result) {
  const start = dateOf(anchor, event.offset);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[요고비] ${event.label}`,
    dates: `${dayStamp(start)}/${dayStamp(nextDay(start))}`,   // 종일 일정
    details: details(event, result, false),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// ICS 는 쉼표·세미콜론·역슬래시가 구분자다. 줄바꿈은 \n 으로 넣는다.
export const icsEscape = text => text.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');

/** 애플·아웃룩용. 한 파일에 일정을 모두 담는다. RFC 5545 는 CRLF 를 요구한다. */
export function icsText(events, anchor, result, today = startOfToday()) {
  const stamp = `${dayStamp(today)}T000000Z`;
  const body = events.flatMap((event, index) => {
    const start = dateOf(anchor, event.offset);
    return [
      'BEGIN:VEVENT',
      `UID:yogobi-step-${index}@yogob.fly.dev`,   // 날짜를 빼야 재가져오기가 '추가'가 아니라 '이동'이 된다
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dayStamp(start)}`,
      `DTEND;VALUE=DATE:${dayStamp(nextDay(start))}`,
      `SUMMARY:${icsEscape(`[요고비] ${event.label}`)}`,
      `DESCRIPTION:${icsEscape(details(event, result))}`,
      'END:VEVENT',
    ];
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yogobi//transfer-plan//KO',
    'CALSCALE:GREGORIAN', ...body, 'END:VCALENDAR'].join('\r\n');
}

/** 달력 격자. 앞뒤를 null 로 채워 7칸씩 끊는다. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
