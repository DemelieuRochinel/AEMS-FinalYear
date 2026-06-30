
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider} from './context/AuthContext';
import { useAuth } from './hooks/useAuth';


//here is another new importation

import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomsPage     from './pages/RoomsPage';
import AlertsPage    from './pages/AlertsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage  from './pages/SettingsPage';
import Layout        from './components/layout/Layout';

// import { RegistrationSuccess } from './pages/RegistrationSuccess';
import { DeviceManagement } from './pages/DeviceManagement';
import { ESP32SetupPage } from './pages/ESP32SetupPage';


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

          {/* ── Public Routes ── */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* <Route path="/registration-success" element={<RegistrationSuccess />} /> */}

          <Route path="/setup-esp32" element={<ESP32SetupPage />} />

          {/* ── Protected routes — all inside Layout (sidebar + topbar) ── */}
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
            
            {/* ── NEW: Device Management Page (Protected) ── */}
            <Route path="devices" element={<DeviceManagement />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;