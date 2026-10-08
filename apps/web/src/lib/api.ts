import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearUserQueries } from "./queryClient";
import { getClientStore } from "@/store/store";
import { clearAuth } from "@/store/slices/authSlice";

export interface ApiFieldError {
  message: string;
  code?: string;
  path?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  errors?: ApiFieldError[];
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface QueueItem {
  resolve: () => void;
  reject: (error: unknown) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
});

const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

const processQueue = (error: unknown | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

const AUTH_ROUTES = [
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
  "/auth/me/password",
];

const isAuthRoute = (url?: string): boolean =>
  !!url && AUTH_ROUTES.some((route) => url.includes(route));

API.interceptors.response.use(
  (response) => response,
  async (
    error: AxiosError<{
      status?: string;
      message?: string;
      code?: string;
      errors?: ApiFieldError[];
    }>,
  ) => {
    if (!error.response) {
      return Promise.reject<ApiError>({
        status: 0,
        message: "Network error. Please check your internet connection.",
      });
    }

    const { status, data } = error.response;
    const config = error.config as RetryableRequestConfig | undefined;

    const shouldAttemptRefresh =
      status === 401 && config && !isAuthRoute(config.url) && !config._retry;

    if (shouldAttemptRefresh) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => API(config));
      }

      config._retry = true;
      isRefreshing = true;

      try {
        await refreshClient.get("/auth/refresh");
        processQueue(null);
        return API(config);
      } catch (refreshError) {
        processQueue(refreshError);
        const store = getClientStore();
        if (store) {
          store.dispatch(clearAuth());
        }
        clearUserQueries();
        return Promise.reject<ApiError>({
          status: 401,
          message: "Session expired. Please log in again.",
        });
      } finally {
        isRefreshing = false;
      }
    }

    const firstError = data?.errors?.[0];
    const message =
      firstError?.message || data?.message || "Something went wrong.";
    const code = firstError?.code || data?.code;

    return Promise.reject<ApiError>({
      status,
      message,
      code: code ? String(code) : undefined,
      errors: data?.errors,
    });
  },
);

export default API;
