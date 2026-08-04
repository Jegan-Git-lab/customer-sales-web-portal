import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';

function IconSales() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <circle cx="6.5" cy="6.5" r="4.5" fill="#a3e635" stroke="#65a30d" strokeWidth="1" />
      <rect x="3" y="17" width="3.6" height="4" rx="1" fill="#22c55e" />
      <rect x="9" y="13" width="3.6" height="8" rx="1" fill="#3b82f6" />
      <rect x="15" y="8" width="3.6" height="13" rx="1" fill="#14b8a6" />
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
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M5 21c0-3.9 2.7-6.5 7-6.5s7 2.6 7 6.5" fill="#60a5fa" />
      <circle cx="12" cy="7.6" r="4.5" fill="#3b82f6" />
      <circle cx="12" cy="9.3" r="4" fill="#f8c9a0" />
      <circle cx="7.3" cy="9.3" r="1.3" fill="#3b82f6" />
      <circle cx="16.7" cy="9.3" r="1.3" fill="#3b82f6" />
      <path d="M7.3 8a4.7 4.7 0 0 1 9.4 0" fill="none" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="9.3" y="19" width="5.4" height="2.6" rx="0.7" fill="#2dd4bf" />
    </svg>
  );
}

function IconStaffTeam() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M6.5 21c0-4.5 2.5-7.5 5.5-7.5s5.5 3 5.5 7.5" fill="#94a3b8" />
      <circle cx="12" cy="7" r="3.2" fill="#94a3b8" />
      <circle cx="17" cy="4" r="2.1" fill="#f97316" />
      <rect x="16.3" y="0.9" width="1.4" height="1.4" fill="#f97316" />
      <rect x="16.3" y="5.7" width="1.4" height="1.4" fill="#f97316" />
      <rect x="13.9" y="3.3" width="1.4" height="1.4" fill="#f97316" />
      <rect x="18.7" y="3.3" width="1.4" height="1.4" fill="#f97316" />
      <path d="M2.5 21c0-3.6 2-6 4.5-6s4.5 2.4 4.5 6" fill="#ef4444" />
      <circle cx="7" cy="10.2" r="2.7" fill="#ef4444" />
      <path d="M12.5 21c0-3.6 2-6 4.5-6s4.5 2.4 4.5 6" fill="#3b82f6" />
      <circle cx="17" cy="10.2" r="2.7" fill="#3b82f6" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="navProfileGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15934c" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="8" r="4" fill="url(#navProfileGrad)" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="url(#navProfileGrad)" />
    </svg>
  );
}

function IconTickets() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <line x1="10" y1="6" x2="10" y2="18" strokeDasharray="2 2" />
    </svg>
  );
}

const STAFF_LINKS = [
  { to: '/sales', label: 'Sales', icon: IconSales },
  { to: '/edm', label: 'Email Campaigns', icon: IconMail },
];

const CUSTOMER_LINKS = [
  { to: '/profile', label: 'My Profile', icon: IconProfile },
  { to: '/tickets', label: 'My Tickets', icon: IconTickets },
];

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function Shell({ children }) {
  const { persona, account, signOut } = useAuth();
  const links = persona === 'staff' ? STAFF_LINKS : CUSTOMER_LINKS;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className={persona === 'staff' ? 'staff-title' : 'customer-title'}>
          {persona === 'staff' ? <IconStaffTeam /> : <IconBrand />}
          {persona === 'staff' ? 'Staff Portal' : 'Customer Portal'}
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
          <div className="account-row">
            <div className="sidebar-avatar">{initials(account?.name ?? account?.username)}</div>
            <div className="account-text">
              <div className="account-name">{account?.name ?? account?.username}</div>
              {account?.name && account?.username && (
                <div className="account-email muted">{account.username}</div>
              )}
            </div>
          </div>
          <span className={`role-badge ${persona}`}>{persona}</span>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
