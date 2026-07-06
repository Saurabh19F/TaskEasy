import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { getApiBaseUrl } from './runtime-config';

const PLATFORM_API_URL = getApiBaseUrl();

type RetryAwareConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

function shouldSkipPlatformAuthRefresh(config: RetryAwareConfig, requestUrl: string) {
  const headerValue = (config.headers as any)?.['x-skip-auth-refresh'] ??
    (config.headers as any)?.get?.('x-skip-auth-refresh');
  return (
    String(headerValue) === '1' ||
    config.skipAuthRefresh === true ||
    shouldSkipPlatformRefreshRetry(requestUrl)
  );
}

export const platformApiClient: AxiosInstance = axios.create({
  baseURL: PLATFORM_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

platformApiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = usePlatformAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = false;
let queue: Array<{ resolve: (v: string) => void; reject: (e: any) => void }> = [];

function shouldSkipPlatformRefreshRetry(requestUrl: string) {
  return (
    requestUrl.includes('platform/auth/login') ||
    requestUrl.includes('platform/auth/refresh') ||
    requestUrl.includes('platform/auth/change-password')
  );
}

platformApiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryAwareConfig;
    const requestUrl = original?.url ?? '';

    if (shouldSkipPlatformAuthRefresh(original, requestUrl)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return platformApiClient(original);
        });
      }

      original._retry = true;
      refreshing = true;

      try {
        const { data } = await platformApiClient.post<{ data: { accessToken: string } }>('/platform/auth/refresh');
        const token = data.data.accessToken;
        usePlatformAuthStore.getState().setAccessToken(token);
        queue.forEach(({ resolve }) => resolve(token));
        queue = [];
        original.headers.Authorization = `Bearer ${token}`;
        return platformApiClient(original);
      } catch (refreshError) {
        queue.forEach(({ reject }) => reject(refreshError));
        queue = [];
        usePlatformAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/platform/login';
        }
        return Promise.reject(refreshError);
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export async function platformGet<T>(url: string, params?: Record<string, any>): Promise<T> {
  const res = await platformApiClient.get<{ success: true; data: T }>(url, { params });
  return res.data.data;
}

export async function platformPost<T>(url: string, body?: any): Promise<T> {
  const res = await platformApiClient.post<{ success: true; data: T }>(url, body);
  return res.data.data;
}

export async function platformPatch<T>(url: string, body?: any): Promise<T> {
  const res = await platformApiClient.patch<{ success: true; data: T }>(url, body);
  return res.data.data;
}

export async function platformDelete<T>(url: string): Promise<T> {
  const res = await platformApiClient.delete<{ success: true; data: T }>(url);
  return res.data.data;
}

export function getPlatformApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message
    );
  }
  return 'An unexpected error occurred';
}
