import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';

const CATEGORIES = ['Billing', 'Claims', 'PolicyChange', 'General'];

// Matches the server's MAX_ATTACHMENT_BYTES (server/src/routes/tickets.js) —
// checked client-side too so oversized files fail fast without a round trip.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function NewTicket() {
  const { call } = useApi();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);

    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setError(`Attachment exceeds maximum size of ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB`);
      return;
    }

    setSubmitting(true);
    try {
      const attachment = file
        ? { filename: file.name, contentType: file.type, body: await readFileAsBase64(file) }
        : undefined;

      // customerId is never sent from the client for this persona — the
      // API resolves it server-side from the authenticated token.
      const ticket = await call('/api/tickets', {
        method: 'POST',
        body: { title, category, description, attachment },
      });
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
          <input type="file" onChange={(e) => setFile(e.target.files[0] ?? null)} />
          <p className="muted">Max {MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB.</p>
        </div>
        <button type="submit" disabled={submitting}>Submit ticket</button>
      </form>
    </div>
  );
}
