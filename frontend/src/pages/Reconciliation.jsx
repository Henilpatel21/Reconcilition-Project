import React, { useEffect, useState, useContext } from 'react';
import { runReconcile, getMismatches, downloadResults } from '../services/reconcileService';
import { uploadTransactionsCSV } from '../services/transactionService';
import { uploadBankStatementsCSV } from '../services/bankStatementService';
import { ToastContext } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

export default function Reconciliation(){
  const [summary, setSummary] = useState(null);
  const [mismatches, setMismatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [source1File, setSource1File] = useState(null);
  const [source2File, setSource2File] = useState(null);
  const toast = useContext(ToastContext);

  const { user } = useContext(AuthContext);

  // loadMismatches optionally accepts a showAll override so UI can request immediately
  const loadMismatches = async (showAllOverride) => {
    setLoading(true);
    // If not authenticated, skip calling protected API
    if (!user && !localStorage.getItem('token')) {
      setMismatches([]);
      setLoading(false);
      return;
    }
    try {
      const flag = typeof showAllOverride !== 'undefined' ? showAllOverride : showAll;
      const res = await getMismatches(flag);
      setMismatches(res.items || []);
    } catch (err) {
      // If there are simply no reconciliation results yet, don't show an error toast
      const status = err?.response?.status;
      if (status === 404) {
        setMismatches([]);
      } else if (status === 401) {
        // Unauthorized — likely no token: show friendly message
        toast.show('Please log in to view reconciliation results', 'warning');
      } else {
        toast.show('Failed to load reconciliation results', 'danger');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    // Only attempt to load mismatches if user is authenticated
    if (user || localStorage.getItem('token')) loadMismatches();
  }, [showAll, user]);

  const handleUploadSource1 = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadTransactionsCSV(file);
      let msg = `Source 1 uploaded: ${res.created} transactions created`;
      if (res.duplicates) msg += `, ${res.duplicates} duplicates skipped`;
      if (res.rejectedRows?.length > 0) {
        const rejectSummary = res.rejectedRows.slice(0, 3).map(r => `Row ${r.rowNumber}: ${r.reason}`).join('; ');
        msg += `\nRejected ${res.rejectedRows.length} rows. Examples: ${rejectSummary}`;
        toast.show(msg, 'warning');
      } else {
        toast.show(msg, 'success');
      }
      setSource1File(file.name);
    } catch (err) {
      const errMsg = err?.response?.data?.message || 'Failed to upload Source 1';
      toast.show(errMsg, 'danger');
      console.error('Upload error:', err);
    }
    setLoading(false);
  };

  const handleUploadSource2 = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadBankStatementsCSV(file);
      let msg = `Source 2 uploaded: ${res.created} bank statements created`;
      if (res.duplicates) msg += `, ${res.duplicates} duplicates skipped`;
      if (res.rejectedRows?.length > 0) {
        const rejectSummary = res.rejectedRows.slice(0, 3).map(r => `Row ${r.rowNumber}: ${r.reason}`).join('; ');
        msg += `\nRejected ${res.rejectedRows.length} rows. Examples: ${rejectSummary}`;
        toast.show(msg, 'warning');
      } else {
        toast.show(msg, 'success');
      }
      setSource2File(file.name);
    } catch (err) {
      const errMsg = err?.response?.data?.message || 'Failed to upload Source 2';
      toast.show(errMsg, 'danger');
      console.error('Upload error:', err);
    }
    setLoading(false);
  };

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await runReconcile();
      setSummary(res.summary);
      // Notify other tabs/pages that a reconciliation run completed
      try { localStorage.setItem('reconcile_updated_at', String(Date.now())); } catch (e) { /* ignore in private modes */ }
      toast.show(`Reconciliation completed: ${res.matched_count} matched, ${res.partial_count} partial, ${res.unmatched_count} unmatched`, 'success');
      await loadMismatches();
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to run reconciliation';
      toast.show(errMsg, 'danger');
      console.error('Reconciliation error:', err);
    }
    setLoading(false);
  };

  const handleDownload = async () => {
    try {
      const blob = await downloadResults();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reconciliation_results.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.show('Results downloaded', 'success');
    } catch (err) {
      toast.show('Failed to download results', 'danger');
    }
  };

  const getStatusColor = (status) => {
    // Using vibrant modern colors
    switch (status) {
      case 'matched':
        return '#00ff88'; // neon green
      case 'partial':
        return '#ff1493'; // hot pink
      case 'unmatched':
        return '#ff4757'; // vibrant red
      case 'duplicate':
        return '#b366ff'; // vibrant purple
      case 'review':
        return '#ffa500'; // orange
      default:
        return '#00d9ff'; // cyan
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset everything? This will delete all uploaded files and reconciliation results.')) return;
    setLoading(true);
    try {
      // Use api service which automatically includes token
      const responses = await Promise.all([
        api.delete('/transactions').catch(err => ({ status: err.response?.status || 0, ok: false, error: err.message })),
        api.delete('/bank-statements').catch(err => ({ status: err.response?.status || 0, ok: false, error: err.message })),
        api.delete('/reconcile/all').catch(err => ({ status: err.response?.status || 0, ok: false, error: err.message }))
      ]);
      
      // Log response status for debugging
      console.log('Delete responses:', responses.map((r, i) => ({ index: i, status: r.status, ok: r.ok, error: r.error })));
      
      // Check if all requests were successful
      const allSuccess = responses.every(r => r.status === 200 || r.status === 204);
      if (!allSuccess) {
        const failedOps = responses
          .map((r, i) => r.ok !== false ? null : `Op ${i}: ${r.status} ${r.error || ''}`)
          .filter(x => x)
          .join(', ');
        throw new Error(`Delete failed: ${failedOps}`);
      }
      
      // Clear UI state after successful deletion
      setSummary(null);
      setMismatches([]);
      setSource1File(null);
      setSource2File(null);
      setShowAll(false);
      
      toast.show('All data reset successfully', 'success');
    } catch (err) {
      console.error('Reset error details:', err.message);
      toast.show(`Failed to reset: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* FILE UPLOAD SECTION */}
      <div className="card" style={{ marginBottom: 30 }}>
        <h3 style={{ marginBottom: 20, borderBottom: '2px solid #00d9ff', paddingBottom: 10, color: '#00d9ff' }}>
          <span style={{ fontSize: 20, marginRight: 8 }}>◆</span>Upload CSV Files for Reconciliation
        </h3>
        <p style={{ fontSize: 13, color: '#9db4d4', marginBottom: 20 }}>
          Upload your downloaded CSV files from both sources. The system will match transactions with bank statements.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* SOURCE 1 UPLOAD */}
          <div style={{ padding: 15, background: 'rgba(0, 217, 255, 0.08)', borderRadius: 8, border: '2px solid #00ff88' }}>
            <h4 style={{ marginBottom: 15, color: '#00ff88' }}>Source 1: Internal Transactions</h4>
            <div style={{ marginBottom: 15 }}>
              <label htmlFor="file1" style={{ display: 'block', fontSize: 12, color: '#9db4d4', marginBottom: 8 }}>
                Select CSV file (transactions.csv)
              </label>
              <input
                id="file1"
                type="file"
                accept=".csv"
                onChange={(e) => handleUploadSource1(e.target.files[0])}
                disabled={loading}
                style={{ width: '100%', padding: 8, border: '1px solid #00d9ff', borderRadius: 4, background: '#1a1f35', color: '#fff' }}
              />
            </div>
            {source1File && (
              <div style={{ padding: 10, background: 'rgba(0, 255, 136, 0.15)', borderRadius: 4, fontSize: 12, color: '#00ff88', fontWeight: '600' }}>
                <span style={{ fontSize: 16, marginRight: 5 }}>✓</span>{source1File}
              </div>
            )}
          </div>

          {/* SOURCE 2 UPLOAD */}
          <div style={{ padding: 15, background: 'rgba(0, 217, 255, 0.08)', borderRadius: 8, border: '2px solid #00d9ff' }}>
            <h4 style={{ marginBottom: 15, color: '#00d9ff' }}>Source 2: Bank Statements</h4>
            <div style={{ marginBottom: 15 }}>
              <label htmlFor="file2" style={{ display: 'block', fontSize: 12, color: '#9db4d4', marginBottom: 8 }}>
                Select CSV file (bank_statements.csv)
              </label>
              <input
                id="file2"
                type="file"
                accept=".csv"
                onChange={(e) => handleUploadSource2(e.target.files[0])}
                disabled={loading}
                style={{ width: '100%', padding: 8, border: '1px solid #00d9ff', borderRadius: 4, background: '#1a1f35', color: '#fff' }}
              />
            </div>
            {source2File && (
              <div style={{ padding: 10, background: 'rgba(0, 217, 255, 0.15)', borderRadius: 4, fontSize: 12, color: '#00d9ff', fontWeight: '600' }}>
                <span style={{ fontSize: 16, marginRight: 5 }}>✓</span>{source2File}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECONCILIATION CONTROLS */}
      <div className="card" style={{ marginBottom: 30 }}>
        <h3 style={{ marginBottom: 15, color: '#00d9ff' }}><span style={{ fontSize: 18, marginRight: 8 }}>↰</span>Run Reconciliation</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={handleRun} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Processing...' : 'Run Reconciliation'}
          </button>
          <button className="btn" onClick={handleDownload} style={{ flex: 1, background: 'linear-gradient(135deg, #ffa500, #ff6b00)' }}>
            <span style={{ fontSize: 18, marginRight: 5 }}>↙</span>Download Results
          </button>
          <button className="btn" onClick={handleReset} disabled={loading} style={{ flex: 1, background: 'linear-gradient(135deg, #ff4757, #ff1744)' }}>
            <span style={{ fontSize: 18, marginRight: 5 }}>↰</span>Reset All
          </button>
        </div>
      </div>

      {/* SUMMARY SECTION */}
      {summary && (
        <div className="card" style={{ marginBottom: 30 }}>
          <h4 style={{ color: '#00d9ff', marginBottom: 20 }}><span style={{ fontSize: 18, marginRight: 8 }}>◆</span>Reconciliation Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, marginTop: 15 }}>
            <div style={{ padding: 15, background: 'rgba(0, 255, 136, 0.15)', borderRadius: 8, borderLeft: '4px solid #00ff88' }}>
              <div style={{ fontSize: 12, color: '#9db4d4' }}><span style={{ fontSize: 14, marginRight: 5 }}>✓</span>Matched</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#00ff88', marginTop: 8 }}>{summary.matched}</div>
              <div style={{ fontSize: 11, color: '#9db4d4', marginTop: 4 }}>Perfect match</div>
            </div>
            <div style={{ padding: 15, background: 'rgba(255, 20, 147, 0.15)', borderRadius: 8, borderLeft: '4px solid #ff1493' }}>
              <div style={{ fontSize: 12, color: '#9db4d4' }}><span style={{ fontSize: 14, marginRight: 5 }}>⚠</span>Partial Match</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff1493', marginTop: 8 }}>{summary.partial}</div>
              <div style={{ fontSize: 11, color: '#9db4d4', marginTop: 4 }}>Needs review</div>
            </div>
            <div style={{ padding: 15, background: 'rgba(255, 71, 87, 0.15)', borderRadius: 8, borderLeft: '4px solid #ff4757' }}>
              <div style={{ fontSize: 12, color: '#9db4d4' }}><span style={{ fontSize: 14, marginRight: 5 }}>✕</span>Unmatched</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4757', marginTop: 8 }}>{summary.unmatched}</div>
              <div style={{ fontSize: 11, color: '#9db4d4', marginTop: 4 }}>No match found</div>
            </div>
          </div>

          <div style={{ marginTop: 20, padding: 15, background: 'rgba(0, 217, 255, 0.08)', borderRadius: 8, border: '1px solid rgba(0, 217, 255, 0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 15 }}>
              <div>
                <div style={{ fontSize: 12, color: '#9db4d4' }}>Total Transactions</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f0f4f8', marginTop: 6 }}>{summary.total_transactions}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#9db4d4' }}>Requires Review</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff1493', marginTop: 6 }}>
                  {summary.partial + (summary.review || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MISMATCHES TABLE */}
      <div className="card" style={{ marginBottom: 30 }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9db4d4', cursor: 'pointer' }}>
            <input type="checkbox" checked={showAll} onChange={(e) => { const v = e.target.checked; setShowAll(v); loadMismatches(v); }} />
            <span style={{ fontSize: 13 }}>Show all (including matched)</span>
          </label>
          <span style={{ fontSize: 12, color: '#9db4d4', marginLeft: 'auto' }}>
            {mismatches.length} item{mismatches.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Legend explaining status and confidence */}
        <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', color: '#9db4d4', fontSize: 13 }}>
          <div>Legend:</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="status-pill status-matched" style={{ padding: '4px 8px' }}>matched</span> Perfect match</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="status-pill status-pending" style={{ padding: '4px 8px' }}>partial</span> Partial / needs review</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="status-pill status-missing" style={{ padding: '4px 8px' }}>unmatched</span> No match</div>
          <div style={{ marginLeft: 'auto', color: '#9db4d4' }}>Confidence: match score (0-100%)</div>
        </div>

        {loading ? (
          <div className="muted" style={{ textAlign: 'center', padding: '20px', color: '#9db4d4' }}><span style={{ fontSize: 18, marginRight: 5 }}>▸</span>Loading...</div>
        ) : mismatches.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: '20px', color: '#9db4d4' }}>No reconciliation data. Upload files and run reconciliation first.</div>
        ) : (
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
                <tr style={{ position: 'sticky', top: 0 }}>
                <th>Transaction ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Match Type</th>
                <th title="Confidence score: probability of match (0-100%)">Confidence</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((item) => (
                <tr
                  key={item.transactionId}
                  style={{
                    background:
                      item.reconciliationStatus === 'unmatched'
                        ? 'rgba(255, 71, 87, 0.1)'
                        : item.reconciliationStatus === 'partial'
                        ? 'rgba(255, 20, 147, 0.1)'
                        : item.reconciliationStatus === 'duplicate'
                        ? 'rgba(179, 102, 255, 0.1)'
                        : 'transparent',
                    color: '#f0f4f8',
                  }}
                >
                  <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.transactionId.substring(0, 12)}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: '600', color: '#00ff88', width: '100px' }}>${item.transactionAmount}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 4,
                        background: getStatusColor(item.reconciliationStatus),
                        color: '#0d1117',
                        fontSize: 11,
                        fontWeight: 'bold',
                        boxShadow: `0 0 8px ${getStatusColor(item.reconciliationStatus)}40`
                      }}
                    >
                      {item.reconciliationStatus}
                    </span>
                  </td>
                  <td style={{ color: '#00d9ff', fontWeight: '500' }}>{item.matchType || '-'}</td>
                  <td style={{ color: '#ffa500', fontWeight: '600' }}>{item.confidence ? Math.round(item.confidence * 100) + '%' : '-'}</td>
                  <td style={{ maxWidth: 400, overflow: 'hidden', color: '#9db4d4', fontSize: 11, whiteSpace: 'normal', wordBreak: 'break-word' }} title={item.reason}>
                    {item.reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
