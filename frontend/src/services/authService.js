import api from './api';

export async function register(payload) {
  const res = await api.post('/api/auth/register', payload);
  return res.data;
}

export async function login(payload) {
  const res = await api.post('/api/auth/login', payload);
  return res.data;
}

export async function me() {
  const res = await api.get('/api/auth/me');
  return res.data;
}
