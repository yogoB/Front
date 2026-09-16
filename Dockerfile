FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html

# 자산 URL에 빌드 버전을 붙인다. 토큰은 내용에서 계산하므로 손으로 올릴 일이 없고,
# 내용이 그대로면 토큰도 그대로라 불필요한 재다운로드가 없다.
# HTML 의 <link>/<script> 뿐 아니라 JS 의 import 경로도 함께 바꾼다 —
# ES 모듈은 각자 URL 로 캐시되므로 진입점에만 붙이면 api.js 같은 하위 모듈이 옛 캐시에 남는다.
RUN cd /usr/share/nginx/html \
 && V=$(cat *.html src/*.js src/*.css | md5sum | cut -c1-8) \
 && sed -E -i "s#(\"\./(src|assets)/[A-Za-z0-9_-]+\.(css|js))\"#\1?v=$V\"#g" *.html \
 && sed -E -i "s#(from '\./[A-Za-z0-9_-]+\.js)'#\1?v=$V'#g" src/*.js \
 && echo "asset version = $V"
