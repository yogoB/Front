# 1) 빌드 — Vite 가 파일명에 해시를 넣는다.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) 서빙 — 정적 파일만 남긴다. node_modules 는 이미지에 들어가지 않는다.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
