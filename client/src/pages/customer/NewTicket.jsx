import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';

const CATEGORIES = ['Billing', 'Claims', 'PolicyChange', 'General'];
const CATEGORY_LABELS = { Billing: 'Billing', Claims: 'Claims', PolicyChange: 'Policy Change', General: 'General' };

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

function IconBilling() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.3c0-1.3 1.1-2 2.5-2s2.5.7 2.5 1.9c0 2.4-5 1.4-5 3.8 0 1.2 1.1 1.9 2.5 1.9s2.5-.6 2.5-1.9" />
    </svg>
  );
}

function IconClaims() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
    </svg>
  );
}

function IconPolicyChange() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M12 12v6M9 15h6" />
    </svg>
  );
}

function IconGeneral() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

const CATEGORY_ICONS = { Billing: IconBilling, Claims: IconClaims, PolicyChange: IconPolicyChange, General: IconGeneral };

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
      <div className="workspace-header">
        <div>
          <h2>Raise a Support Ticket</h2>
          <p className="muted">Tell us what's going on and we'll get back to you.</p>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        {error && <p className="error-text">{error}</p>}

        <div className="field">
          <label>Category</label>
          <div className="category-grid">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c];
              return (
                <button
                  type="button"
                  key={c}
                  className={`category-option${category === c ? ' active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  <span className="category-icon"><Icon /></span>
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>

        <div className="field">
          <label>Attachment (optional)</label>
          <label className="file-upload-label" htmlFor="attachment">
            <IconUpload />
            {file ? file.name : 'Choose a file'}
          </label>
          <input
            id="attachment"
            type="file"
            className="file-upload-input"
            onChange={(e) => setFile(e.target.files[0] ?? null)}
          />
          <p className="muted">Max {MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB.</p>
        </div>

        <button type="submit" disabled={submitting}>Submit ticket</button>
      </form>
    </div>
  );
}
