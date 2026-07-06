const DEFAULT_PROD_API_URL = 'https://taskeasy-api.onrender.com/api';
const DEFAULT_DEV_API_URL = 'http://localhost:5000/api';

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production'
    ? DEFAULT_PROD_API_URL
    : DEFAULT_DEV_API_URL);
}

export function getWsBaseUrl() {
  return getApiBaseUrl().replace(/\/api$/, '');
}
