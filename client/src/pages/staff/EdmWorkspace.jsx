import { useState, useEffect, useCallback } from 'react';
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
  const [savedSegments, setSavedSegments] = useState([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState('');

  const loadSavedSegments = useCallback(async () => {
    // Best-effort: saved segments are a convenience layer on top of the
    // core build/preview/send flow, not required for it to work — a
    // failure here (e.g. the route not existing on an older deployed
    // API) shouldn't block the page with an error banner.
    try {
      const res = await call('/api/segments');
      setSavedSegments(res.value);
    } catch (err) {
      console.warn('Failed to load saved segments:', err.message);
    }
  }, [call]);

  useEffect(() => {
    loadSavedSegments();
  }, [loadSavedSegments]);

  function updateCriteria(field, value) {
    setSelectedSegmentId('');
    setCriteria((c) => ({ ...c, [field]: value }));
  }

  function loadSegment(id) {
    setSelectedSegmentId(id);
    if (!id) return;
    const segment = savedSegments.find((s) => s.id === id);
    if (!segment) return;
    setCriteria({ state: '', policyType: '', status: '', ...segment.criteria });
    setPreview(null);
  }

  async function deleteSegment() {
    if (!selectedSegmentId) return;
    const segment = savedSegments.find((s) => s.id === selectedSegmentId);
    if (!window.confirm(`Delete saved segment "${segment?.name}"?`)) return;
    try {
      await call(`/api/segments/${selectedSegmentId}`, { method: 'DELETE' });
      setSelectedSegmentId('');
      await loadSavedSegments();
    } catch (err) {
      setError(err.message);
    }
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
      <div className="workspace-header">
        <div>
          <h2>Email Campaigns</h2>
          <p className="muted">Build a segment, compose a message, and track delivery.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <div className="step-title">
          <span className="step-badge">1</span>
          <h3>Build segment</h3>
        </div>

        {savedSegments.length > 0 && (
          <div className="field-row">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Saved segments</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={selectedSegmentId} onChange={(e) => loadSegment(e.target.value)} style={{ flex: 1 }}>
                  <option value="">— Load a saved segment —</option>
                  {savedSegments.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {selectedSegmentId && (
                  <button type="button" className="btn-ghost" onClick={deleteSegment}>Delete</button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="field-row">
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
        </div>
        <button onClick={runPreview} disabled={loading}>Preview segment</button>

        {preview && (
          <>
            <div className="preview-count">
              <span className="stat-value">{preview.count}</span>
              <span className="muted">matching contacts</span>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th></tr>
              </thead>
              <tbody>
                {preview.sample.map((m) => (
                  <tr key={m.contactid}><td>{m.fullname}</td><td>{m.emailaddress1}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <div className="step-title">
          <span className="step-badge">2</span>
          <h3>Compose &amp; send</h3>
        </div>
        <div className="field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="field">
          <label>Body</label>
          <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <button onClick={send} disabled={loading || !preview?.count}>
          Send to segment
        </button>
      </div>

      {sendResult && (
        <div className="card">
          <div className="step-title">
            <span className="step-badge">3</span>
            <h3>Send status</h3>
          </div>
          <p className="muted">Targeted {sendResult.targeted} contacts. Name: {sendResult.name}</p>
          <button className="btn-ghost" onClick={checkStatus}>Refresh status</button>
          {status && (
            <div className="status-summary">
              {Object.entries(status.summary).map(([type, count]) => (
                <div key={type} className="status-chip">
                  <strong>{count}</strong>
                  <span>{type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
