import { useEffect, useState, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';

const currency = (n) => `$${Number(n ?? 0).toLocaleString()}`;

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
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

function IconDollar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.3c0-1.3 1.1-2 2.5-2s2.5.7 2.5 1.9c0 2.4-5 1.4-5 3.8 0 1.2 1.1 1.9 2.5 1.9s2.5-.6 2.5-1.9" />
    </svg>
  );
}

export default function CustomerProfile() {
  const { call } = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    call('/api/profile')
      .then(setData)
      .catch((err) => setError(err.message));
  }, [call]);

  const stats = useMemo(() => {
    if (!data) return null;
    const active = data.policies.filter((p) => /active/i.test(p.new_status ?? '')).length;
    const totalPremium = data.policies.reduce((sum, p) => sum + Number(p.new_premiumamount ?? 0), 0);
    return { active, totalPremium };
  }, [data]);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="profile-page">
      <div className="workspace-header">
        <div>
          <h2>My Profile</h2>
          <p className="muted">Your account details and active policies.</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-icon"><IconShield /></div>
          <div className="stat-label">Policies</div>
          <div className="stat-value">{data.policies.length}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon"><IconCheckCircle /></div>
          <div className="stat-label">Active</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon"><IconDollar /></div>
          <div className="stat-label">Total premium</div>
          <div className="stat-value">{currency(stats.totalPremium)}</div>
        </div>
      </div>

      <div className="card">
        <div className="profile-card">
          <div className="avatar-circle">{initials(data.profile.fullname)}</div>
          <div className="profile-meta">
            <p><strong>{data.profile.fullname}</strong></p>
            <p className="muted">{data.profile.emailaddress1}</p>
            <p className="muted">{data.profile.telephone1}</p>
            <p className="muted">
              {data.profile.address1_line1}, {data.profile.address1_city}, {data.profile.address1_stateorprovince}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>My Policies</h3>
        </div>
        {data.policies.length === 0 ? (
          <div className="empty-state">No policies on file.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Policy #</th><th>Type</th><th>Status</th><th>Premium</th><th>Renews</th></tr>
            </thead>
            <tbody>
              {data.policies.map((p) => (
                <tr key={p.new_policynumber}>
                  <td>{p.new_policynumber}</td>
                  <td>{p.new_productcode}</td>
                  <td><span className="status-pill">{p.new_status}</span></td>
                  <td>{currency(p.new_premiumamount)}</td>
                  <td>{p.new_expirydate?.slice(0, 10) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
