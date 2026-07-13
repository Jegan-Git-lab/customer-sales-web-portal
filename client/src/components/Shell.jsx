import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';

const STAFF_LINKS = [
  { to: '/sales', label: 'Sales' },
  { to: '/edm', label: 'Email Campaigns' },
];

const CUSTOMER_LINKS = [
  { to: '/profile', label: 'My Profile' },
  { to: '/tickets', label: 'My Tickets' },
];

export default function Shell({ children }) {
  const { persona, account, signOut } = useAuth();
  const links = persona === 'staff' ? STAFF_LINKS : CUSTOMER_LINKS;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Contoso Portal</h1>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 32 }}>
          <div className="muted">{account?.name ?? account?.username}</div>
          <button onClick={signOut} style={{ marginTop: 8, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' }}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
