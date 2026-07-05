import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends httpOnly refresh token cookie automatically
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach access token ─────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: refresh token on 401 ──────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (v: string) => void; reject: (e: any) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = original?.url ?? '';

    // Never try to refresh while handling the refresh endpoint itself.
    if (requestUrl.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // FE-02 fix: mark _retry so if refresh fails, these queued requests don't
        // re-enter the 401 handler and trigger another refresh attempt (infinite loop)
        original._retry = true;
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          // FE-01 fix: guard against undefined headers before setting Authorization
          if (!original.headers) {
            original.headers = {} as any;
          }
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post<{ data: { accessToken: string } }>('/auth/refresh');
        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        refreshQueue.forEach(({ reject }) => reject(refreshError));
        refreshQueue = [];
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Typed helper: unwrap { success: true, data: T } ─────────────────────────

export async function apiGet<T>(url: string, params?: Record<string, any>): Promise<T> {
  const res = await api.get<{ success: true; data: T }>(url, { params });
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: any): Promise<T> {
  const res = await api.post<{ success: true; data: T }>(url, body);
  return res.data.data;
}

export async function apiPut<T>(url: string, body?: any): Promise<T> {
  const res = await api.put<{ success: true; data: T }>(url, body);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: any): Promise<T> {
  const res = await api.patch<{ success: true; data: T }>(url, body);
  return res.data.data;
}

export async function apiDelete<T>(url: string, body?: any): Promise<T> {
  const res = await api.delete<{ success: true; data: T }>(url, body ? { data: body } : undefined);
  return res.data.data;
}

/** Upload FormData (multipart) */
export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const res = await api.post<{ success: true; data: T }>(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

/** Extract human-readable error message */
export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const errData = error.response?.data?.error;
    if (errData?.errors && Array.isArray(errData.errors) && errData.errors.length > 0) {
      return errData.errors[0];
    }
    return (
      errData?.message ||
      error.response?.data?.message ||
      error.message
    );
  }
  return 'An unexpected error occurred';
}
