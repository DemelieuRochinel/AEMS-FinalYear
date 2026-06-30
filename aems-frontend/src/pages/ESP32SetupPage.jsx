import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { provisionApi } from '../api/provisionApi';

/**
 * Public instruction page — setup happens on the ESP32 SoftAP portal, not here.
 * This page validates a code (optional) and directs users to connect via AEMS-Setup-XXXX.
 */
export function ESP32SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialSetupCode = (
    location.state?.setupCode ||
    searchParams.get('code') ||
    ''
  ).replace(/\D/g, '').slice(0, 6);

  const [setupCode, setSetupCode] = useState(initialSetupCode);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(null);
  const [linkedDevice, setLinkedDevice] = useState(null);

  const handleValidate = async (e) => {
    e.preventDefault();
    setError('');
    setValidated(null);
    setLoading(true);

    if (!setupCode || !/^\d{6}$/.test(setupCode)) {
      setError('Please enter a valid 6-digit setup code');
      setLoading(false);
      return;
    }

    try {
      const result = await provisionApi.validateCode(setupCode);
      if (result.valid) {
        setValidated(result);
        setLinkedDevice(null);
      } else {
        setError('Invalid or expired setup code. Generate a new one from your dashboard.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkSimulator = async () => {
    setError('');
    setValidated(null);
    setLinkedDevice(null);

    if (!setupCode || !/^\d{6}$/.test(setupCode)) {
      setError('Please enter a valid 6-digit setup code');
      return;
    }

    setLinking(true);
    try {
      const result = await provisionApi.claimSimulatedDevice(setupCode);
      setLinkedDevice(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not link simulated ESP32');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e1b29',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        background: '#182a3d',
        border: '1px solid #243b54',
        borderRadius: '16px',
        padding: '40px',
        boxSizing: 'border-box',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: '#3b82f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '32px',
          }}>
            📡
          </div>
          <h1 style={{ color: '#ffffff', fontSize: '24px', margin: '0 0 8px 0' }}>
            Connect Your ESP32
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Configure your device using the ESP32 setup hotspot
          </p>
        </div>

        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h3 style={{ color: '#3b82f6', fontSize: '14px', margin: '0 0 12px 0' }}>
            How to connect
          </h3>
          <ol style={{
            color: '#94a3b8',
            fontSize: '13px',
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '2',
          }}>
            <li>Power on your ESP32 (first boot or after factory reset)</li>
            <li>On your phone, connect to WiFi <strong style={{ color: '#10b981' }}>AEMS-Setup-XXXX</strong></li>
            <li>Open <strong style={{ color: '#ffffff' }}>http://192.168.4.1</strong> in your browser</li>
            <li>Enter your office WiFi credentials and the <strong style={{ color: '#10b981' }}>6-digit setup code</strong> from your dashboard</li>
            <li>The ESP32 will reboot and appear online in your dashboard</li>
          </ol>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            color: '#f87171',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {validated && (
          <div style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            color: '#34d399',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            Code is valid. Enter it on the ESP32 setup page at 192.168.4.1 — do not enter it here.
          </div>
        )}

        {linkedDevice && (
          <div style={{
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '16px',
            color: '#34d399',
            fontSize: '14px',
            textAlign: 'left',
            lineHeight: 1.6,
          }}>
            <strong>Simulated ESP32 linked.</strong><br />
            Device ID: <span style={{ fontFamily: 'monospace' }}>{linkedDevice.device_id}</span><br />
            Restart the simulator with <span style={{ fontFamily: 'monospace', color: '#ffffff' }}>node src/test/simulateESP32.js</span>, then open the dashboard.
          </div>
        )}

        <form onSubmit={handleValidate}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#94a3b8',
              fontSize: '14px',
              marginBottom: '8px',
            }}>
              Optional: Check setup code validity
            </label>
            <input
              type="text"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: '#223a54',
                border: '1px solid #36506c',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '24px',
                fontWeight: 'bold',
                letterSpacing: '6px',
                textAlign: 'center',
                outline: 'none',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || linking}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#36506c' : '#223a54',
              border: '1px solid #36506c',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading || linking ? 'not-allowed' : 'pointer',
              marginBottom: '12px',
            }}
          >
            {loading ? 'Checking...' : 'Validate Code'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLinkSimulator}
          disabled={linking || loading || !!linkedDevice}
          style={{
            width: '100%',
            padding: '14px',
            background: '#10b981',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: linking || linkedDevice ? 'not-allowed' : 'pointer',
            opacity: linking || linkedDevice ? 0.75 : 1,
            marginBottom: '12px',
          }}
        >
          {linkedDevice ? 'Simulated ESP32 Linked' : linking ? 'Linking...' : 'Link Simulated ESP32'}
        </button>

        {linkedDevice && (
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '14px',
              background: '#223a54',
              border: '1px solid #36506c',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Go to Dashboard
          </button>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ color: '#64748b', fontSize: '12px' }}>
            Need a setup code?{' '}
            <span
              onClick={() => navigate('/login')}
              style={{ color: '#10b981', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Register or log in
            </span>
            {' '}then go to Devices.
          </p>
        </div>
      </div>
    </div>
  );
}
