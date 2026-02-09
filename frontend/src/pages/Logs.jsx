import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Logs(){
  const [logs,setLogs]=useState([]);

  useEffect(()=>{
    api.get('/audit/logs').then(r=>setLogs(r.data.items || [])).catch(()=>{});
  },[]);

  return (
    <div className="container">
      <div className="nav card"><h3>Audit Logs</h3></div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn" style={{ background: 'linear-gradient(135deg, #ff4757, #ff1744)' }} onClick={async () => {
            if (!window.confirm('Clear all audit logs? This cannot be undone.')) return;
            try {
              await api.delete('/audit/all');
              setLogs([]);
            } catch (err) {
              console.error('Failed to clear logs', err);
              alert('Failed to clear logs');
            }
          }}>Clear Logs</button>
        </div>
        <table className="table">
          <thead><tr><th>Time</th><th>Action</th><th>User</th><th style={{width: '40%'}}>Details</th></tr></thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>No audit logs</td></tr>
            ) : (
              logs.map(l=> (
                <tr key={l._id}>
                  <td className="muted">{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td className="muted">{l.userId}</td>
                  <td className="muted log-details" title={JSON.stringify(l.details)}>
                    <pre className="log-pre">{JSON.stringify(l.details, null, 2)}</pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
