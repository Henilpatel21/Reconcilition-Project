import React, { useEffect, useState, useContext } from 'react';
import { generateMock as generateMockTransactions, getTransactions, deleteAllTransactions, downloadTransactionsCSV } from '../services/transactionService';
import { generateMockBankStatements, getBankStatements, deleteAllBankStatements, downloadBankStatementsCSV } from '../services/bankStatementService';
import { ToastContext } from '../context/ToastContext';

export default function DataSources() {
  const [transactions, setTransactions] = useState([]);
  const [bankStatements, setBankStatements] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useContext(ToastContext);

  const loadTransactions = async () => {
    try {
      const res = await getTransactions({ limit: 200 });
      setTransactions(res.data || []);
    } catch (err) {
      toast.show('Failed to load transactions', 'danger');
    }
  };

  const loadBankStatements = async () => {
    try {
      const res = await getBankStatements();
      setBankStatements(res.data || []);
    } catch (err) {
      toast.show('Failed to load bank statements', 'danger');
    }
  };

  useEffect(() => {
    loadTransactions();
    loadBankStatements();
  }, []);

  const handleGenerateMockTransactions = async () => {
    setLoading(true);
    try {
      const res = await generateMockTransactions();
      toast.show(`Generated ${res.count || 0} mock transactions`, 'success');
      await loadTransactions();
    } catch (err) {
      toast.show('Failed to generate mock transactions', 'danger');
    }
    setLoading(false);
  };

  const handleGenerateMockBankStatements = async () => {
    setLoading(true);
    try {
      const res = await generateMockBankStatements();
      toast.show(`Generated ${res.count || 0} mock bank statements`, 'success');
      await loadBankStatements();
    } catch (err) {
      toast.show('Failed to generate mock bank statements', 'danger');
    }
    setLoading(false);
  };

  const handleDeleteAllBankStatements = async () => {
    if (!window.confirm('Delete ALL bank statements?')) return;
    setLoading(true);
    try {
      const res = await deleteAllBankStatements();
      toast.show(`Deleted ${res.deleted || 0} bank statements`, 'success');
      setBankStatements([]);
    } catch (err) {
      toast.show('Failed to delete bank statements', 'danger');
    }
    setLoading(false);
  };

  const handleDeleteAllTransactions = async () => {
    if (!window.confirm('Delete ALL transactions?')) return;
    setLoading(true);
    try {
      const res = await deleteAllTransactions();
      toast.show(`Deleted ${res.deleted || 0} transactions`, 'success');
      setTransactions([]);
    } catch (err) {
      toast.show('Failed to delete transactions', 'danger');
    }
    setLoading(false);
  };

  const handleDownloadTransactionsCSV = async () => {
    setLoading(true);
    try {
      const blob = await downloadTransactionsCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.show('Transactions CSV downloaded', 'success');
    } catch (err) {
      toast.show('Failed to download transactions', 'danger');
    }
    setLoading(false);
  };

  const handleDownloadBankStatementsCSV = async () => {
    setLoading(true);
    try {
      const blob = await downloadBankStatementsCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bank_statements.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.show('Bank statements CSV downloaded', 'success');
    } catch (err) {
      toast.show('Failed to download bank statements', 'danger');
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h2 style={{ marginBottom: 20 }}>Data Sources: Two Separate Sources</h2>
      <p style={{ marginBottom: 30, fontSize: 14, color: '#999' }}>
        Generate mock data for both sources, then run reconciliation to match transactions with bank statements.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {/* SOURCE 1: TRANSACTIONS */}
        <div className="card">
          <h3 style={{ marginBottom: 15, borderBottom: '2px solid #caffbf', paddingBottom: 10 }}>
            <span style={{ fontSize: 20, marginRight: 8 }}>◊</span>Source 1: Internal Transactions
          </h3>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 15 }}>
            Transactions from your payment processor. Click below to generate 15-20 mock transactions with bankReferenceId.
          </p>

          <div style={{ marginBottom: 15 }}>
            <button
              className="btn"
              onClick={handleGenerateMockTransactions}
              disabled={loading}
              style={{ width: '100%', marginBottom: 10 }}
            >
              {loading ? 'Generating...' : 'Generate Mock Transactions'}
            </button>

            <button
              className="btn"
              onClick={handleDownloadTransactionsCSV}
              disabled={loading || transactions.length === 0}
              style={{ width: '100%', marginBottom: 10, background: '#a0c4ff', color: '#0a0e27' }}
            >
              ↙ Download as CSV
            </button>

            <button 
              className="btn" 
              onClick={handleDeleteAllTransactions} 
              disabled={loading} 
              style={{ width: '100%', background: '#ffadad', color: '#0a0e27' }}
            >
              Delete All
            </button>

            <p style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
              Total Records: <strong>{transactions.length}</strong>
            </p>
          </div>

          <div style={{ maxHeight: 400, overflow: 'auto', borderTop: '1px solid #eee', paddingTop: 10 }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#f5f5f5' }}>
                  <th>Transaction ID</th>
                  <th>Bank Ref</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn._id}>
                    <td style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={txn.transactionId}>
                      {txn.transactionId.substring(0, 8)}
                    </td>
                    <td style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={txn.bankReferenceId}>
                      {txn.bankReferenceId?.substring(0, 8) || '-'}
                    </td>
                    <td>{txn.merchantId}</td>
                    <td style={{ textAlign: 'right' }}>${txn.amount}</td>
                    <td>
                      <span className={`status-pill status-${txn.status}`} style={{ fontSize: 10 }}>
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SOURCE 2: BANK STATEMENTS */}
        <div className="card">
          <h3 style={{ marginBottom: 15, borderBottom: '2px solid #a0c4ff', paddingBottom: 10 }}>
            <span style={{ fontSize: 20, marginRight: 8 }}>◊</span>Source 2: Bank Statements
          </h3>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 15 }}>
            Settlement records from your bank with bankReferenceId matching transactions. Click below to generate 15-20 mock records.
          </p>

          <div style={{ marginBottom: 15 }}>
            <button
              className="btn"
              onClick={handleGenerateMockBankStatements}
              disabled={loading}
              style={{ width: '100%', marginBottom: 10 }}
            >
              {loading ? 'Generating...' : 'Generate Mock Bank Statements'}
            </button>

            <button
              className="btn"
              onClick={handleDownloadBankStatementsCSV}
              disabled={loading || bankStatements.length === 0}
              style={{ width: '100%', marginBottom: 10, background: '#a0c4ff', color: '#0a0e27' }}
            >
              <span style={{ fontSize: 18 }}>↙</span> Download as CSV
            </button>

            <button 
              className="btn" 
              onClick={handleDeleteAllBankStatements} 
              disabled={loading} 
              style={{ width: '100%', background: '#ffadad', color: '#0a0e27' }}
            >
              Delete All
            </button>

            <p style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
              Total Records: <strong>{bankStatements.length}</strong>
            </p>
          </div>

          <div style={{ maxHeight: 400, overflow: 'auto', borderTop: '1px solid #eee', paddingTop: 10 }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#f5f5f5' }}>
                  <th>Bank Ref</th>
                  <th>Merchant Account</th>
                  <th>Amount</th>
                  <th>Settlement Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bankStatements.map((stmt) => (
                  <tr key={stmt._id}>
                    <td style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stmt.bankReferenceId}>
                      {stmt.bankReferenceId.substring(0, 8)}
                    </td>
                    <td>{stmt.merchantAccountId}</td>
                    <td style={{ textAlign: 'right' }}>${stmt.amount}</td>
                    <td style={{ fontSize: 11 }}>{new Date(stmt.settlementDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-pill status-${stmt.status}`} style={{ fontSize: 10 }}>
                        {stmt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
