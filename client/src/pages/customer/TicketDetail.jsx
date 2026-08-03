import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { caseTypeLabel, statusLabel, statusPillClass } from '../../lib/ticketLabels';

function IconMessage() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

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
  if (!ticket) return <div className="loading-state"><span className="spinner" />Loading…</div>;

  return (
    <div>
      <div className="workspace-header">
        <div>
          <h2>{ticket.title}</h2>
          <p className="muted">Opened {ticket.createdon?.slice(0, 10)} · {caseTypeLabel(ticket.casetypecode)}</p>
        </div>
        <span className={`status-pill ${statusPillClass(ticket.statuscode)}`}>{statusLabel(ticket.statuscode)}</span>
      </div>

      {ticket.description && (
        <div className="card">
          <p>{ticket.description}</p>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Activity</h3>
        </div>

        {ticket.comments?.length > 0 ? (
          <div className="comment-timeline">
            {ticket.comments.map((c, i) => (
              <div className="comment-item" key={c.activityid}>
                {i < ticket.comments.length - 1 && <span className="comment-line" />}
                <span className="comment-dot"><IconMessage /></span>
                <div className="comment-content">
                  <div className="comment-meta">{formatDateTime(c.createdon)}</div>
                  <div className="comment-text">{c.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginBottom: 20 }}>No comments yet.</p>
        )}

        <form onSubmit={submitComment}>
          <div className="field">
            <label>Add a comment</label>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting}>Add comment</button>
        </form>
      </div>
    </div>
  );
}
