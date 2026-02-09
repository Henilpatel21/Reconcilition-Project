import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Suppress 404 errors in console (expected when no data exists yet)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Still reject the promise, but 404 is expected and logged by the component
    if (error.response?.status === 404) {
      // Don't log 404 to console - it's expected when no data exists
      return Promise.reject(error);
    }
    // Log other errors normally
    return Promise.reject(error);
  }
);

export default api;
