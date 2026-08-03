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
        <h1 className={persona === 'staff' ? 'staff-title' : ''}>
          {persona === 'staff' ? 'Staff Portal' : 'Customer Staff Portal'}
        </h1>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="account-name">{account?.name ?? account?.username}</div>
          {account?.name && account?.username && (
            <div className="account-email muted">{account.username}</div>
          )}
          <span className={`role-badge ${persona}`}>{persona}</span>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className={`main ${persona === 'staff' ? 'main-staff' : ''}`}>{children}</main>
    </div>
  );
}
