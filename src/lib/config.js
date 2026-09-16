// Production: serve /api and /oauth2 through the same site, or set an explicit BE origin here.
const hostname = globalThis.location?.hostname;
export const API_BASE_URL = ['localhost', '127.0.0.1'].includes(hostname)
  ? `http://${hostname}:8080` : '';
