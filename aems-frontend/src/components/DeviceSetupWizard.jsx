import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { provisionApi } from '../api/provisionApi';
import { useSocket } from '../hooks/useSocket';

const STEPS = ['Device', 'Setup Code', 'Configure ESP32', 'Waiting', 'Done'];

function formatCountdown(expiresAt) {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DeviceSetupWizard({ onClose, onComplete, initialDeviceId = null }) {
  const navigate = useNavigate();
  const { deviceStatus } = useSocket();
  const pollRef = useRef(null);

  const [step, setStep] = useState(initialDeviceId ? 1 : 0);
  const [deviceName, setDeviceName] = useState('');
  const [deviceLocation, setDeviceLocation] = useState('');
  const [deviceId, setDeviceId] = useState(initialDeviceId || '');
  const [setupCode, setSetupCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setCountdown(formatCountdown(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const checkConnection = useCallback(async () => {
    if (!deviceId) return false;
    try {
      const status = await provisionApi.getProvisionStatus(deviceId);
      if (status.provisioning_completed && status.is_online) {
        setConnected(true);
        return true;
      }
      if (status.provisioning_completed) {
        setConnected(true);
        return true;
      }
    } catch {
      // ignore poll errors
    }
    return false;
  }, [deviceId]);

  useEffect(() => {
    if (step !== 3 || !deviceId) return undefined;

    checkConnection().then((ok) => {
      if (ok) setStep(4);
    });

    pollRef.current = setInterval(async () => {
      const ok = await checkConnection();
      if (ok) {
        setStep(4);
        clearInterval(pollRef.current);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, deviceId, checkConnection]);

  useEffect(() => {
    if (deviceId && deviceStatus[deviceId] === 'online' && step === 3) {
      setConnected(true);
      setStep(4);
    }
  }, [deviceStatus, deviceId, step]);

  const createDevice = async () => {
    if (!deviceName.trim()) {
      setError('Device name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/device/new-device', {
        name: deviceName.trim(),
        location: deviceLocation.trim() || null,
      });
      const id = res.data.deviceId || res.data.device?.id;
      setDeviceId(id);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await provisionApi.generateSetupCode(deviceId);
      setSetupCode(result.setup_code);
      setExpiresAt(result.expires_at);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate setup code');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(setupCode).catch(() => {});
  };

  const handleFinish = () => {
    onComplete?.();
    onClose?.();
    navigate('/rooms');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: '#182a3d',
        border: '1px solid #243b54',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>Connect ESP32</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {STEPS.map((label, i) => (
            <span
              key={label}
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: i <= step ? 'rgba(16,185,129,0.2)' : '#223a54',
                color: i <= step ? '#10b981' : '#64748b',
                border: `1px solid ${i <= step ? '#10b981' : '#36506c'}`,
              }}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '10px',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {step === 0 && (
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: 0 }}>
              Register a new ESP32 unit for your business.
            </p>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Device name</label>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Main Office Controller"
              style={{
                width: '100%', padding: '12px', marginBottom: '12px',
                background: '#223a54', border: '1px solid #36506c', borderRadius: '8px',
                color: '#fff', boxSizing: 'border-box',
              }}
            />
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Location (optional)</label>
            <input
              value={deviceLocation}
              onChange={(e) => setDeviceLocation(e.target.value)}
              placeholder="e.g. Ground floor"
              style={{
                width: '100%', padding: '12px', marginBottom: '16px',
                background: '#223a54', border: '1px solid #36506c', borderRadius: '8px',
                color: '#fff', boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={createDevice}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', background: '#10b981', border: 'none',
                borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Continue'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Generate a one-time setup code for this device.
            </p>
            <button
              type="button"
              onClick={generateCode}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', background: '#3b82f6', border: 'none',
                borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              {loading ? 'Generating...' : 'Generate Setup Code'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{
              fontSize: '48px', fontWeight: 'bold', color: '#10b981', letterSpacing: '10px',
              fontFamily: 'monospace', textAlign: 'center', padding: '16px',
              background: '#0e1b29', borderRadius: '8px', border: '2px dashed #10b981', marginBottom: '8px',
            }}>
              {setupCode}
            </div>
            <p style={{ color: '#ef4444', fontSize: '12px', textAlign: 'center', margin: '0 0 16px' }}>
              Expires in {countdown || '15:00'}
            </p>
            <div style={{
              background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f6',
              borderRadius: '12px', padding: '16px', marginBottom: '16px',
            }}>
              <h3 style={{ color: '#3b82f6', fontSize: '14px', margin: '0 0 10px' }}>Configure on ESP32</h3>
              <ol style={{ color: '#94a3b8', fontSize: '13px', margin: 0, paddingLeft: '18px', lineHeight: '1.9' }}>
                <li>Power on your ESP32</li>
                <li>Connect phone to WiFi <strong style={{ color: '#10b981' }}>AEMS-Setup-XXXX</strong></li>
                <li>Open <strong style={{ color: '#fff' }}>http://192.168.4.1</strong></li>
                <li>Select your office WiFi and enter this setup code</li>
              </ol>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={copyCode} style={{
                flex: 1, padding: '12px', background: '#223a54', border: '1px solid #36506c',
                borderRadius: '8px', color: '#fff', cursor: 'pointer',
              }}>
                Copy Code
              </button>
              <button type="button" onClick={() => setStep(3)} style={{
                flex: 1, padding: '12px', background: '#10b981', border: 'none',
                borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
              }}>
                I&apos;ve configured the ESP32
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: '40px', height: '40px', margin: '0 auto 16px',
              border: '3px solid #223a54', borderTop: '3px solid #10b981',
              borderRadius: '50%', animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#fff', fontWeight: 'bold' }}>Waiting for ESP32 to connect...</p>
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>
              The device will claim the setup code and appear online automatically.
            </p>
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h3 style={{ color: '#10b981', margin: '0 0 8px' }}>Device Connected!</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
              Your ESP32 is provisioned{connected ? ' and online' : ''}. Four default rooms were created — rename them on the Rooms page.
            </p>
            <button type="button" onClick={handleFinish} style={{
              width: '100%', padding: '12px', background: '#10b981', border: 'none',
              borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
            }}>
              Go to Rooms
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
