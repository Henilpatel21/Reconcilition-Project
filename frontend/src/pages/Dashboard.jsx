import React, { useEffect, useState, useContext } from 'react';
import { getSummary, getHistory, deleteSummary } from '../services/reconcileService';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

import { AuthContext } from '../context/AuthContext';

export default function Dashboard(){
  const [summary,setSummary] = useState(null);
  const [hasData, setHasData] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { user } = useContext(AuthContext);

  const fetchSummary = async () => {
    if (!user && !localStorage.getItem('token')) {
      // Not authenticated — don't call protected API
      setHasData(false);
      setLoading(false);
      return;
    }
    try {
      const res = await getSummary();
      // Map backend keys to frontend-friendly fields
      const mapped = {
        totalTx: res.total_transactions ?? res.totalTx ?? 0,
        totalSettled: res.matched ?? res.totalSettled ?? 0,
        totalMismatched: res.unmatched ?? res.totalMismatched ?? 0,
        raw: res
      };
      setSummary(mapped);
      setHasData(true);
      setLastUpdated(new Date());
    } catch (err) {
      if (err?.response?.status === 404) {
        setHasData(false);
      } else {
        console.error('Failed to fetch summary', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await fetchSummary();
    })();

    // Listen for reconciliation run events from other pages/tabs
    const onStorage = (e) => {
      if (e.key === 'reconcile_updated_at') {
        // refetch summary
        fetchSummary();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { mounted = false; window.removeEventListener('storage', onStorage); };
  },[]);

  // Fetch reconciliation history with pagination
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;

  const fetchHistory = async (page = 0) => {
    setHistoryLoading(true);
    try {
      const res = await getHistory(itemsPerPage, page * itemsPerPage);
      const items = (res.items || []).map(i => {
        const details = i.details || i._doc || {};
        return {
          id: i._id || i.id,
          runDate: i.createdAt || i.runDate,
          total: details?.total_transactions ?? details?.total ?? 0,
          matched: details?.matched ?? 0,
          unmatched: details?.unmatched ?? 0,
          partial: details?.partial ?? 0
        };
      });
      setHistory(items);
      setTotalCount(res.total || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load history', err);
      setHistory([]);
      setTotalCount(0);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(()=>{ fetchHistory(0); }, []);

  const chartData = summary ? {
    labels: ['Total', 'Matched', 'Mismatched'],
    datasets: [{ label: 'Transactions', backgroundColor: ['#6ea8fe','#7ef0a6','#ffa5a5'], data: [summary.totalTx, summary.totalSettled, summary.totalMismatched] }]
  } : null;

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="container">
      <div className="nav card">
        <h3>Dashboard</h3>
      </div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <h4 style={{margin:0}}>Summary</h4>
          <div style={{marginLeft:'auto', display:'flex', gap:8}}>
            <button className="btn" onClick={() => { setLoading(true); fetchSummary(); }}>Refresh</button>
          </div>
        </div>
        {loading ? (<div className="muted">Loading...</div>) : summary ? (
          <div style={{display:'flex',gap:16,alignItems:'center'}}>
            <div style={{flex:1}}>
              <div className="card" style={{padding:12}}>
                <div className="muted">Total Transactions</div>
                <div style={{fontSize:24}}>{summary.totalTx}</div>
                {lastUpdated && <div className="muted" style={{fontSize:11}}>Updated: {lastUpdated.toLocaleString()}</div>}
              </div>
            </div>
            <div style={{width:420}}>
              <Bar data={chartData} />
            </div>
          </div>
        ) : (!hasData ? (<div className="muted">No reconciliation results yet. Upload files and run reconciliation.</div>) : (<div className="muted">Loading...</div>))}
      </div>

      {/* History section */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h4 style={{ margin: 0 }}>Reconciliation History</h4>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn" onClick={() => fetchHistory(currentPage)}>Refresh</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {historyLoading ? (
            <div className="muted">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="muted">No past reconciliation runs found.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 12 }}>
                {history.map(h => (
                  <div key={h.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 240px 120px', alignItems: 'center', gap: 12, padding: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#9db4d4' }}>{new Date(h.runDate).toLocaleString()}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{h.total} Transactions</div>
                      <div style={{ fontSize: 13, color: '#9db4d4' }}>{h.matched} matched · {h.partial} partial · {h.unmatched} unmatched</div>
                    </div>
                    <div>
                      <Bar
                        data={{ labels: ['Total', 'Matched', 'Mismatched'], datasets:[{ label: 'Transactions', data: [h.total, h.matched, h.unmatched], backgroundColor:['#6ea8fe','#7ef0a6','#ffa5a5'] }] }}
                        options={{ responsive: true, maintainAspectRatio: false }}
                        style={{ height: 120 }}
                      />
                    </div>
                    <button className="btn" style={{ background: 'linear-gradient(135deg,#ff6b6b,#ff4757)', whiteSpace: 'nowrap' }} onClick={async () => {
                      if (!window.confirm('Delete this reconciliation summary?')) return;
                      try {
                        await deleteSummary(h.id);
                        if (history.length === 1 && currentPage > 0) {
                          fetchHistory(currentPage - 1);
                        } else {
                          fetchHistory(currentPage);
                        }
                        fetchSummary();
                      } catch (err) {
                        console.error('Failed to delete summary', err);
                        alert('Failed to delete summary');
                      }
                    }}>Delete</button>
                  </div>
                ))}
              </div>
              
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  <button className="btn" disabled={currentPage === 0} onClick={() => fetchHistory(currentPage - 1)}>← Prev</button>
                  <div style={{ color: '#9db4d4', fontSize: 13 }}>Page {currentPage + 1} of {totalPages}</div>
                  <button className="btn" disabled={currentPage >= totalPages - 1} onClick={() => fetchHistory(currentPage + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
