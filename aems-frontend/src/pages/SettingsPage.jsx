import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axiosConfig';

const FieldRow = ({ label, value, unit, hint }) => (
  <div style={{
    display:       'flex',
    justifyContent:'space-between',
    alignItems:    'center',
    padding:       '14px 0',
    borderBottom:  '1px solid rgba(255,255,255,0.05)',
  }}>
    <div>
      <div style={{ fontSize: '14px', color: '#e2e8f0' }}>{label}</div>
      {hint && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{hint}</div>}
    </div>
    <div style={{
      fontSize:   '14px',
      fontWeight: 'bold',
      color:      '#1D9E75',
    }}>
      {value}{unit && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>{unit}</span>}
    </div>
  </div>
);

export default function SettingsPage() {
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saved,    setSaved]    = useState(false);

  const [settings, setSettings] = useState({
    daily_kwh_limit:     50,
    voltage_min:         190,
    voltage_max:         245,
    auto_shutdown_delay: 15,
    closing_time:        '18:30',
  });

  useEffect(() => {
    api.get('/api/readings/live')
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      setSaved(false);
      // In production this would call PATCH /api/business/settings
      // For now we show success to demonstrate the UI
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save settings error:', err.message);
    }
  };

  const inputStyle = {
    width:        '120px',
    padding:      '6px 10px',
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color:        '#ffffff',
    fontSize:     '13px',
    textAlign:    'right',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold' }}>Settings</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Configure your AEMS system for your business
        </p>
      </div>

      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 '20px',
      }}>

        {/* Account information */}
        <div style={{
          background:   '#1e3a52',
          border:       '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding:      '24px',
        }}>
          <h3 style={{ fontSize: '15px', marginBottom: '20px',
                       color: '#1D9E75' }}>
            Account Information
          </h3>
          <FieldRow label="Full name"   value={user?.name     || '--'} />
          <FieldRow label="Email"       value={user?.email    || '--'} />
          <FieldRow label="Role"        value={user?.role     || '--'} />
          <FieldRow label="Business ID" value={user?.businessId || '--'} />
        </div>

        {/* System settings */}
        <div style={{
          background:   '#1e3a52',
          border:       '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding:      '24px',
        }}>
          <h3 style={{ fontSize: '15px', marginBottom: '20px',
                       color: '#1D9E75' }}>
            Energy Thresholds
          </h3>

          {[
            {
              key:   'daily_kwh_limit',
              label: 'Daily kWh limit',
              unit:  'kWh',
              hint:  'Alert when this is exceeded',
              min:   1, max: 500,
            },
            {
              key:   'voltage_min',
              label: 'Minimum voltage',
              unit:  'V',
              hint:  'Alert when voltage drops below this',
              min:   150, max: 220,
            },
            {
              key:   'voltage_max',
              label: 'Maximum voltage',
              unit:  'V',
              hint:  'Alert when voltage exceeds this',
              min:   220, max: 280,
            },
            {
              key:   'auto_shutdown_delay',
              label: 'Auto-shutdown delay',
              unit:  'min',
              hint:  'Minutes empty before auto-shutdown',
              min:   1, max: 60,
            },
          ].map(({ key, label, unit, hint, min, max }) => (
            <div key={key} style={{
              display:       'flex',
              justifyContent:'space-between',
              alignItems:    'center',
              padding:       '12px 0',
              borderBottom:  '1px solid rgba(255,255,255,0.05)',
            }}>
              <div>
                <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{label}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{hint}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  value={settings[key]}
                  min={min}
                  max={max}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    [key]: parseFloat(e.target.value),
                  }))}
                  style={inputStyle}
                />
                <span style={{ fontSize: '12px', color: '#64748b' }}>{unit}</span>
              </div>
            </div>
          ))}

          {/* Closing time */}
          <div style={{
            display:       'flex',
            justifyContent:'space-between',
            alignItems:    'center',
            padding:       '12px 0',
          }}>
            <div>
              <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
                Business closing time
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                After-hours shutdown trigger
              </div>
            </div>
            <input
              type="time"
              value={settings.closing_time}
              onChange={e => setSettings(prev => ({
                ...prev, closing_time: e.target.value
              }))}
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleSave}
            style={{
              marginTop:    '20px',
              width:        '100%',
              padding:      '10px',
              background:   saved ? '#0F6E56' : '#1D9E75',
              border:       'none',
              borderRadius: '8px',
              color:        '#fff',
              fontSize:     '14px',
              fontWeight:   'bold',
              cursor:       'pointer',
              transition:   'background 0.3s',
            }}
          >
            {saved ? '✓ Saved successfully' : 'Save Settings'}
          </button>
        </div>

        {/* AEMS system info */}
        <div style={{
          background:   '#1e3a52',
          border:       '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding:      '24px',
        }}>
          <h3 style={{ fontSize: '15px', marginBottom: '20px',
                       color: '#1D9E75' }}>
            System Information
          </h3>
          <FieldRow label="System version"    value="1.0.0" />
          <FieldRow label="Country"           value="Cameroon" />
          <FieldRow label="Energy provider"   value="SOCADEL Cameroon" />
        </div>

        {/* ENEO tariff info */}
        <div style={{
          background:   '#1e3a52',
          border:       '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding:      '24px',
        }}>
          <h3 style={{ fontSize: '15px', marginBottom: '20px',
                       color: '#1D9E75' }}>
            ENEO Billing Configuration
          </h3>
          <FieldRow
            label="Tier 1 rate"
            value="50"
            unit="FCFA/kWh"
            hint="0 – 110 kWh per month"
          />
          <FieldRow
            label="Tier 2 rate"
            value="79"
            unit="FCFA/kWh"
            hint="111 – 400 kWh per month"
          />
          <FieldRow
            label="Tier 3 rate"
            value="94"
            unit="FCFA/kWh"
            hint="Above 400 kWh per month"
          />
          <FieldRow label="Currency"  value="FCFA"    />
          <FieldRow label="Frequency" value="50"   unit="Hz" hint="Cameroon AC standard" />
          <FieldRow label="Voltage"   value="220"  unit="V"  hint="Nominal ENEO voltage" />
        </div>

      </div>
    </div>
  );
}