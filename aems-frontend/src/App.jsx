// ═══════════════════════════════════════════════════════════
//  AEMS FRONTEND — Main App
//  Automated Energy Management System
//  University of Buea — LEKEUGO DEMELIEU ROCHINEL FE22A247
// ═══════════════════════════════════════════════════════════

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider} from './context/AuthContext';
import { useAuth } from './hooks/useAuth';

import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomsPage     from './pages/RoomsPage';
import AlertsPage    from './pages/AlertsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage  from './pages/SettingsPage';
import Layout        from './components/layout/Layout';

import './App.css';

// ── Protected route — redirects to login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        height:          '100vh',
        background:      '#0d1b2a',
        color:           '#1D9E75',
        fontSize:        '18px',
        fontFamily:      'Arial, sans-serif',
      }}>
        Loading AEMS...
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes — all inside Layout (sidebar + topbar) */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index         element={<DashboardPage />} />
            <Route path="rooms"  element={<RoomsPage />}     />
            <Route path="alerts" element={<AlertsPage />}    />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings"  element={<SettingsPage />}  />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;