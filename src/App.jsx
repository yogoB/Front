import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import DataSources from './pages/DataSources.jsx';
import Light from './pages/Light.jsx';
import Results from './pages/Results.jsx';
import Modes from './pages/Modes.jsx';
import Login from './pages/Login.jsx';
import Detail from './pages/Detail.jsx';
import Calendar from './pages/Calendar.jsx';
import MyPage from './pages/MyPage.jsx';
import Admin from './pages/Admin.jsx';
import ReportFab from './components/ReportFab.jsx';

/* 경로는 확장자를 뗀다(/results.html → /results). nginx 가 SPA 폴백을 한다.
   백오피스도 이 앱의 라우트다(/admin, D-39) — 데이터는 전부 /api/v1/admin/** 인증이 필요하다.
   옛 .html 주소로 들어온 링크는 버리지 않고 새 경로로 보낸다. */
const LEGACY = {
  '/index.html': '/', '/terms.html': '/terms', '/privacy.html': '/privacy',
  '/data-sources.html': '/data-sources', '/results.html': '/results',
  '/calendar.html': '/calendar', '/light.html': '/light', '/detail.html': '/detail',
  '/login.html': '/login', '/mypage.html': '/mypage', '/account.html': '/mypage',
  '/admin.html': '/admin',
};

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/data-sources" element={<DataSources />} />
      <Route path="/light" element={<Light />} />
      <Route path="/results" element={<Results />} />
      <Route path="/modes" element={<Modes />} />
      <Route path="/login" element={<Login />} />
      <Route path="/detail" element={<Detail />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="/admin" element={<Admin />} />
      {Object.entries(LEGACY).map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {/* 사용자 화면에 뜨는 오류 제보 버튼(D-41). 라우트 밖에 두어 화면이 바뀌어도 그대로 있다.
        백오피스에는 띄우지 않는다 — 운영자는 제보를 받는 쪽이고, 다크 화면 위에 민트 버튼이 떠 있으면 남의 화면처럼 보인다. */}
    {pathname !== '/admin' && <ReportFab />}
    </>
  );
}
