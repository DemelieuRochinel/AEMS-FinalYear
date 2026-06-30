import { useState } from 'react';

export function SetupCodeModal({ 
  deviceName, 
  deviceId, 
  setupCode, 
  onClose,
  closeLabel = 'Continue',
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(setupCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = setupCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#182a3d',
        border: '2px solid #10b981',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
      }}>
        {/* Success Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          background: '#10b981',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '32px'
        }}>
          ✅
        </div>

        <h2 style={{ 
          color: '#10b981', 
          marginBottom: '4px',
          fontSize: '24px',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          Registration Complete!
        </h2>
        <p style={{ 
          color: '#94a3b8', 
          marginBottom: '20px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          Your device is ready to be configured
        </p>

        {/* Device Info */}
        <div style={{
          background: '#0e1b29',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Device Name
              </p>
              <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold' }}>
                {deviceName}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Status
              </p>
              <p style={{ color: '#fbbf24', fontSize: '14px', fontWeight: 'bold' }}>
                ⏳ Awaiting Connection
              </p>
            </div>
          </div>
          
          <p style={{ 
            color: '#64748b', 
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '4px'
          }}>
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
            border: '2px dashed #10b981',
            userSelect: 'all',
            textAlign: 'center',
            marginBottom: '8px'
          }}>
            {setupCode}
          </div>
          <p style={{ 
            color: '#ef4444', 
            fontSize: '12px',
            textAlign: 'center'
          }}>
            ⏰ Expires in 15 minutes
          </p>
        </div>

        {/* ⭐ NEW: Next Steps Instructions */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ 
            color: '#10b981', 
            fontSize: '14px', 
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📋 Next Steps
          </h3>
          <ol style={{ 
            color: '#94a3b8', 
            fontSize: '13px', 
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '1.8'
          }}>
            <li>Copy the <strong style={{ color: '#10b981' }}>Setup Code</strong> above</li>
            <li>Power on your ESP32 and connect to WiFi <strong style={{ color: '#10b981' }}>AEMS-Setup-XXXX</strong></li>
            <li>Open <strong style={{ color: '#ffffff' }}>http://192.168.4.1</strong> on your phone</li>
            <li>Enter your office WiFi credentials and the setup code</li>
            <li>Your device will connect and appear on the dashboard</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={copyToClipboard}
            style={{
              padding: '12px 24px',
              background: copied ? '#10b981' : '#223a54',
              border: copied ? 'none' : '1px solid #36506c',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '140px',
              fontWeight: 'bold'
            }}
          >
            {copied ? '✅ Copied!' : '📋 Copy Code'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 'bold',
              minWidth: '140px'
            }}
          >
            {closeLabel}
          </button>
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #243b54'
        }}>
          <p style={{ 
            color: '#64748b', 
            fontSize: '11px',
            textAlign: 'center',
            fontFamily: 'monospace'
          }}>
            Device ID: {deviceId}
          </p>
          <p style={{ 
            color: '#94a3b8', 
            fontSize: '12px',
            textAlign: 'center',
            marginTop: '4px'
          }}>
            💡 You can also find this code in the Device Management page
          </p>
        </div>
      </div>
    </div>
  );
}
