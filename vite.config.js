import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 개발 서버에서도 BE 를 같은 오리진으로 본다 — 운영의 nginx 프록시와 같은 모양이라
// 쿠키·CSRF 동작이 로컬과 운영에서 갈라지지 않는다.
// 기본은 로컬 BE. 운영 데이터로 확인할 때만 API_TARGET 으로 바꾼다.
//   API_TARGET=https://yogob-api.fly.dev npm run dev
// 운영은 Secure 쿠키라 http://localhost 에서는 로그인 세션이 붙지 않는다 — 공개 경로 확인용이다.
const target = process.env.API_TARGET || 'http://127.0.0.1:8080';
const proxy = { target, changeOrigin: target.startsWith('https'), secure: true };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: { '/api': proxy, '/oauth2': proxy, '/login/oauth2': proxy },
  },
});
