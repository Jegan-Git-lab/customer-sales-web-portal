import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';

function IconSales() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function IconBrand() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const STAFF_LINKS = [
  { to: '/sales', label: 'Sales', icon: IconSales },
  { to: '/edm', label: 'Email Campaigns', icon: IconMail },
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
          <IconBrand />
          {persona === 'staff' ? 'Staff Portal' : 'Customer Staff Portal'}
        </h1>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.icon && <link.icon />}
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
