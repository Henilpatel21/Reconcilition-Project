import api from './api';

export async function runReconcile() {
  const res = await api.post('/reconcile');
  return res.data;
}

export async function getMismatches(showAll = false) {
  const res = await api.get('/reconcile/mismatches', { params: { showAll } });
  return res.data;
}

export async function getSummary() {
  const res = await api.get('/reconcile/summary');
  return res.data;
}

export async function downloadResults() {
  const res = await api.get('/reconcile/download', { responseType: 'blob' });
  return res.data;
}

export async function getHistory(limit = 5, offset = 0) {
  // Use audit logs (action=reconcile.run) as the source of truth for run history
  const res = await api.get('/audit/logs', { params: { action: 'reconcile.run', limit, offset } });
  return res.data;
}

export async function deleteSummary(id) {
  const res = await api.delete(`/audit/${id}`);
  return res.data;
}
