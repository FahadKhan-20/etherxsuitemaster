import axios from 'axios';
import { clearAuthSession, getAuthToken } from './auth';
import { ROUTES } from './constants';
import { apiBase } from './apiBase';

const apiClient = axios.create({
  baseURL: apiBase(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

// A rejected sign-in token (expired, or from an account that no longer exists) ends the session.
apiClient.interceptors.response.use(undefined, (error) => {
  if (error?.response?.status === 401 && error.config?.headers?.Authorization) {
    clearAuthSession();
    if (window.location.pathname !== ROUTES.LOGIN) window.location.assign(ROUTES.LOGIN);
  }
  return Promise.reject(error);
});

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

export default apiClient;
