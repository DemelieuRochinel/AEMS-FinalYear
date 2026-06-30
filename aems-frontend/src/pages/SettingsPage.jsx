import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';
import api from '../api/axiosConfig';

const DEFAULT_SETTINGS = {
  daily_kwh_limit:     50,
  voltage_min:         190,
  voltage_max:         245,
  auto_shutdown_delay: 3,
  closing_time:        '18:30',
};

const Field = ({ label, value, hint, editMode, name, onChange, type = 'text' }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0', borderBottom: '1px solid var(--border)',
  }}>
    <div>
      <div style={{ fontSize: '13px', color: 'var(--text-1)' }}>{label}</div>
      {hint && <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>{hint}</div>}
    </div>
    {editMode ? (
      <input
        type={type}
        name={name}
        defaultValue={value}
        onChange={onChange}
        className="form-input"
        style={{ width: '180px', fontSize: '13px', padding: '6px 10px' }}
      />
    ) : (
      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--teal)' }}>
        {value || '--'}
      </div>
    )}
  </div>
);

export default function SettingsPage() {
  const { user, business, updateBusiness } = useAuth();

  const [editProfile,  setEditProfile]  = useState(false);
  const [editSettings, setEditSettings] = useState(false);
  const [profileData,  setProfileData]  = useState({});
  const [settings,     setSettings]     = useState(DEFAULT_SETTINGS);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');
  const [predBill, setPredBill] = useState(null);
  const displayedSettings = editSettings
    ? settings
    : { ...DEFAULT_SETTINGS, ...(business?.settings || {}) };

  useEffect(() => {
    // Fetch bil prediction
    api.get('/api/bill/estimate').then(r => {
      setPredBill(r.data);
    }).catch(() => {});
  }, [business]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.patch('/api/business/profile', profileData);
      updateBusiness(res.data.business);
      setEditProfile(false);
      setSaveMsg('Profile updated successfully');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.patch('/api/business/settings', settings);
      updateBusiness({ settings });
      setEditSettings(false);
      setSaveMsg('Settings saved successfully');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const drawTable = (doc, startY, columns, rows, widths) => {
    const startX = 20;
    const rowHeight = 10;
    let y = startY;

    doc.setFillColor(7, 21, 38);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    let x = startX;
    columns.forEach((column, index) => {
      doc.rect(x, y, widths[index], rowHeight, 'F');
      doc.text(column, x + 3, y + 6.5);
      x += widths[index];
    });

    y += rowHeight;
    doc.setTextColor(20, 24, 33);
    rows.forEach((row, rowIndex) => {
      x = startX;
      doc.setFillColor(rowIndex % 2 === 0 ? 245 : 255, rowIndex % 2 === 0 ? 248 : 255, rowIndex % 2 === 0 ? 252 : 255);
      row.forEach((cell, index) => {
        doc.rect(x, y, widths[index], rowHeight, 'FD');
        doc.text(String(cell), x + 3, y + 6.5);
        x += widths[index];
      });
      y += rowHeight;
    });

    return y + 8;
  };

  const downloadBill = () => {
    if (!predBill) return;

    const doc = new jsPDF();
    const nextMonthBill = Math.round((predBill.projected_cost_fcfa || 0) * 1.05);

    doc.setFillColor(7, 21, 38);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('AEMS ENERGY BILL REPORT', 20, 18);
    doc.setFontSize(10);
    doc.text('Automated Energy Management System', 20, 26);

    doc.setTextColor(20, 24, 33);
    doc.setFontSize(12);
    let y = drawTable(doc, 45, ['Business', 'Owner', 'Period'], [[
      business?.name || 'N/A',
      business?.owner_name || user?.name || 'N/A',
      predBill.period || 'N/A',
    ]], [55, 70, 45]);

    doc.setFontSize(14);
    doc.text('Consumption Summary', 20, y);
    y = drawTable(doc, y + 6, ['Metric', 'Value'], [
      ['Current consumption', `${Number(predBill.current_kwh || 0).toFixed(3)} kWh`],
      ['Current cost', `${predBill.current_cost_fcfa?.toLocaleString() || 0} FCFA`],
      ['Projected consumption', `${Number(predBill.projected_kwh || 0).toFixed(1)} kWh`],
      ['Projected bill', `${predBill.projected_cost_fcfa?.toLocaleString() || 0} FCFA`],
      ['Days passed', predBill.days_passed || 0],
      ['Days remaining', predBill.days_remaining || 0],
    ], [85, 85]);

    doc.setFontSize(14);
    doc.text('ENEO Tariff Structure', 20, y);
    y = drawTable(doc, y + 6, ['Tier', 'Consumption Range', 'Rate'], [
      ['Tier 1', '0 - 110 kWh', '50 FCFA/kWh'],
      ['Tier 2', '111 - 400 kWh', '79 FCFA/kWh'],
      ['Tier 3', '400+ kWh', '94 FCFA/kWh'],
    ], [40, 75, 55]);

    doc.setFillColor(232, 245, 240);
    doc.rect(20, y, 170, 22, 'F');
    doc.setTextColor(29, 158, 117);
    doc.setFontSize(12);
    doc.text('Predicted Next Month Bill', 26, y + 8);
    doc.setFontSize(18);
    doc.text(`${nextMonthBill.toLocaleString()} FCFA`, 26, y + 17);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString('en-US')}`, 20, 270);
    doc.text('Generated by AEMS - Automated Energy Management System', 20, 278);

    doc.save(`AEMS_Bill_${predBill.period?.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Configure your AEMS system</p>
        </div>
      </div>

      {saveMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 'var(--r-md)',
          background: saveMsg.includes('failed') ? 'rgba(216,90,48,0.1)' : 'rgba(29,158,117,0.1)',
          border: `1px solid ${saveMsg.includes('failed') ? 'var(--coral)' : 'var(--teal)'}`,
          color: saveMsg.includes('failed') ? 'var(--coral)' : 'var(--teal)',
          fontSize: '13px', marginBottom: '20px',
        }}>
          {saveMsg}
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '20px' }}>

        {/* Account information */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal)' }}>
              Account Information
            </h3>
            <button
              onClick={() => editProfile ? saveProfile() : setEditProfile(true)}
              className="btn"
              style={{
                padding: '6px 14px', fontSize: '12px',
                background: editProfile ? 'var(--teal)' : 'transparent',
                border: editProfile ? 'none' : '1px solid var(--border-md)',
                color: editProfile ? '#fff' : 'var(--text-2)',
              }}
            >
              {saving ? 'Saving...' : editProfile ? '✓ Save' : '✏️ Edit'}
            </button>
          </div>

          <Field label="Full name"    value={user?.name || business?.owner_name}
            editMode={editProfile} name="owner_name"
            onChange={e => setProfileData(p => ({ ...p, owner_name: e.target.value }))} />
          <Field label="Email"        value={user?.email || business?.owner_email}
            editMode={false} />
          <Field label="Phone"        value={business?.owner_phone}
            editMode={editProfile} name="owner_phone"
            onChange={e => setProfileData(p => ({ ...p, owner_phone: e.target.value }))} />
          <Field label="Business name" value={business?.name}
            editMode={editProfile} name="name"
            onChange={e => setProfileData(p => ({ ...p, name: e.target.value }))} />
          <Field label="Location"     value={business?.location}
            editMode={editProfile} name="location"
            onChange={e => setProfileData(p => ({ ...p, location: e.target.value }))} />
          <Field label="Role"         value={user?.role} editMode={false} />

          {editProfile && (
            <button
              onClick={() => setEditProfile(false)}
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Energy settings */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal)' }}>
              Energy Thresholds
            </h3>
            <button
              onClick={() => {
                if (editSettings) {
                  saveSettings();
                } else {
                  setSettings(displayedSettings);
                  setEditSettings(true);
                }
              }}
              className="btn"
              style={{
                padding: '6px 14px', fontSize: '12px',
                background: editSettings ? 'var(--teal)' : 'transparent',
                border: editSettings ? 'none' : '1px solid var(--border-md)',
                color: editSettings ? '#fff' : 'var(--text-2)',
              }}
            >
              {saving ? 'Saving...' : editSettings ? '✓ Save' : '✏️ Edit'}
            </button>
          </div>

          {[
            { key: 'daily_kwh_limit',     label: 'Daily kWh limit',      unit: 'kWh', hint: 'Alert when exceeded',                  min: 1,   max: 500 },
            { key: 'voltage_min',          label: 'Min voltage',          unit: 'V',   hint: 'Alert below this voltage',            min: 150, max: 220 },
            { key: 'voltage_max',          label: 'Max voltage',          unit: 'V',   hint: 'Alert above this voltage',            min: 220, max: 280 },
            { key: 'auto_shutdown_delay',  label: 'Auto-shutdown delay',  unit: 'min', hint: 'Minutes empty before auto-shutdown',  min: 1,   max: 120 },
          ].map(({ key, label, unit, hint, min, max }) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-1)' }}>{label}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{hint}</div>
              </div>
              {editSettings ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number" min={min} max={max}
                    value={settings[key]}
                    onChange={e => setSettings(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                    className="form-input"
                    style={{ width: '80px', textAlign: 'right', fontSize: '13px', padding: '6px 8px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{unit}</span>
                </div>
              ) : (
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--teal)' }}>
                  {displayedSettings[key]} <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{unit}</span>
                </span>
              )}
            </div>
          ))}

          {/* Closing time */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-1)' }}>Closing time</div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>After-hours shutdown trigger</div>
            </div>
            {editSettings ? (
              <input
                type="time" value={settings.closing_time}
                onChange={e => setSettings(p => ({ ...p, closing_time: e.target.value }))}
                className="form-input"
                style={{ width: '100px', fontSize: '13px', padding: '6px 8px' }}
              />
            ) : (
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--teal)' }}>
                {displayedSettings.closing_time}
              </span>
            )}
          </div>

          {editSettings && (
            <button
              onClick={() => setEditSettings(false)}
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Bill prediction + download */}
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal)' }}>
              Bill Prediction
            </h3>
            <button onClick={downloadBill} className="btn btn-ghost"
              style={{ fontSize: '12px', padding: '6px 14px' }}>
              ⬇ Download PDF
            </button>
          </div>

          {predBill ? (
            <>
              {[
                { label: 'Period',              value: predBill.period,                                     color: 'var(--text-1)'   },
                { label: 'Current consumption', value: `${predBill.current_kwh} kWh`,                       color: 'var(--text-1)'   },
                { label: 'Current cost',        value: `${predBill.current_cost_fcfa?.toLocaleString()} FCFA`, color: 'var(--amber)'  },
                { label: 'Projected full month',value: `${predBill.projected_kwh?.toFixed(1)} kWh`,          color: 'var(--text-1)'   },
                { label: 'Projected bill',      value: `${predBill.projected_cost_fcfa?.toLocaleString()} FCFA`, color: 'var(--coral)' },
                { label: 'Days remaining',      value: predBill.days_remaining,                              color: 'var(--text-1)'   },
              ].map(r => (
                <div key={r.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{r.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: r.color }}>{r.value}</span>
                </div>
              ))}

              {/* Next month prediction */}
              <div style={{
                marginTop: '14px', padding: '14px',
                background: 'rgba(29,158,117,0.07)',
                borderRadius: 'var(--r-md)',
                border: '1px solid rgba(29,158,117,0.2)',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>
                  Predicted next month bill
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--teal)' }}>
                  ~{Math.round((predBill.projected_cost_fcfa || 0) * 1.05).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                  Based on current consumption patterns (+5% growth factor)
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
              Loading bill data...
            </div>
          )}
        </div>

        {/* System + ENEO info */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal)', marginBottom: '16px' }}>
            System Information
          </h3>
          {[
            { label: 'System version',   value: '1.0.0'                         },
            { label: 'Developer',        value: 'LEKEUGO DEMELIEU ROCHINEL'      },
            { label: 'Energy provider',  value: 'ENEO/SOCADEL Cameroon'                  },
          ].map(r => (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{r.label}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }}>{r.value}</span>
            </div>
          ))}

          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--teal)', marginBottom: '12px' }}>
              ENEO Billing Configuration
            </h4>
            {[
              { label: 'Tier 1', range: '0 - 110 kWh',   rate: '50 FCFA/kWh', color: 'var(--teal)'  },
              { label: 'Tier 2', range: '111 - 400 kWh', rate: '79 FCFA/kWh', color: 'var(--amber)' },
              { label: 'Tier 3', range: '400+ kWh',      rate: '94 FCFA/kWh', color: 'var(--coral)' },
            ].map(t => (
              <div key={t.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', borderRadius: 'var(--r-md)', marginBottom: '6px',
                background: 'var(--bg-input)', borderLeft: `3px solid ${t.color}`,
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: t.color }}>{t.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>{t.range}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-1)' }}>{t.rate}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Room form */}
    </div>
  );
}









