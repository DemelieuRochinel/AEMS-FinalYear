import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axiosConfig';
import { provisionApi } from '../api/provisionApi';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const Metric = ({ label, value, unit, color = '#1D9E75', sub }) => (
  <div className="stat-card" style={{ padding: '20px 16px' }}>
    <div className="stat-label">{label}</div>
    <div style={{ color }} className="stat-value">
      {value ?? '--'}
      {unit && (
        <span style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: '3px', fontWeight: '400' }}>
          {unit}
        </span>
      )}
    </div>
    {sub && <div className="stat-sub" style={{ marginTop: '6px' }}>{sub}</div>}
  </div>
);

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-md)',
      borderRadius: 'var(--r-md)',
      padding: '10px 14px',
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--text-3)', marginBottom: '6px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: '3px' }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const defaultHardware = {
  has_pzem: true,
  pzem_address: 1,
  num_relays: 4,
  num_pir: 1,
  num_acs712: 0,
  has_sd_card: false,
};

const deviceFormFromRecord = (device) => ({
  ...device,
  form: {
    name: device.device_name || '',
    location: device.location || '',
    hardware: { ...defaultHardware, ...(device.hardware || {}) },
  },
});

const NumberField = ({ label, value, min = 0, max = 16, onChange }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '92px' }}>
    <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase' }}>{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        color: 'var(--text-1)',
        padding: '10px 12px',
        fontSize: '13px',
        width: '100%',
      }}
    />
  </label>
);

const SimulatedEsp32Link = ({ onLinked }) => {
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const linkSimulator = async () => {
    const setupCode = code.replace(/\D/g, '').slice(0, 6);
    setMessage('');
    setError('');

    if (!/^\d{6}$/.test(setupCode)) {
      setError('Enter the 6-digit setup code first.');
      return;
    }

    setLinking(true);
    try {
      const result = await provisionApi.claimSimulatedDevice(setupCode);
      setCode('');
      setMessage(`Simulator linked to ${result.device_id}. Restart node src/test/simulateESP32.js to stream here.`);
      onLinked?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not link simulated ESP32.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="card mb-24" style={{
      border: '1px solid rgba(16,185,129,0.28)',
      background: 'rgba(16,185,129,0.08)',
      padding: '16px',
      display: 'grid',
      gridTemplateColumns: 'minmax(180px, 1fr) minmax(160px, 220px) auto',
      gap: '12px',
      alignItems: 'end',
    }}>
      <div style={{ textAlign: 'rigth' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--teal)' }}>
          Simulated ESP32 setup
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
          Paste the setup code generated during registration to link the fake ESP32 to this dashboard.
        </div>
        {(message || error) && (
          <div style={{ fontSize: '11px', color: error ? 'var(--coral)' : 'var(--teal)', marginTop: '8px' }}>
            {error || message}
          </div>
        )}
      </div>
      <input
        value={code}
        onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="6-digit code"
        maxLength={6}
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--text-1)',
          padding: '12px 14px',
          fontSize: '18px',
          fontWeight: '800',
          letterSpacing: '5px',
          textAlign: 'center',
          fontFamily: 'monospace',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        className="btn"
        onClick={linkSimulator}
        disabled={linking}
        style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}
      >
        {linking ? 'Linking...' : 'Link Simulator'}
      </button>
    </div>
  );
};

