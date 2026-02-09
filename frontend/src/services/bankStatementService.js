import api from './api';

export async function generateMockBankStatements() {
  const res = await api.post('/bank-statements/generate-mock');
  return res.data;
}

export async function getBankStatements() {
  const res = await api.get('/bank-statements');
  return res.data;
}

export async function downloadBankStatementsCSV() {
  const res = await api.get('/bank-statements/download', { responseType: 'blob' });
  return res.data;
}

export async function uploadBankStatementsCSV(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/bank-statements/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
}

export async function deleteAllBankStatements() {
  const res = await api.delete('/bank-statements');
  return res.data;
}
