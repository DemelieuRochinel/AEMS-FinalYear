//  AXIOS CONFIGURATION
//  Base HTTP client for all API calls to AEMS backend
//  Automatically attaches JWT token to every request
//

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // so here is meaning 10s
  headers: {
    'Content-Type': 'application/json',
  },
});

//Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('aems_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle token expiry─
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — clear storage and redirect to login
      localStorage.removeItem('aems_token');
      localStorage.removeItem('aems_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;