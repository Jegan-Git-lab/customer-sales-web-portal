import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { caseTypeLabel, statusLabel, statusPillClass, isOpenStatus } from '../../lib/ticketLabels';

function IconTicket() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <line x1="10" y1="6" x2="10" y2="18" strokeDasharray="2 2" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

export default function TicketList() {
  const { call } = useApi();
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Server enforces this list is scoped to the caller's own contact —
    // no client filter is honored for the customer persona.
    call('/api/tickets')
      .then((res) => setTickets(res.value))
      .catch((err) => setError(err.message));
  }, [call]);

  const stats = useMemo(() => {
    if (!tickets) return null;
    const open = tickets.filter((t) => isOpenStatus(t.statuscode)).length;
    return { total: tickets.length, open, resolved: tickets.length - open };
  }, [tickets]);

  return (
    <div className="customer-page">
      <div className="workspace-header">
        <div>
          <h2>My Tickets</h2>
          <p className="muted">Support requests you've raised, and their status.</p>
        </div>
        <Link to="/tickets/new" className="btn" style={{ textDecoration: 'none' }}>
          Raise a new ticket
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      {stats && stats.total > 0 && (
        <div className="stat-row">
          <div className="stat-tile">
            <div className="stat-icon"><IconTicket /></div>
            <div className="stat-label">Total tickets</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-icon"><IconClock /></div>
            <div className="stat-label">Open</div>
            <div className="stat-value">{stats.open}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-icon"><IconCheckCircle /></div>
            <div className="stat-label">Resolved</div>
            <div className="stat-value">{stats.resolved}</div>
          </div>
        </div>
      )}

      <div className="card">
        {!tickets ? (
          <p className="muted">Loading…</p>
        ) : tickets.length === 0 ? (
          <div className="empty-state">No tickets yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Category</th><th>Status</th><th>Opened</th><th></th></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.incidentid}>
                  <td>{t.title}</td>
                  <td>{caseTypeLabel(t.casetypecode)}</td>
                  <td>
                    <span className={`status-pill ${statusPillClass(t.statuscode)}`}>
                      {statusLabel(t.statuscode)}
                    </span>
                  </td>
                  <td>{t.createdon?.slice(0, 10)}</td>
                  <td><Link to={`/tickets/${t.incidentid}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
