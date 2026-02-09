import api from './api';

export async function uploadSettlement(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/settlements/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function downloadSettlementCsv() {
  const res = await api.get('/settlements/download', { responseType: 'blob' });
  return res.data;
}

export async function getSettlements() {
  const res = await api.get('/settlements');
  return res.data;
}

export async function deleteAllSettlements() {
  const res = await api.delete('/settlements');
  return res.data;
}
