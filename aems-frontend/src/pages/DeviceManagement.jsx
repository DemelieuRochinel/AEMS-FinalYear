import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axiosConfig';
import { provisionApi } from '../api/provisionApi';

export function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [currentDevice, setCurrentDevice] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      // This endpoint needs to be added to your backend
      const response = await api.get('/api/device/list');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      // If endpoint doesn't exist yet, show empty state
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div style={{ 
      padding: '24px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#ffffff', marginBottom: '8px' }}>Device Management</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
        Manage your ESP32 devices and generate setup codes
      </p>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading devices...</p>
      ) : devices.length === 0 ? (
        <div style={{
          background: '#182a3d',
          border: '1px solid #243b54',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#94a3b8' }}>No devices found</p>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Register your first device during account setup
          </p>
        </div>
      ) : (
        devices.map(device => (
          <div key={device.id} style={{
            background: '#182a3d',
            border: '1px solid #243b54',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h3 style={{ color: '#ffffff', margin: 0 }}>{device.device_name}</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0' }}>
                ID: {device.id}
              </p>
              <p style={{ 
                color: device.is_online ? '#10b981' : '#ef4444',
                fontSize: '13px',
                margin: 0
              }}>
                {device.is_online ? '🟢 Online' : '🔴 Offline'}
              </p>
            </div>
            <button
              onClick={() => generateNewCode(device.id, device.device_name)}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔑 Generate Setup Code
            </button>
          </div>
        ))
      )}

      {/* Setup Code Modal */}
      {showCode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#182a3d',
            border: '2px solid #10b981',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '450px',
            width: '100%',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#10b981', marginBottom: '4px' }}>
              📱 Setup Code
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
              For device: {currentDevice}
            </p>
            <div style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#10b981',
              letterSpacing: '12px',
              fontFamily: 'monospace',
              padding: '20px',
              background: '#0e1b29',
              borderRadius: '8px',
              border: '2px dashed #10b981',
              marginBottom: '20px'
            }}>
              {currentCode}
            </div>
            <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '20px' }}>
              ⏰ Expires in 15 minutes
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentCode);
                  alert('Code copied to clipboard!');
                }}
                style={{
                  padding: '12px 24px',
                  background: '#223a54',
                  border: '1px solid #36506c',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                📋 Copy
              </button>
              <button
                onClick={() => setShowCode(false)}
                style={{
                  padding: '12px 24px',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}