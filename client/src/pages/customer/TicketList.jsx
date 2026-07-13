import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';

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

  return (
    <div>
      <h2>My Tickets</h2>
      {error && <p className="error-text">{error}</p>}
      <div className="card">
        <Link to="/tickets/new" className="btn" style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none' }}>
          Raise a new ticket
        </Link>
        {!tickets ? (
          <p className="muted">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="muted">No tickets yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Title</th><th>Category</th><th>Status</th><th>Opened</th><th></th></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.incidentid}>
                  <td>{t.title}</td>
                  <td>{t.casetypecode}</td>
                  <td><span className="status-pill">{t.statuscode}</span></td>
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
