import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { caseTypeLabel, statusLabel } from '../../lib/ticketLabels';

export default function TicketDetail() {
  const { id } = useParams();
  const { call } = useApi();
  const [ticket, setTicket] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      // If this ticket doesn't belong to the caller, the API returns 404 —
      // not 403 — so no existence is leaked either way.
      const data = await call(`/api/tickets/${id}`);
      setTicket(data);
    } catch (err) {
      setError(err.message);
    }
  }, [call, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await call(`/api/tickets/${id}/comments`, { method: 'POST', body: { text: comment } });
      setComment('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!ticket) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h2>{ticket.title}</h2>
      <div className="card">
        <p><span className="status-pill">{statusLabel(ticket.statuscode)}</span> · {caseTypeLabel(ticket.casetypecode)}</p>
        <p>{ticket.description}</p>
        <p className="muted">Opened {ticket.createdon?.slice(0, 10)}</p>
      </div>

      <div className="card">
        <h3>Add a comment</h3>
        <form onSubmit={submitComment}>
          <div className="field">
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting}>Add comment</button>
        </form>
      </div>
    </div>
  );
}
