import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';

const CATEGORIES = ['Billing', 'Claims', 'PolicyChange', 'General'];

export default function NewTicket() {
  const { call } = useApi();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // customerId is never sent from the client for this persona — the
      // API resolves it server-side from the authenticated token.
      const ticket = await call('/api/tickets', { method: 'POST', body: { title, category, description } });
      navigate(`/tickets/${ticket.incidentid}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2>Raise a Support Ticket</h2>
      <form className="card" onSubmit={submit}>
        {error && <p className="error-text">{error}</p>}
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="field">
          <label>Attachment (optional)</label>
          <input type="file" />
          <p className="muted">Attachment upload wires to Dataverse annotations — see README.</p>
        </div>
        <button type="submit" disabled={submitting}>Submit ticket</button>
      </form>
    </div>
  );
}
