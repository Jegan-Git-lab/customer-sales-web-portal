import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';

export default function CustomerProfile() {
  const { call } = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    call('/api/profile')
      .then(setData)
      .catch((err) => setError(err.message));
  }, [call]);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h2>My Profile</h2>
      <div className="card">
        <p><strong>{data.profile.fullname}</strong></p>
        <p className="muted">{data.profile.emailaddress1}</p>
        <p className="muted">{data.profile.telephone1}</p>
        <p className="muted">
          {data.profile.address1_line1}, {data.profile.address1_city}, {data.profile.address1_stateorprovince}
        </p>
      </div>

      <div className="card">
        <h3>My Policies</h3>
        <table>
          <thead>
            <tr><th>Policy #</th><th>Type</th><th>Status</th><th>Premium</th><th>Renews</th></tr>
          </thead>
          <tbody>
            {data.policies.map((p) => (
              <tr key={p.contoso_policynumber}>
                <td>{p.contoso_policynumber}</td>
                <td>{p.contoso_policytype}</td>
                <td><span className="status-pill">{p.contoso_status}</span></td>
                <td>${Number(p.contoso_premium ?? 0).toLocaleString()}</td>
                <td>{p.contoso_renewaldate?.slice(0, 10) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
