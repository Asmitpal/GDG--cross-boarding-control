import axios from 'axios';

const API_KEY = import.meta.env['VITE_API_KEY'] ?? 'dev-secret-key-change-in-prod';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key':    API_KEY,
  },
  timeout: 15_000,
});

// Response interceptor for global error normalisation
apiClient.interceptors.response.use(
  res => res,
  err => {
    const message =
      err?.response?.data?.message ??
      err?.response?.data?.error   ??
      err?.message                 ??
      'An unknown error occurred';
    return Promise.reject(new Error(message));
  },
);
