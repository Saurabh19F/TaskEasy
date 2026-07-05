import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

const PLATFORM_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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

platformApiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = original?.url ?? '';

    if (requestUrl.includes('/platform/auth/refresh')) {
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
