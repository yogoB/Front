// BE 는 항상 같은 오리진의 /api 로 부른다. 개발은 Vite 프록시(vite.config.js), 운영은 nginx 가 BE 로 넘긴다.
// 예전에는 localhost 에서 :8080 을 직접 불렀는데, 그러면 프록시를 건너뛰어 포트가 다르면 깨지고
// 쿠키도 교차 오리진이 된다. 별도 BE 주소가 꼭 필요하면 여기서 지정한다.
export const API_BASE_URL = '';
