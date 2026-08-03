import { useEffect, useState, useCallback, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';

const STAGES = ['1-Qualify', '2-Develop', '3-Propose', '4-Close'];

const currency = (n) => `$${Number(n ?? 0).toLocaleString()}`;

function stageIndex(stepname) {
  const i = STAGES.indexOf(stepname);
  return i === -1 ? 1 : i + 1;
}

function IconBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 20V13" /><path d="M12 20V6" /><path d="M19 20v-9" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

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

  const stats = useMemo(() => {
    const totalValue = summary.reduce((sum, s) => sum + Number(s.total_value ?? 0), 0);
    const openCount = opportunities.length;
    const avgDeal = openCount ? totalValue / openCount : 0;
    const now = new Date();
    const closingThisMonth = opportunities.filter((o) => {
      if (!o.estimatedclosedate) return false;
      const d = new Date(o.estimatedclosedate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const maxStageValue = Math.max(1, ...summary.map((s) => Number(s.total_value ?? 0)));
    return { totalValue, openCount, avgDeal, closingThisMonth, maxStageValue };
  }, [summary, opportunities]);

  return (
    <div className="sales-workspace">
      <div className="workspace-header">
        <div>
          <h2>Sales Workspace</h2>
          <p className="muted">Track pipeline health and manage opportunities.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-icon"><IconBars /></div>
          <div className="stat-label">Pipeline value</div>
          <div className="stat-value">{currency(stats.totalValue)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon"><IconBriefcase /></div>
          <div className="stat-label">Open opportunities</div>
          <div className="stat-value">{stats.openCount}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon"><IconCalendar /></div>
          <div className="stat-label">Closing this month</div>
          <div className="stat-value">{stats.closingThisMonth}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon"><IconTrend /></div>
          <div className="stat-label">Avg. deal size</div>
          <div className="stat-value">{currency(stats.avgDeal)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Pipeline Summary</h3>
        </div>
        <div className="pipeline-summary">
          {summary.map((s) => {
            const value = Number(s.total_value ?? 0);
            const pct = Math.round((value / stats.maxStageValue) * 100);
            return (
              <div key={s.stage} className="pipeline-stage" data-stage={stageIndex(s.stage)}>
                <div className="stage-name">{s.stage.replace(/^\d-/, '')}</div>
                <div className="stage-value">{currency(value)}</div>
                <div className="stage-count">{s.count} opportunities</div>
                <div className="stage-bar-track">
                  <div className="stage-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Opportunities</h3>
        </div>
        {loading ? (
          <div className="loading-state"><span className="spinner" />Loading…</div>
        ) : opportunities.length === 0 ? (
          <div className="empty-state">No opportunities found.</div>
        ) : (
          <table className="data-table">
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
                      className="stage-select"
                      data-stage={stageIndex(opp.stepname)}
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
                  <td>{currency(opp.estimatedvalue)}</td>
                  <td>{opp.estimatedclosedate?.slice(0, 10) ?? '—'}</td>
                  <td>
                    <button className="btn-ghost" onClick={() => logActivity(opp.opportunityid)}>
                      <IconPhone /> Log activity
                    </button>
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