const DeviceConfigurationPanel = ({ rooms }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');
  const [setupCode, setSetupCode] = useState(null);
  const [newDevice, setNewDevice] = useState({
    name: '',
    location: '',
    hardware: defaultHardware,
  });

  const loadDevices = useCallback(async () => {
    try {
      const response = await api.get('/api/device/list');
      setDevices((response.data.devices || []).map(deviceFormFromRecord));
    } catch (error) {
      console.error('Device configuration load failed:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDevices, 0);
    return () => window.clearTimeout(timer);
  }, [loadDevices]);

  const patchDeviceForm = (deviceId, patcher) => {
    setDevices(prev => prev.map(device => (
      device.id === deviceId
        ? { ...device, form: patcher(device.form) }
        : device
    )));
  };

  const updateHardware = (deviceId, key, value) => {
    patchDeviceForm(deviceId, form => ({
      ...form,
      hardware: { ...form.hardware, [key]: value },
    }));
  };

  const saveDevice = async (device) => {
    setSavingId(device.id);
    setMessage('');

    try {
      const response = await api.patch(`/api/device/${device.id}/configuration`, {
        name: device.form.name,
        location: device.form.location,
        hardware: device.form.hardware,
      });

      setDevices(prev => prev.map(item => (
        item.id === device.id ? deviceFormFromRecord(response.data.device) : item
      )));
      setMessage('Device configuration saved.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Could not save device configuration.');
    } finally {
      setSavingId(null);
    }
  };

  const createDevice = async () => {
    if (!newDevice.name.trim()) {
      setMessage('Device name is required.');
      return;
    }

    setSavingId('new');
    setMessage('');

    try {
      await api.post('/api/device/new-device', {
        name: newDevice.name,
        location: newDevice.location,
        hardware: newDevice.hardware,
      });
      setNewDevice({ name: '', location: '', hardware: defaultHardware });
      await loadDevices();
      setMessage('Device added. Generate a setup code when the hardware is ready.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Could not add device.');
    } finally {
      setSavingId(null);
    }
  };

  const generateSetupCode = async (device) => {
    setSavingId(`code-${device.id}`);
    setMessage('');

    try {
      const result = await provisionApi.generateSetupCode(device.id);
      setSetupCode({
        code: result.setup_code,
        deviceName: device.device_name,
        expiresAt: result.expires_at,
      });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not generate setup code.');
    } finally {
      setSavingId(null);
    }
  };

  const roomCountForDevice = (deviceId) => rooms.filter(room => room.device_id === deviceId).length;

  return (
    <div className="card mb-24" style={{ padding: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>
            Device Configuration
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
            {devices.length} registered device{devices.length === 1 ? '' : 's'} · {rooms.length} configured room{rooms.length === 1 ? '' : 's'}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadDevices} style={{ padding: '8px 14px', fontSize: '12px' }}>
          Refresh
        </button>
        {message && (
          <div style={{ fontSize: '12px', color: message.includes('Could not') || message.includes('required') ? 'var(--coral)' : 'var(--teal)' }}>
            {message}
          </div>
        )}
      </div>

      {setupCode && (
        <div style={{
          border: '1px solid rgba(29,158,117,0.28)',
          background: 'rgba(29,158,117,0.08)',
          borderRadius: 'var(--r-md)',
          padding: '16px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '14px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ color: 'var(--text-2)', fontSize: '11px', marginBottom: '6px' }}>{setupCode.deviceName}</div>
            <div style={{ color: 'var(--teal)', fontSize: '32px', fontWeight: '800', letterSpacing: '8px', fontFamily: 'monospace' }}>
              {setupCode.code}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '6px' }}>
              Expires {new Date(setupCode.expiresAt).toLocaleTimeString('eng-CM', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button
            className="btn"
            onClick={() => navigator.clipboard.writeText(setupCode.code)}
            style={{ padding: '10px 16px', fontSize: '12px' }}
          >
            Copy Code
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Loading devices...</div>
        ) : devices.length > 0 ? devices.map(device => (
          <div key={device.id} style={{
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            borderRadius: 'var(--r-md)',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: device.is_online ? 'var(--teal)' : 'var(--coral)', fontWeight: '700', marginBottom: '5px' }}>
                  {device.is_online ? 'Online' : 'Offline'} · {device.provisioning_completed ? 'Provisioned' : 'Pending setup'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: '700' }}>{device.device_name || 'Unnamed ESP32'}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', textAlign: 'right' }}>
                {roomCountForDevice(device.id)} room{roomCountForDevice(device.id) === 1 ? '' : 's'}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase' }}>Device Name</span>
                <input
                  value={device.form.name}
                  onChange={event => patchDeviceForm(device.id, form => ({ ...form, name: event.target.value }))}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', padding: '10px 12px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase' }}>Location</span>
                <input
                  value={device.form.location}
                  onChange={event => patchDeviceForm(device.id, form => ({ ...form, location: event.target.value }))}
                  placeholder="Distribution board"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', padding: '10px 12px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                <NumberField label="Relays" value={device.form.hardware.num_relays} min={1} onChange={value => updateHardware(device.id, 'num_relays', value)} />
                <NumberField label="PIR" value={device.form.hardware.num_pir} onChange={value => updateHardware(device.id, 'num_pir', value)} />
                <NumberField label="ACS712" value={device.form.hardware.num_acs712} onChange={value => updateHardware(device.id, 'num_acs712', value)} />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-2)' }}>
                  <input type="checkbox" checked={device.form.hardware.has_pzem} onChange={event => updateHardware(device.id, 'has_pzem', event.target.checked)} />
                  PZEM
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => saveDevice(device)} disabled={savingId === device.id} style={{ padding: '9px 14px', fontSize: '12px' }}>
                {savingId === device.id ? 'Saving...' : 'Save Config'}
              </button>
              {!device.provisioning_completed && (
                <button className="btn btn-secondary" onClick={() => generateSetupCode(device)} disabled={savingId === `code-${device.id}`} style={{ padding: '9px 14px', fontSize: '12px' }}>
                  {savingId === `code-${device.id}` ? 'Generating...' : 'Setup Code'}
                </button>
              )}
            </div>
          </div>
        )) : (
          <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>
            No device has been registered yet.
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginTop: '18px', paddingTop: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase' }}>New Device</span>
          <input
            value={newDevice.name}
            onChange={event => setNewDevice(prev => ({ ...prev, name: event.target.value }))}
            placeholder="ESP32 main board"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', padding: '10px 12px', fontSize: '13px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase' }}>Location</span>
          <input
            value={newDevice.location}
            onChange={event => setNewDevice(prev => ({ ...prev, location: event.target.value }))}
            placeholder="Electrical panel"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-1)', padding: '10px 12px', fontSize: '13px' }}
          />
        </label>
        <NumberField label="Relays" value={newDevice.hardware.num_relays} min={1} onChange={value => setNewDevice(prev => ({ ...prev, hardware: { ...prev.hardware, num_relays: value } }))} />
        <NumberField label="PIR" value={newDevice.hardware.num_pir} onChange={value => setNewDevice(prev => ({ ...prev, hardware: { ...prev.hardware, num_pir: value } }))} />
        <NumberField label="ACS712" value={newDevice.hardware.num_acs712} onChange={value => setNewDevice(prev => ({ ...prev, hardware: { ...prev.hardware, num_acs712: value } }))} />
        <button className="btn" onClick={createDevice} disabled={savingId === 'new'} style={{ padding: '10px 16px', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {savingId === 'new' ? 'Adding...' : 'Add Device'}
        </button>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { user, business } = useAuth();
  const { connected, liveReading, alerts } = useSocket();

  const [bill, setBill] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [rooms, setRooms] = useState([]);

  const loadDashboard = useCallback(() => {
    return Promise.all([
      api.get('/api/bill/estimate').catch(() => null),
      api.get('/api/readings/today').catch(() => null),
      api.get('/api/rooms').catch(() => null),
    ]).then(([b, t, r]) => {
      if (b) setBill(b.data);
      if (r) setRooms(r.data.rooms || []);
      if (t) {
        const sampled = (t.data.chart_data || []).filter((_, i) => i % 10 === 0);
        setChartData(sampled.map(item => ({
          time: new Date(item.time).toLocaleTimeString('eng-CM', { hour: '2-digit', minute: '2-digit' }),
          power: Math.round(item.power || 0),
          voltage: Math.round(item.voltage || 0),
        })));
      }
    });
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await api.get('/api/rooms');
        setRooms(response.data.rooms || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchRooms();

    const interval = setInterval(fetchRooms, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!liveReading?.data?.main) return;
    const m = liveReading.data.main;
    const timer = window.setTimeout(() => setChartData(prev => [...prev.slice(-79), {
      time: new Date().toLocaleTimeString('eng-CM', { hour: '2-digit', minute: '2-digit' }),
      power: Math.round(m.power || 0),
      voltage: Math.round(m.voltage || 0),
    }]), 0);

    return () => window.clearTimeout(timer);
  }, [liveReading]);

  const m = liveReading?.data?.main;

  const voltageColor =
    m?.voltage < 190 ? 'var(--coral)' :
    m?.voltage > 245 ? 'var(--coral)' : 'var(--teal)';

  return (
    <div style={{ paddingBottom: '32px' }}>
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="page-title">Live Dashboard</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              {business?.name || user?.businessId || 'AEMS System'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>·</span>
            <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              {business?.location || 'Main Grid Node'}
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', fontWeight: '600',
              color: connected ? 'var(--teal)' : 'var(--coral)',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: connected ? 'var(--teal)' : 'var(--coral)',
              }} />
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={loadDashboard} style={{ padding: '8px 14px', fontSize: '12px' }}>
            Refresh
          </button>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-2)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '6px 12px',
          }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <SimulatedEsp32Link onLinked={loadDashboard} />

      {/* Metric Cards Grid */}
      <div className="grid-6 mb-24" style={{ gap: '16px' }}>
        <Metric label="Voltage" value={m?.voltage ? m.voltage.toFixed(1) : undefined} unit="V" color={voltageColor} sub="SOCADEL Supply" />
        <Metric label="Current" value={m?.current ? m.current.toFixed(1) : undefined} unit="A" color="var(--text-1)" sub="Total Draw" />
        <Metric label="Power" value={m?.power ? m.power.toFixed(0) : undefined} unit="W" color="var(--blue)" sub="Active Load" />
        <Metric label="Energy Today" value={m?.energy_kwh ? m.energy_kwh.toFixed(3) : undefined} unit="kWh" color="var(--amber)"
          sub={bill ? `${bill.current_cost_fcfa?.toLocaleString()} FCFA` : 'Calculating...'}
        />
        <Metric label="Frequency" value={m?.frequency ? m.frequency.toFixed(2) : undefined} unit="Hz" color="var(--text-1)" sub="AC Grid Sync" />
        <Metric label="Power Factor" value={m?.power_factor ? m.power_factor.toFixed(2) : undefined} unit=""
          color={m?.power_factor < 0.85 ? 'var(--amber)' : 'var(--teal)'}
          sub="Efficiency"
        />
      </div>

      {/* Bill banner */}
      {bill && (
        <div className="card mb-24" style={{
          border: '1px solid rgba(29,158,117,0.2)',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(29,158,117,0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '22px 24px',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>
              Estimated SOCADEL Bill — {bill.period}
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: 'var(--teal)' }}>
              {bill.projected_cost_fcfa?.toLocaleString()} FCFA
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
              Projected for full month · {bill.days_remaining} days remaining
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>Today So Far</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--amber)' }}>
              {bill.current_cost_fcfa?.toLocaleString()} FCFA
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
              SOCADEL tiered tariff applied
            </div>
          </div>
        </div>
      )}

      {/* Chart + Rooms Panel Layout Grid */}
<div className="dashboard-split mb-24">
        {/* Chart Component Panel */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '18px' }}>
            Power Consumption Trend
          </div>
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip content={customTooltip} />
                  <Line type="monotone" dataKey="power" stroke="var(--teal)" strokeWidth={2} dot={false} name="Power (W)" />
                  <Line type="monotone" dataKey="voltage" stroke="var(--amber)" strokeWidth={1.5} dot={false} name="Voltage (V)" strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
                {[
                  { color: 'var(--teal)', label: 'Power (W)', dash: false },
                  { color: 'var(--amber)', label: 'Voltage (V)', dash: true },
                ].map(({ color, label, dash }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-2)' }}>
                    <div style={{
                      width: '14px', height: '2px',
                      borderRadius: '1px',
                      borderTop: dash ? `2px dashed ${color}` : 'none',
                      background: dash ? 'none' : color,
                    }} />
                    {label}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{
              height: '220px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-3)',
              fontSize: '13px',
              gap: '8px',
            }}>
              <div style={{ fontSize: '24px' }}>📡</div>
              {connected ? 'Waiting for sensor metrics stream...' : 'Activate simulation telemetry to initialize live charts'}
            </div>
          )}
        </div>

        {/* Room Breakdowns Segment - SINGLE CORRECT VERSION */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '18px' }}>
            Room Status
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rooms.length > 0 ? rooms.map(room => (
              <div key={room.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--bg-input)',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${room.occupied ? 'rgba(29,158,117,0.2)' : 'var(--border)'}`,
              }}>
                <div>
                  {/* ✅ FIXED: Correctly displays room name or fallback */}
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-1)' }}>
                    {room.name || `Room ${room.id?.replace('room_', '') || 'Unknown'}`}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    marginTop: '3px',
                    color: room.occupied ? 'var(--teal)' : 'var(--text-3)',
                  }}>
                    {room.occupied ? '● Occupied' : '○ Empty'}
                  </div>
                </div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  background: room.occupied ? 'rgba(29,158,117,0.15)' : 'rgba(71,85,105,0.2)',
                  color: room.occupied ? 'var(--teal)' : 'var(--text-2)',
                }}>
                  {room.occupied ? 'ON' : 'OFF'}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-3)', fontSize: '12px', textAlign: 'center', padding: '32px 0' }}>
                No rooms configured.
              </div>
            )}
          </div>
        </div>
      </div>

      <DeviceConfigurationPanel rooms={rooms} />

      {/* Live Alerts Stream */}
      {alerts.length > 0 && (
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '14px' }}>
            System Intelligence Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.slice(0, 4).map(alert => (
              <div key={alert.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: 'var(--r-md)',
                fontSize: '12px',
                background: alert.severity === 'urgent' ? 'rgba(216,90,48,0.08)' : 'rgba(186,117,23,0.08)',
                border: `1px solid ${alert.severity === 'urgent' ? 'rgba(216,90,48,0.2)' : 'rgba(186,117,23,0.2)'}`,
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: alert.severity === 'urgent' ? 'var(--coral)' : 'var(--amber)',
                }} />
                <span style={{
                  fontWeight: '600',
                  color: alert.severity === 'urgent' ? 'var(--coral)' : 'var(--amber)',
                  textTransform: 'uppercase',
                  fontSize: '10px',
                  minWidth: '100px',
                }}>
                  {alert.type?.replace(/_/g, ' ')}
                </span>
                <span style={{ color: 'var(--text-2)' }}>
                  {alert.voltage && `${alert.voltage}V recorded `}
                  {alert.kwh && `${alert.kwh} kWh threshold cross `}
                  {alert.message || 'Anomaly mitigation trigger initialized.'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
