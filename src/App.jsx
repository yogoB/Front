import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import DataSources from './pages/DataSources.jsx';
import Light from './pages/Light.jsx';

/* 경로는 확장자를 뗀다(/results.html → /results). nginx 가 SPA 폴백을 하고,
   백오피스(/admin.html)는 그 앞의 별도 location 이 BE 로 프록시한다.
   옛 .html 주소로 들어온 링크는 버리지 않고 새 경로로 보낸다. */
const LEGACY = {
  '/index.html': '/', '/terms.html': '/terms', '/privacy.html': '/privacy',
  '/data-sources.html': '/data-sources', '/results.html': '/results',
  '/calendar.html': '/calendar', '/light.html': '/light', '/detail.html': '/detail',
  '/login.html': '/login', '/mypage.html': '/mypage', '/account.html': '/mypage',
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/data-sources" element={<DataSources />} />
      <Route path="/light" element={<Light />} />
      {Object.entries(LEGACY).map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
