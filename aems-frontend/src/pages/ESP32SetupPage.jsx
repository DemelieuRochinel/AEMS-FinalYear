import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { provisionApi } from '../api/provisionApi';
import api from '../api/axiosConfig';

export function ESP32SetupPage() {
  const [setupCode, setSetupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1); // 1: Enter Code, 2: Device Info, 3: Live Data
  const [deviceData, setDeviceData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!setupCode || !/^\d{6}$/.test(setupCode)) {
      setError('Please enter a valid 6-digit setup code');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Validate the code
      const validateResult = await provisionApi.validateCode(setupCode);
      
      if (!validateResult.valid) {
        setError('Invalid or expired setup code. Please generate a new one.');
        setLoading(false);
        return;
      }

      // Step 2: Claim the device
      const claimResult = await provisionApi.claimDevice({
        setup_code: setupCode,
        mac_address: 'UI_CLAIM_' + Date.now(),
        firmware_version: '1.0.0'
      });

      if (claimResult.success) {
        setSuccess('✅ Device claimed successfully!');
        setDeviceData({
          deviceId: claimResult.device_id,
          businessId: claimResult.business_id,
          configuration: claimResult.configuration
        });
        
        // Store device info
        localStorage.setItem('provisioned_device', JSON.stringify({
          deviceId: claimResult.device_id,
          businessId: claimResult.business_id,
          claimedAt: new Date().toISOString()
        }));
        
        // Move to step 2
        setStep(2);
        setIsConnected(true);
        
        // Start fetching live data after 2 seconds
        setTimeout(() => {
          fetchLiveData(claimResult.device_id);
          setStep(3);
        }, 2000);
      } else {
        setError(claimResult.message || 'Failed to claim device');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch live data from device
  const fetchLiveData = async (deviceId) => {
    try {
      const response = await api.get(`/api/readings/latest/${deviceId}`);
      if (response.data.success) {
        setLiveData(response.data.reading);
      }
    } catch (err) {
      console.error('Failed to fetch live data:', err);
    }
  };

  // Start polling for live data when step 3 is reached
  useEffect(() => {
    if (step === 3 && deviceData?.deviceId) {
      // Fetch immediately
      fetchLiveData(deviceData.deviceId);
      
      // Set up interval
      intervalRef.current = setInterval(() => {
        fetchLiveData(deviceData.deviceId);
      }, 3000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [step, deviceData]);

  // Handle reconnect
  const handleReconnect = () => {
    setStep(1);
    setSetupCode('');
    setDeviceData(null);
    setLiveData(null);
    setIsConnected(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e1b29',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        background: '#182a3d',
        border: '1px solid #243b54',
        borderRadius: '16px',
        padding: '40px',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: step === 3 ? '#10b981' : '#3b82f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '32px',
            transition: 'all 0.5s ease'
          }}>
            {step === 1 && '📡'}
            {step === 2 && '✅'}
            {step === 3 && '📊'}
          </div>
          <h1 style={{ color: '#ffffff', fontSize: '24px', margin: '0 0 8px 0' }}>
            {step === 1 && 'Connect Your ESP32'}
            {step === 2 && 'Device Connected!'}
            {step === 3 && 'Live Data Dashboard'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {step === 1 && 'Enter the setup code from your dashboard'}
            {step === 2 && 'Your device is ready to send data'}
            {step === 3 && `Device: ${deviceData?.deviceId || '--'}`}
          </p>
        </div>

        {/* Step 1: Enter Setup Code */}
        {step === 1 && (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                color: '#f87171',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid #10b981',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                color: '#34d399',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {success}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#94a3b8',
                fontSize: '14px',
                marginBottom: '8px'
              }}>
                Setup Code
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  autoFocus
                  style={{
                    flex: 1,
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
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.readText().then(text => {
                      const code = text.replace(/\D/g, '').slice(0, 6);
                      if (code.length === 6) {
                        setSetupCode(code);
                      }
                    }).catch(() => {});
                  }}
                  style={{
                    padding: '14px 16px',
                    background: '#223a54',
                    border: '1px solid #36506c',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '20px'
                  }}
                  title="Paste from clipboard"
                >
                  📋
                </button>
              </div>
              <p style={{
                color: '#64748b',
                fontSize: '12px',
                marginTop: '8px'
              }}>
                Enter the 6-digit code shown during device registration
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#36506c' : '#10b981',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? '⏳ Connecting...' : '🔗 Connect ESP32'}
            </button>

            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #243b54',
              textAlign: 'center'
            }}>
              <p style={{ color: '#64748b', fontSize: '12px' }}>
                Don't have a setup code?{' '}
                <span 
                  onClick={() => navigate('/login')}
                  style={{ 
                    color: '#10b981', 
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Register a new device
                </span>
              </p>
            </div>
          </form>
        )}

        {/* Step 2: Device Info */}
        {step === 2 && deviceData && (
          <div>
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid #10b981',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
              <h3 style={{ color: '#10b981', margin: 0, fontSize: '20px' }}>
                Device Connected Successfully!
              </h3>
              <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '14px' }}>
                Your ESP32 is now provisioned and ready
              </p>
            </div>

            <div style={{
              background: '#0e1b29',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Device ID</span>
                <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 'bold' }}>
                  {deviceData.deviceId}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Business ID</span>
                <span style={{ color: '#ffffff', fontSize: '14px' }}>
                  {deviceData.businessId}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Status</span>
                <span style={{ color: '#10b981', fontSize: '14px' }}>
                  🟢 Online
                </span>
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              color: '#64748b',
              fontSize: '14px'
            }}>
              <p>⏳ Connecting to live data stream...</p>
              <div style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: '3px solid #223a54',
                borderTop: '3px solid #10b981',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>

            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Step 3: Live Data Dashboard */}
        {step === 3 && (
          <div>
            {/* Quick Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                background: '#0e1b29',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                border: '1px solid #243b54'
              }}>
                <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 4px 0' }}>
                  ⚡ Voltage
                </p>
                <p style={{ 
                  color: '#fbbf24', 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  margin: 0 
                }}>
                  {liveData?.main?.voltage?.toFixed(1) || '--'}V
                </p>
              </div>

              <div style={{
                background: '#0e1b29',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                border: '1px solid #243b54'
              }}>
                <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 4px 0' }}>
                  💡 Power
                </p>
                <p style={{ 
                  color: '#60a5fa', 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  margin: 0 
                }}>
                  {liveData?.main?.power?.toFixed(1) || '--'}W
                </p>
              </div>

              <div style={{
                background: '#0e1b29',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                border: '1px solid #243b54'
              }}>
                <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 4px 0' }}>
                  🔋 Energy
                </p>
                <p style={{ 
                  color: '#34d399', 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  margin: 0 
                }}>
                  {liveData?.main?.energy_kwh?.toFixed(3) || '--'}kWh
                </p>
              </div>

              <div style={{
                background: '#0e1b29',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                border: '1px solid #243b54'
              }}>
                <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 4px 0' }}>
                  📡 Frequency
                </p>
                <p style={{ 
                  color: '#a78bfa', 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  margin: 0 
                }}>
                  {liveData?.main?.frequency?.toFixed(1) || '--'}Hz
                </p>
              </div>
            </div>

            {/* Room Status */}
            {liveData?.rooms && (
              <div style={{
                background: '#0e1b29',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '12px',
                border: '1px solid #243b54'
              }}>
                <h4 style={{ color: '#ffffff', margin: '0 0 12px 0', fontSize: '14px' }}>
                  🏠 Room Status
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                  gap: '8px'
                }}>
                  {Object.entries(liveData.rooms).map(([roomId, data]) => (
                    <div key={roomId} style={{
                      background: '#182a3d',
                      borderRadius: '6px',
                      padding: '10px',
                      textAlign: 'center'
                    }}>
                      <p style={{ 
                        color: data.occupied ? '#10b981' : '#64748b',
                        fontSize: '20px',
                        margin: 0
                      }}>
                        {data.occupied ? '👤' : '🏠'}
                      </p>
                      <p style={{ 
                        color: data.occupied ? '#10b981' : '#64748b',
                        fontSize: '10px',
                        margin: '4px 0 0 0',
                        fontWeight: 'bold'
                      }}>
                        {roomId.replace('room_', 'Room ')}
                      </p>
                      <p style={{ 
                        color: data.occupied ? '#10b981' : '#64748b',
                        fontSize: '10px',
                        margin: '2px 0 0 0'
                      }}>
                        {data.occupied ? 'Occupied' : 'Empty'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Relay Status */}
            {liveData?.relays && (
              <div style={{
                background: '#0e1b29',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '12px',
                border: '1px solid #243b54'
              }}>
                <h4 style={{ color: '#ffffff', margin: '0 0 12px 0', fontSize: '14px' }}>
                  🔌 Relay Status
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                  gap: '8px'
                }}>
                  {Object.entries(liveData.relays).map(([relayId, status]) => (
                    <div key={relayId} style={{
                      background: status === 'ON' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      borderRadius: '6px',
                      padding: '10px',
                      textAlign: 'center',
                      border: `1px solid ${status === 'ON' ? '#10b981' : '#ef4444'}`
                    }}>
                      <p style={{ 
                        color: status === 'ON' ? '#10b981' : '#ef4444',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        margin: 0
                      }}>
                        {relayId}
                      </p>
                      <p style={{ 
                        color: status === 'ON' ? '#10b981' : '#ef4444',
                        fontSize: '11px',
                        margin: '2px 0 0 0'
                      }}>
                        {status === 'ON' ? '🟢 ON' : '🔴 OFF'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Update info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px'
            }}>
              <p style={{ 
                color: '#64748b', 
                fontSize: '11px',
                margin: 0
              }}>
                🔄 Updating every 3 seconds
              </p>
              <p style={{ 
                color: '#64748b', 
                fontSize: '11px',
                margin: 0
              }}>
                Last update: {formatTime(liveData?.timestamp)}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #243b54'
            }}>
              <button
                onClick={() => {
                  if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                  }
                  navigate('/device-dashboard');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                📊 Full Dashboard
              </button>
              <button
                onClick={handleReconnect}
                style={{
                  padding: '12px 20px',
                  background: '#223a54',
                  border: '1px solid #36506c',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔄 New Device
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}