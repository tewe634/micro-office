import axios from 'axios';
import { clearAuthState, isTokenExpired, useAuthStore } from '../store/auth';

const api = axios.create({ baseURL: '/api' });

const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
};

api.interceptors.request.use(cfg => {
  const token = useAuthStore.getState().token;
  if (!token) return cfg;

  if (isTokenExpired(token)) {
    clearAuthState();
    redirectToLogin();
    return Promise.reject(new axios.CanceledError('Token expired'));
  }

  cfg.headers = cfg.headers ?? {};
  cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      clearAuthState();
      redirectToLogin();
    }
    return Promise.reject(err);
  }
);

export default api;
