import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/AuthContext';
import Shell from './components/Shell';
import LoginGate from './pages/LoginGate';
import SalesWorkspace from './pages/staff/SalesWorkspace';
import EdmWorkspace from './pages/staff/EdmWorkspace';
import CustomerProfile from './pages/customer/CustomerProfile';
import TicketList from './pages/customer/TicketList';
import NewTicket from './pages/customer/NewTicket';
import TicketDetail from './pages/customer/TicketDetail';

export default function App() {
  const { persona, loading } = useAuth();

  if (loading) return <div className="login-screen">Loading…</div>;

  if (!persona) {
    return (
      <Routes>
        <Route path="*" element={<LoginGate />} />
      </Routes>
    );
  }

  // Client-side routing below is a UX convenience — every API call is
  // re-authorized server-side regardless of which screen the SPA renders.
  return (
    <Shell>
      <Routes>
        {persona === 'staff' && (
          <>
            <Route path="/sales" element={<SalesWorkspace />} />
            <Route path="/edm" element={<EdmWorkspace />} />
            <Route path="*" element={<Navigate to="/sales" replace />} />
          </>
        )}
        {persona === 'customer' && (
          <>
            <Route path="/profile" element={<CustomerProfile />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/tickets/new" element={<NewTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </>
        )}
      </Routes>
    </Shell>
  );
}
