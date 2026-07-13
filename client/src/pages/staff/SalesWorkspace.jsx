import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';

const STAGES = ['1-Qualify', '2-Develop', '3-Propose', '4-Close'];

export default function SalesWorkspace() {
  const { call } = useApi();
  const [opportunities, setOpportunities] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oppsRes, summaryRes] = await Promise.all([
        call('/api/opportunities'),
        call('/api/opportunities/pipeline/summary'),
      ]);
      setOpportunities(oppsRes.value);
      setSummary(summaryRes.value);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  async function moveStage(opportunityId, stepname) {
    setBusyId(opportunityId);
    try {
      await call(`/api/opportunities/${opportunityId}`, { method: 'PATCH', body: { stepname } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function logActivity(opportunityId) {
    const subject = window.prompt('Activity subject (e.g. "Follow-up call")');
    if (!subject) return;
    try {
      await call('/api/activities', {
        method: 'POST',
        body: { type: 'phonecall', regardingEntity: 'opportunity', regardingId: opportunityId, subject },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Sales Workspace</h2>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <h3>Pipeline Summary</h3>
        <div className="pipeline-summary">
          {summary.map((s) => (
            <div key={s.stage} className="pipeline-stage">
              <div className="stage-name">{s.stage}</div>
              <div className="stage-value">${Number(s.total_value ?? 0).toLocaleString()}</div>
              <div className="stage-count">{s.count} opportunities</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Opportunities</h3>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Close date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => (
                <tr key={opp.opportunityid}>
                  <td>{opp.name}</td>
                  <td>
                    <select
                      value={opp.stepname}
                      disabled={busyId === opp.opportunityid}
                      onChange={(e) => moveStage(opp.opportunityid, e.target.value)}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/^\d-/, '')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>${Number(opp.estimatedvalue ?? 0).toLocaleString()}</td>
                  <td>{opp.estimatedclosedate?.slice(0, 10) ?? '—'}</td>
                  <td>
                    <button onClick={() => logActivity(opp.opportunityid)}>Log activity</button>
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
