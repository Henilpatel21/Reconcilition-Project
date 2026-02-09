import api from './api';

export async function getTransactions() {
  const res = await api.get('/transactions');
  return res.data;
}

export async function generateMock(count = 20) {
  const res = await api.post('/transactions/generate-mock', { count });
  return res.data;
}

export async function downloadTransactionsCSV() {
  const res = await api.get('/transactions/download', { responseType: 'blob' });
  return res.data;
}

export async function uploadTransactionsCSV(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/transactions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
}

export async function deleteAllTransactions() {
  const res = await api.delete('/transactions');
  return res.data;
}
