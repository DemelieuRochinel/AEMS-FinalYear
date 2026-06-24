import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function RegistrationSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  
  // Get data from navigation state
  const { deviceName, deviceId, setupCode, businessId } = location.state || {};
  
  // If no data, redirect to login
  if (!setupCode) {
    navigate('/login');
    return null;
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(setupCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
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
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            background: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '36px'
          }}>
            🎉
          </div>
          <h1 style={{ color: '#10b981', fontSize: '28px', margin: 0 }}>
            Account Created!
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>
            Your AEMS system is ready. Configure your ESP32 to start monitoring.
          </p>
        </div>

        {/* Device Info Card */}
        <div style={{
          background: '#0e1b29',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', margin: 0 }}>
                Device Name
              </p>
              <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', margin: '4px 0 0 0' }}>
                {deviceName}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', margin: 0 }}>
                Status
              </p>
              <p style={{ color: '#fbbf24', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0 0' }}>
                ⏳ Awaiting Connection
              </p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #243b54', paddingTop: '16px' }}>
            <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Setup Code
            </p>
            <div style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#10b981',
              letterSpacing: '12px',
              fontFamily: 'monospace',
              padding: '16px',
              background: '#0a1622',
              borderRadius: '8px',
              border: '2px dashed #10b981'
            }}>
              {setupCode}
            </div>
            <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>
              ⏰ Expires in 15 minutes
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'left',
          marginBottom: '24px'
        }}>
          <h3 style={{ color: '#3b82f6', fontSize: '14px', margin: '0 0 12px 0' }}>
            🔧 How to Connect Your ESP32
          </h3>
          <ol style={{ 
            color: '#94a3b8', 
            fontSize: '13px', 
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '2'
          }}>
            <li>Copy the <strong style={{ color: '#10b981' }}>Setup Code</strong> above</li>
            <li>Run your ESP32 or <strong style={{ color: '#ffffff' }}>simulator</strong></li>
            <li>Enter the code when prompted for <strong style={{ color: '#ffffff' }}>provisioning</strong></li>
            <li>Your device will <strong style={{ color: '#10b981' }}>automatically connect</strong></li>
            <li>View real-time data on your <strong style={{ color: '#ffffff' }}>dashboard</strong></li>
          </ol>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={copyToClipboard}
            style={{
              padding: '12px 24px',
              background: copied ? '#10b981' : '#223a54',
              border: copied ? 'none' : '1px solid #36506c',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 'bold',
              flex: 1
            }}
          >
            {copied ? '✅ Copied!' : '📋 Copy Setup Code'}
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 24px',
              background: '#10b981',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 'bold',
              flex: 1
            }}
          >
            Go to Login
          </button>
        </div>

        <p style={{ 
          color: '#64748b', 
          fontSize: '12px', 
          marginTop: '16px',
          fontFamily: 'monospace'
        }}>
          Device ID: {deviceId}
        </p>
      </div>
    </div>
  );
}