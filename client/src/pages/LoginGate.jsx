import { useAuth } from '../hooks/AuthContext';

export default function LoginGate() {
  const { signIn } = useAuth();

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <span>Customer Staff Portal</span>
        </div>

        <h1>Sign in to continue</h1>
        <p className="muted">Choose how you're signing in.</p>

        <div className="persona-options">
          <button type="button" className="persona-option" onClick={() => signIn('staff')}>
            <span className="persona-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </span>
            <span className="persona-copy">
              <strong>Sign in as Staff</strong>
              <span>Sales &amp; email campaign workspace</span>
            </span>
            <svg className="persona-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <button type="button" className="persona-option" onClick={() => signIn('customer')}>
            <span className="persona-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </span>
            <span className="persona-copy">
              <strong>Sign in as Customer</strong>
              <span>Profile &amp; support tickets</span>
            </span>
            <svg className="persona-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <p className="login-footnote">Secured by Microsoft Entra ID</p>
      </div>
    </div>
  );
}
