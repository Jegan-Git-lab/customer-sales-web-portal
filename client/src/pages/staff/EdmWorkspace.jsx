import { useState } from 'react';
import { useApi } from '../../hooks/useApi';

export default function EdmWorkspace() {
  const { call } = useApi();
  const [criteria, setCriteria] = useState({ state: '', policyType: '', status: '' });
  const [preview, setPreview] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendResult, setSendResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function updateCriteria(field, value) {
    setCriteria((c) => ({ ...c, [field]: value }));
  }

  async function runPreview() {
    setError(null);
    setLoading(true);
    try {
      const cleaned = Object.fromEntries(Object.entries(criteria).filter(([, v]) => v));
      const result = await call('/api/segments/preview', { method: 'POST', body: cleaned });
      setPreview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!subject || !body) {
      setError('Subject and body are required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const cleaned = Object.fromEntries(Object.entries(criteria).filter(([, v]) => v));
      const result = await call('/api/campaigns/send', {
        method: 'POST',
        body: { criteria: cleaned, templateSubject: subject, templateBody: body },
      });
      setSendResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    if (!sendResult?.campaignRunId) return;
    const result = await call(`/api/campaigns/${sendResult.campaignRunId}/status`);
    setStatus(result);
  }

  return (
    <div>
      <h2>Email Campaigns</h2>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <h3>1. Build segment</h3>
        <div className="field">
          <label>State</label>
          <input value={criteria.state} onChange={(e) => updateCriteria('state', e.target.value)} placeholder="e.g. CA" />
        </div>
        <div className="field">
          <label>Policy type</label>
          <input value={criteria.policyType} onChange={(e) => updateCriteria('policyType', e.target.value)} placeholder="e.g. Auto" />
        </div>
        <div className="field">
          <label>Status</label>
          <input value={criteria.status} onChange={(e) => updateCriteria('status', e.target.value)} placeholder="e.g. Active" />
        </div>
        <button onClick={runPreview} disabled={loading}>Preview segment</button>

        {preview && (
          <div style={{ marginTop: 16 }}>
            <p>
              <strong>{preview.count}</strong> matching contacts
            </p>
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th></tr>
              </thead>
              <tbody>
                {preview.sample.map((m) => (
                  <tr key={m.contactid}><td>{m.fullname}</td><td>{m.emailaddress1}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>2. Compose &amp; send</h3>
        <div className="field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="field">
          <label>Body (use {'{{fullname}}'} etc. for personalization)</label>
          <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <button onClick={send} disabled={loading || !preview?.count}>
          Send to segment
        </button>
      </div>

      {sendResult && (
        <div className="card">
          <h3>3. Send status</h3>
          <p>Targeted {sendResult.targeted} contacts. Name: {sendResult.name}</p>
          <button onClick={checkStatus}>Refresh status</button>
          {status && (
            <ul>
              {Object.entries(status.summary).map(([type, count]) => (
                <li key={type}>{type}: {count}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
