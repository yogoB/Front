import { Link } from 'react-router-dom';
import { Header, Footer } from '../components/Layout.jsx';
import PolicyNav from '../components/PolicyNav.jsx';

/* 데이터 출처. 원문은 data-sources.html 에서 옮겨 왔고, 2026-09-21 에 사용자 지시로 한 번 손봤다.
   **지키는 선**: 어떤 종류의 정보를 쓰는지(사업자 공개 정보)와 어떻게 관리하는지는 적되,
   개별 수집 경로·외부 API·사업자별 채널은 적지 않는다. 화면이 숫자를 만들지 않는 규칙도 그대로라
   카탈로그 건수 같은 수치는 넣지 않는다 — 시간이 지나면 거짓이 되고, 화면은 그 수를 모른다. */
export default function DataSources() {
  return (
    <>
      <Header />
      <main className="policy">
        <PolicyNav />
        <h1>데이터 출처</h1>
        <p className="updated">최종 업데이트: 2026년 9월 21일</p>
        <p className="note">요고비의 추천과 절감액이 <strong>어떤 데이터를 근거로 계산되는지</strong> 투명하게 설명합니다.</p>

        <article>
          <h2>1. 무엇을 기준으로 계산하나요</h2>
          <p>요금제·구독 가격은 각 <strong>통신사·구독 사업자가 공개한 정보</strong>를 기준으로 합니다. 팀이 그 값을 확인·검수해 <strong>스냅샷(정리된 표)</strong>으로 만들고, 계산은 이 스냅샷만 사용합니다. 검수를 거치지 않은 값은 추천·최저가·알림 계산에 쓰지 않습니다.</p>

          <h2>2. 데이터는 어떻게 관리하나요</h2>
          <ul>
            <li>값을 넣고 고치는 절차는 <strong>내부 기준에 따라 운영</strong>합니다. 근거를 확인한 값만 반영하고, 언제 무엇이 바뀌었는지 기록을 남깁니다.</li>
            <li>반영된 값은 <strong>상시 점검</strong>합니다. 단위가 어긋나거나 다른 값과 크게 벌어지는 항목은 자동으로 걸러 내 다시 확인합니다.</li>
            <li>개별 수집 경로와 사업자별 확인 채널은 <strong>공개하지 않습니다.</strong> 어떤 종류의 정보를 쓰는지와 어떻게 검수하는지는 이 문서로 밝히고, 그 밖의 운영 세부는 서비스 운영상 비공개로 둡니다.</li>
          </ul>

          <h2>3. 언제 기준의 데이터인가요</h2>
          <ul>
            <li>요고비는 요청을 처리할 때 <strong>그 자리에서 외부 사이트를 읽어 오지 않습니다.</strong> 미리 정리해 둔 스냅샷을 사용합니다.</li>
            <li>따라서 <strong>최신 프로모션·요금 변경이 아직 반영되지 않았을 수 있습니다.</strong> 실제 가입 가능한 요금·자격·제휴는 각 사업자 공식 홈페이지에서 확인해 주세요.</li>
            <li>해외에서 결제하는 구독은 <strong>정해진 시점의 환율</strong>로 환산한 참고 값을 함께 보여 주며, 결제일 환율에 따라 실제 금액은 달라집니다.</li>
          </ul>

          <h2>4. 금액의 출처를 함께 보여줍니다</h2>
          <p>결과의 각 금액에는 어디서 나온 값인지 <strong>출처(Provenance)</strong>를 표시합니다.</p>
          <ul>
            <li><strong>공식 가격</strong> — 사업자가 공개한 정가</li>
            <li><strong>계산값</strong> — 할인·조합을 반영해 요고비가 계산한 값</li>
            <li><strong>사용자 입력</strong> — 이용자가 직접 적은 금액</li>
            <li><strong>추정값</strong> — 정보가 부족해 서비스가 채운 참고 값</li>
          </ul>

          <h2>5. 미사용 혜택은 0원</h2>
          <p>이용자가 원하지 않는 서비스의 제휴 혜택(예: 관심 없는 구독 무료 제공)은 <strong>계산에도 추천 근거에도 반영하지 않습니다.</strong> 실제로 이용할 서비스만 절감 근거로 삼습니다.</p>

          <h2>6. 틀린 값을 발견하셨다면</h2>
          <p>화면 오른쪽 아래 <strong>오류 제보</strong>로 알려 주세요. 어떤 항목의 금액이 실제와 다른지, 공식 페이지 주소를 함께 적어 주시면 확인 후 반영합니다. 제보하신 내용은 검수 절차를 거쳐 처리되며, 반영 여부와 무관하게 기록으로 남깁니다.</p>

          <h2>7. 정확성 안내</h2>
          <p>요고비는 정보 제공을 목적으로 하며, 데이터의 정확성·최신성을 완전히 보장하지 않습니다. 중요한 결정 전에는 공식 출처에서 최종 확인을 권장합니다. 서비스 성격은 <Link to="/terms">이용약관</Link>에서 확인할 수 있습니다.</p>

          <Link className="btn btn-ghost mt-9 inline-block" to="/">← 홈으로</Link>
        </article>
      </main>
      <div className="mx-auto max-w-page px-6"><Footer /></div>
    </>
  );
}
