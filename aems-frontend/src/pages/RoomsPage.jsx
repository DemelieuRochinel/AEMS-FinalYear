import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

const DEVICE_TYPES = [
  { value: 'lights', label: 'Lighting' },
  { value: 'fan', label: 'Fan' },
  { value: 'ac', label: 'Air conditioner' },
  { value: 'ac_and_lights', label: 'AC and lighting' },
  { value: 'computers', label: 'Computers' },
  { value: 'servers', label: 'Servers' },
  { value: 'machines', label: 'Machines' },
  { value: 'sockets', label: 'Socket outlets' },
  { value: 'security', label: 'Security equipment' },
];

const formatDeviceType = (type) => (
  DEVICE_TYPES.find(item => item.value === type)?.label
  || String(type || 'Unassigned equipment').replace(/_/g, ' ')
);

const formatDateTime = (value) => (
  value
    ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'No motion yet'
);

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});

  const fetchRooms = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/rooms'),
      api.get('/api/device/list').catch(() => ({ data: { devices: [] } })),
    ])
      .then(([roomsRes, devicesRes]) => {
        setRooms(roomsRes.data.rooms || []);
        setDevices(devicesRes.data.devices || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const toggleRelay = async (room) => {
    if (toggling[room.id]) return;

    const currentStatus = room.relay_status || room.status || 'OFF';
    const action = currentStatus === 'ON' ? 'OFF' : 'ON';
    const deviceId = room.device_id || devices[0]?.id;

    if (!deviceId) {
      alert('No ESP32 is linked to this room. Assign an ESP32 before controlling the relay.');
      return;
    }

    setToggling(prev => ({ ...prev, [room.id]: true }));

    try {
      await api.patch(`/api/rooms/${room.id}/relay`, { action, device_id: deviceId });
      setRooms(prev => prev.map(item => (
        item.id === room.id ? { ...item, relay_status: action, status: action } : item
      )));
    } catch (err) {
      alert(`Failed to toggle relay: ${err.response?.data?.error || err.message}`);
    } finally {
      setToggling(prev => ({ ...prev, [room.id]: false }));
    }
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room from your AEMS network?')) return;

    try {
      await api.delete(`/api/rooms/${roomId}`);
      setRooms(prev => prev.filter(room => room.id !== roomId));
    } catch (err) {
      alert('Could not delete room: ' + (err.response?.data?.error || err.message));
    }
  };

  const turnAllOff = async () => {
    const activeRoomsOn = rooms.filter(room => room.relay_status === 'ON' || room.status === 'ON');
    for (const room of activeRoomsOn) {
      await toggleRelay(room);
    }
  };

  const occupied = rooms.filter(room => room.occupied).length;
  const powered = rooms.filter(room => room.relay_status === 'ON' || room.status === 'ON').length;

  if (loading && rooms.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-3)' }}>
        Loading rooms data stream...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700' }}>Room Control</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '4px' }}>
            {occupied} occupied - {powered} powered - {rooms.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={fetchRooms} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: '12px' }}>
            Refresh
          </button>
          <button
            onClick={turnAllOff}
            style={{
              padding: '8px 18px',
              background: 'rgba(216,90,48,0.1)',
              border: '1px solid rgba(216,90,48,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--coral)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Turn all off
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total rooms', value: rooms.length, color: 'var(--text-1)' },
          { label: 'Occupied', value: occupied, color: 'var(--teal)' },
          { label: 'Powered on', value: powered, color: 'var(--blue)' },
          { label: 'Auto-shutdown', value: rooms.filter(room => room.auto_shutdown).length, color: 'var(--amber)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
        {rooms.map(room => {
          const isCurrentOn = room.relay_status === 'ON' || room.status === 'ON';
          const linkedDevice = devices.find(device => device.id === room.device_id);

          return (
            <div key={room.id} style={{
              background: 'var(--bg-card)',
              border: `1px solid ${room.occupied ? 'rgba(29,158,117,0.2)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-1)' }}>
                    {room.name || 'Unnamed room'}
                  </div>
                  <div style={{ fontSize: '11px', color: room.occupied ? 'var(--teal)' : 'var(--text-3)', marginTop: '4px' }}>
                    {room.occupied ? 'Occupied' : 'Empty'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>
                    {linkedDevice?.device_name || 'No ESP32 assigned'}{room.floor ? ` - ${room.floor}` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => toggleRelay(room)}
                    disabled={!!toggling[room.id]}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: isCurrentOn ? 'rgba(29,158,117,0.15)' : 'rgba(71,85,105,0.2)',
                      color: isCurrentOn ? 'var(--teal)' : 'var(--text-3)',
                    }}
                  >
                    {toggling[room.id] ? '...' : isCurrentOn ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => deleteRoom(room.id)}
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Relay Identifier', value: room.relay_id || '--' },
                  { label: 'Device type', value: formatDeviceType(room.device_type) },
                  { label: 'Auto-shutdown', value: room.auto_shutdown ? '3 minutes' : 'Disabled', color: room.auto_shutdown ? 'var(--teal)' : 'var(--text-3)' },
                  { label: 'Last motion', value: formatDateTime(room.last_motion || room.timestamp) },
                ].map(detail => (
                  <div key={detail.label} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' }}>{detail.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: detail.color || 'var(--text-1)' }}>{detail.value}</div>
                  </div>
                ))}
              </div>

              {room.empty_since && !room.occupied && (
                <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(186,117,23,0.08)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--amber)', border: '1px solid rgba(186,117,23,0.15)' }}>
                  Empty since {formatDateTime(room.empty_since)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddRoomCard fetchRooms={fetchRooms} devices={devices} />
    </div>
  );
}

function AddRoomCard({ fetchRooms, devices }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    relay_id: 'relay_1',
    device_type: 'lights',
    auto_shutdown: true,
    device_id: '',
    floor: '',
  });

  const submit = async () => {
    if (!form.name || !form.relay_id) {
      setMsg('Name and relay ID are required');
      return;
    }

    setSaving(true);
    setMsg('');
    try {
      await api.post('/api/rooms', {
        ...form,
        device_id: form.device_id || devices[0]?.id || undefined,
      });
      setMsg('Room created successfully. Refreshing...');
      setForm({ name: '', relay_id: 'relay_1', device_type: 'lights', auto_shutdown: true, device_id: '', floor: '' });
      fetchRooms?.();
      setTimeout(() => {
        setOpen(false);
        setMsg('');
      }, 1200);
    } catch (err) {
      setMsg('Failed: ' + (err.response?.data?.message || err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: open ? '20px' : '0', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal)' }}>Add New Room</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' }}>
            Link a room to the ESP32 that controls its floor or panel
          </p>
        </div>
        <button onClick={() => setOpen(!open)} className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
          {open ? 'Cancel' : '+ Add Room'}
        </button>
      </div>

      {open && (
        <>
          {msg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--r-md)',
              marginBottom: '16px',
              background: msg.startsWith('Room') ? 'rgba(29,158,117,0.1)' : 'rgba(216,90,48,0.1)',
              color: msg.startsWith('Room') ? 'var(--teal)' : 'var(--coral)',
              border: `1px solid ${msg.startsWith('Room') ? 'var(--teal)' : 'var(--coral)'}`,
              fontSize: '13px',
            }}>
              {msg}
            </div>
          )}

          <div className="grid-2">
            <Field label="Room name *">
              <input className="form-input" placeholder="e.g. Main Office" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
            </Field>

            <Field label="ESP32 / floor">
              <select
                className="form-input"
                value={form.device_id}
                onChange={e => {
                  const device = devices.find(item => item.id === e.target.value);
                  setForm(prev => ({ ...prev, device_id: e.target.value, floor: prev.floor || device?.location || '' }));
                }}
              >
                <option value="">Use first available ESP32</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.device_name || 'Unnamed ESP32'}{device.location ? ` - ${device.location}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Relay ID *">
              <select className="form-input" value={form.relay_id} onChange={e => setForm(prev => ({ ...prev, relay_id: e.target.value }))}>
                {['relay_1', 'relay_2', 'relay_3', 'relay_4', 'relay_5', 'relay_6', 'relay_7', 'relay_8'].map(relay => (
                  <option key={relay} value={relay}>{relay}</option>
                ))}
              </select>
            </Field>

            <Field label="Device type">
              <select className="form-input" value={form.device_type} onChange={e => setForm(prev => ({ ...prev, device_type: e.target.value }))}>
                {DEVICE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Floor / area">
              <input className="form-input" placeholder="e.g. Floor 1" value={form.floor} onChange={e => setForm(prev => ({ ...prev, floor: e.target.value }))} />
            </Field>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '22px' }}>
              <input
                type="checkbox"
                id="auto_shutdown"
                checked={form.auto_shutdown}
                onChange={e => setForm(prev => ({ ...prev, auto_shutdown: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: 'var(--teal)', cursor: 'pointer' }}
              />
              <label htmlFor="auto_shutdown" style={{ fontSize: '13px', color: 'var(--text-1)', cursor: 'pointer' }}>
                Auto-shutdown after 3 minutes empty
              </label>
            </div>
          </div>

          <button onClick={submit} disabled={saving} className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }}>
            {saving ? 'Creating room...' : 'Create Room'}
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
