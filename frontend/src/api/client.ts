import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || '';
    const isGitHubEndpoint = url.includes('/github/');
    if (error.response?.status === 401 && !isGitHubEndpoint) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    if (error.response?.status === 503 && error.response?.data?.code === 'SETUP_REQUIRED') {
      if (!window.location.pathname.startsWith('/setup')) {
        window.location.href = '/setup';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
