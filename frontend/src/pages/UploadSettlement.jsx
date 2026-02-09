import React, { useState, useContext, useEffect } from 'react';
import { uploadSettlement, getSettlements } from '../services/settlementService';
import { ToastContext } from '../context/ToastContext';
import { deleteAllSettlements } from '../services/settlementService';

export default function UploadSettlement(){
  const [file,setFile]=useState(null);
  const [result,setResult]=useState(null);
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(false);
  const toast = useContext(ToastContext);

  const handleUpload = async ()=>{
    if(!file) return toast.show('Please select a file to upload', 'warning');
    setLoading(true);
    try{
      const res = await uploadSettlement(file);
      setResult(res);
      // refresh list
      try{
        const list = await getSettlements();
        setRecords(list.data || []);
      }catch(e){
        // ignore
      }
      toast.show(`Upload complete: ${res.created} records`, 'success');
    }catch(err){
      toast.show('Failed to upload file', 'danger');
    }
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getSettlements();
        if (!mounted) return;
        setRecords(list.data || []);
      } catch (err) {
        // ignore silently
      }
    })();
    return () => { mounted = false };
  }, []);

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL settlement records? This action cannot be undone.')) return;
    setLoading(true);
    try {
      const res = await deleteAllSettlements();
      toast.show(`Deleted ${res.deleted || 0} settlement records`, 'success');
      setRecords([]);
      setResult(null);
    } catch (err) {
      toast.show('Failed to delete settlement records', 'danger');
    }
    setLoading(false);
  }

  return (
    <div className="container">
      <div className="nav card"><h3>Upload Settlement <small style={{marginLeft:12, fontWeight:400}}>(download .csv file and upload .csv file)</small></h3></div>
      <div className="card">
        <div className="form-row">
          <input type="file" onChange={e=>setFile(e.target.files[0])} className="file-input" />
          <button className="btn" onClick={handleUpload} disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
        </div>
        {result && <div style={{marginTop:12}}>
          <div className="muted">Parsed: {result.parsed}, Created: {result.created}{result.duplicates ? `, Skipped duplicates: ${result.duplicates}` : ''}</div>
          <pre style={{maxHeight:200,overflow:'auto'}}>{JSON.stringify(result.sample, null, 2)}</pre>
        </div>}

        <div style={{marginTop:16}}>
          <h4>All Settlements ({records.length})</h4>
            <button className="btn" onClick={handleDeleteAll} style={{marginLeft:12, background:'#ffadad', color:'#0a0e27'}} disabled={loading}>Delete All Settlements</button>
            <br /><br />
          <div style={{maxHeight:300, overflow:'auto'}}>
            <table className="table">
              <thead><tr><th>Reference</th><th>Merchant</th><th>Amount</th><th>Bank</th><th>Settlement Date</th></tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r._id}>
                    <td className="muted">{r.referenceId}</td>
                    <td>{r.merchantId}</td>
                    <td>${r.amountSettled}</td>
                    <td>{r.bankName}</td>
                    <td className="muted">{new Date(r.settlementDate).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Informational note about upcoming third-party integration */}
      <div className="card" style={{ marginTop: 18, borderLeft: '4px solid rgba(0,217,255,0.18)', background: 'linear-gradient(180deg, rgba(10,15,30,0.6), rgba(16,22,36,0.6))' }}>
        <h4 style={{ marginTop: 0, color: '#00d9ff' }}>Note — Third‑party Reconciliation (Upcoming future)</h4>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Support for direct settlement integrations (e.g., Razorpay and other payment providers) is planned.
          This will allow secure, automated ingestion of settlement files and streamlined reconciliation workflows.
          We will enable provider integrations and automatic mapping in a future release.
        </p>
      </div>
    </div>
  );
}

