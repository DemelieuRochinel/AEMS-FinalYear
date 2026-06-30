import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { provisionApi } from '../api/provisionApi';
import { DeviceSetupWizard } from '../components/DeviceSetupWizard';

function getProvisionState(device) {
  if (!device.provisioning_completed) return { label: 'Awaiting setup', color: '#fbbf24' };
  if (device.is_online) return { label: 'Connected', color: '#10b981' };
  return { label: 'Offline', color: '#ef4444' };
}

export function DeviceManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardDeviceId, setWizardDeviceId] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [currentDevice, setCurrentDevice] = useState('');

  const fetchDevices = useCallback(async () => {
    try {
      const response = await api.get('/api/device/list');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    const setupId = searchParams.get('setup');
    if (setupId) {
      setWizardDeviceId(setupId);
      setShowWizard(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const generateNewCode = async (deviceId, deviceName) => {
    try {
      const result = await provisionApi.generateSetupCode(deviceId);
      setCurrentCode(result.setup_code);
      setCurrentDevice(deviceName);
      setShowCode(true);
    } catch (error) {
      alert('Failed to generate setup code: ' + (error.response?.data?.message || error.message));
    }
  };

  const resetDevice = async (deviceId, deviceName) => {
    if (!window.confirm(`Reset "${deviceName}"? You will need to re-configure the ESP32 via the setup hotspot.`)) {
      return;
    }
    try {
      const result = await provisionApi.resetDevice(deviceId);
      setCurrentCode(result.setup_code);
      setCurrentDevice(deviceName);
      setShowCode(true);
      fetchDevices();
    } catch (error) {
      alert('Failed to reset device: ' + (error.response?.data?.message || error.message));
    }
  };

  const openWizardForDevice = (deviceId) => {
    setWizardDeviceId(deviceId);
    setShowWizard(true);
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#ffffff', marginBottom: '8px' }}>Device Management</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Connect ESP32 hardware and manage setup codes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => { setWizardDeviceId(null); setShowWizard(true); }}
          style={{
            padding: '12px 20px',
            background: '#10b981',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          + Connect New ESP32
        </button>
        <button
          type="button"
          onClick={fetchDevices}
          style={{
            padding: '12px 20px',
            background: '#223a54',
            border: '1px solid #36506c',
            borderRadius: '8px',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Refresh
        </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading devices...</p>
      ) : devices.length === 0 ? (
        <div style={{
          background: '#182a3d',
          border: '1px solid #243b54',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#94a3b8' }}>No devices yet</p>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
            Connect your first ESP32 to start monitoring energy
          </p>
          <button
            type="button"
            onClick={() => { setWizardDeviceId(null); setShowWizard(true); }}
            style={{
              padding: '12px 24px',
              background: '#10b981',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Connect ESP32
          </button>
        </div>
      ) : (
        devices.map((device) => {
          const state = getProvisionState(device);
          return (
            <div key={device.id} style={{
              background: '#182a3d',
              border: '1px solid #243b54',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ color: '#ffffff', margin: '0 0 4px' }}>{device.device_name}</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 8px' }}>
                    {device.location || 'No location'}
                  </p>
                  <p style={{ color: state.color, fontSize: '13px', margin: 0, fontWeight: 'bold' }}>
                    {state.label}
                    {device.mac_address && ` · MAC ${device.mac_address}`}
                    {device.firmware_version && ` - v${device.firmware_version}`}
                  </p>
                  {device.last_seen && (
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>
                      Last seen: {new Date(device.last_seen).toLocaleString()}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {!device.provisioning_completed && (
                    <>
                      <button
                        type="button"
                        onClick={() => openWizardForDevice(device.id)}
                        style={{
                          padding: '10px 16px', background: '#10b981', border: 'none',
                          borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 'bold',
                        }}
                      >
                        Continue Setup
                      </button>
                      <button
                        type="button"
                        onClick={() => generateNewCode(device.id, device.device_name)}
                        style={{
                          padding: '10px 16px', background: '#3b82f6', border: 'none',
                          borderRadius: '8px', color: '#fff', cursor: 'pointer',
                        }}
                      >
                        Setup Code
                      </button>
                    </>
                  )}
                  {device.provisioning_completed && (
                    <button
                      type="button"
                      onClick={() => resetDevice(device.id, device.device_name)}
                      style={{
                        padding: '10px 16px', background: '#223a54', border: '1px solid #36506c',
                        borderRadius: '8px', color: '#94a3b8', cursor: 'pointer',
                      }}
                    >
                      Factory Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {showWizard && (
        <DeviceSetupWizard
          initialDeviceId={wizardDeviceId}
          onClose={() => { setShowWizard(false); setWizardDeviceId(null); }}
          onComplete={fetchDevices}
        />
      )}

      {showCode && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px',
        }}>
          <div style={{
            background: '#182a3d', border: '2px solid #10b981', borderRadius: '16px',
            padding: '40px', maxWidth: '450px', width: '100%', textAlign: 'center',
          }}>
            <h3 style={{ color: '#10b981', marginBottom: '4px' }}>Setup Code</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>For: {currentDevice}</p>
            <div style={{
              fontSize: '56px', fontWeight: 'bold', color: '#10b981', letterSpacing: '12px',
              fontFamily: 'monospace', padding: '20px', background: '#0e1b29',
              borderRadius: '8px', border: '2px dashed #10b981', marginBottom: '12px',
            }}>
              {currentCode}
            </div>
            <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '20px' }}>
              Enter on ESP32 portal at http://192.168.4.1
            </p>
            <button
              type="button"
              onClick={() => setShowCode(false)}
              style={{
                padding: '12px 24px', background: '#10b981', border: 'none',
                borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 'bold',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

