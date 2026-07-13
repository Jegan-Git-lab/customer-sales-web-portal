import { useAuth } from '../hooks/AuthContext';

export default function LoginGate() {
  const { signIn } = useAuth();

  return (
    <div className="login-screen">
      <h1>  Customer Staff Portal</h1>
      <p className="muted">Choose how you're signing in.</p>
      <button onClick={() => signIn('staff')}>Sign in as Staff</button>
      <button onClick={() => signIn('customer')}>Sign in as Customer</button>
    </div>
  );
}
