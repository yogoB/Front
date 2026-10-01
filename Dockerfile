# 1) 빌드 — Vite 가 파일명에 해시를 넣는다.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) 서빙 — 정적 파일만 남긴다. node_modules 는 이미지에 들어가지 않는다.
FROM nginx:alpine
# 템플릿 자리에 두면 nginx 이미지가 기동 시 환경변수(EDGE_SHARED_SECRET, fly secret)를 채워 conf.d 로 쓴다.
# 정의된 환경변수만 바꾸므로 $uri 같은 nginx 변수는 그대로다.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
