import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

export default function RoomsPage() {
  const [rooms,   setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling,setToggling]= useState({});


  const fetchRooms = () => {
    api.get('/api/rooms')
      .then(r => setRooms(r.data.rooms || []))
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
    
    setToggling(p => ({ ...p, [room.id]: true }));
    try {
      await api.patch(`/api/rooms/${room.id}/relay`, {
        action, 
        device_id: room.device_id || 'device_BUEA001',
      });
      setRooms(prev => prev.map(r =>
        r.id === room.id ? { ...r, relay_status: action, status: action } : r
      ));
    } catch (err) {
      console.error('Relay toggle failed:', err.message);
    } finally {
      setToggling(p => ({ ...p, [room.id]: false }));
    }
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm("Are you sure you want to delete this room from your AEMS network?")) return;
    try {
      await api.delete(`/api/rooms/${roomId}`);
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch (err) {
      console.error('Failed to delete room:', err.message);
      alert('Could not delete room: ' + err.message);
    }
  };

  const turnAllOff = async () => {
    const activeRoomsOn = rooms.filter(r => (r.relay_status === 'ON' || r.status === 'ON'));
    if (activeRoomsOn.length === 0) return;
    await Promise.all(activeRoomsOn.map(room => toggleRelay(room)));
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-3)' }}>
      Loading rooms data stream...
    </div>
  );

  const occupied = rooms.filter(r => r.occupied).length;
  const powered  = rooms.filter(r => (r.relay_status === 'ON' || r.status === 'ON')).length;

  return (
    <div>
      {/* Clean Header Without Token Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700' }}>Room Control</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '4px' }}>
            {occupied} occupied · {powered} powered · {rooms.length} total
          </p>
        </div>
        <button
          onClick={turnAllOff}
          style={{
            padding:      '8px 18px',
            background:   'rgba(216,90,48,0.1)',
            border:       '1px solid rgba(216,90,48,0.3)',
            borderRadius: 'var(--radius-md)',
            color:        'var(--coral)',
            fontSize:     '12px',
            fontWeight:   '600',
            cursor:       'pointer',
          }}
        >
          Turn all off
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total rooms',     value: rooms.length,                       color: 'var(--text-1)' },
          { label: 'Occupied',        value: occupied,                            color: 'var(--teal)'   },
          { label: 'Powered on',      value: powered,                             color: 'var(--blue)'   },
          { label: 'Auto-shutdown',   value: rooms.filter(r=>r.auto_shutdown).length, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Room cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
        {rooms.map(room => {
          const isCurrentOn = room.relay_status === 'ON' || room.status === 'ON';
          return (
            <div key={room.id} style={{
              background:   'var(--bg-card)',
              border:       `1px solid ${room.occupied ? 'rgba(29,158,117,0.2)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding:      '20px',
              position:     'relative'
            }}>
              
              {/* Room header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-1)' }}>
                    {room.name || `Room (${room.id.replace('room_', '')})`}
                  </div>
                  <div style={{ fontSize:  '11px', color: room.occupied ? 'var(--teal)' : 'var(--text-3)', marginTop: '4px' }}>
                    {room.occupied ? '● Occupied' : '○ Empty'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Relay status toggle option */}
                  <button
                    onClick={() => toggleRelay(room)}
                    disabled={!!toggling[room.id]}
                    style={{
                      padding:      '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      border:       'none',
                      cursor:       'pointer',
                      fontSize:     '11px',
                      fontWeight:   '700',
                      background:   isCurrentOn ? 'rgba(29,158,117,0.15)' : 'rgba(71,85,105,0.2)',
                      color:        isCurrentOn ? 'var(--teal)' : 'var(--text-3)',
                    }}
                  >
                    {toggling[room.id] ? '...' : isCurrentOn ? 'ON' : 'OFF'}
                  </button>

                  {/* ❌ DELETE ROOM ACTION BUTTON */}
                  <button
                    onClick={() => deleteRoom(room.id)}
                    style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px'
                    }}
                    title="Delete Room"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Room details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Relay Identifier', value: room.relay_id || '--' },
                  { label: 'Device type',     value: room.device_type || 'General Equipment' },
                  { label: 'Auto-shutdown',   value: room.auto_shutdown ? 'Enabled' : 'Disabled', color: room.auto_shutdown ? 'var(--teal)' : 'var(--text-3)' },
                  { label: 'Last motion',     value: room.last_motion || room.timestamp
                      ? new Date(room.last_motion || room.timestamp).toLocaleTimeString('fr-CM', { hour:'2-digit', minute:'2-digit' })
                      : 'No log data' },
                ].map(d => (
                  <div key={d.label} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' }}>{d.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: d.color || 'var(--text-1)' }}>{d.value}</div>
                  </div>
                ))}
              </div>

              {/* Empty state timeline feedback */}
              {room.empty_since && !room.occupied && (
                <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(186,117,23,0.08)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--amber)', border: '1px solid rgba(186,117,23,0.15)' }}>
                  Empty since {new Date(room.empty_since).toLocaleTimeString('fr-CM', { hour:'2-digit', minute:'2-digit' })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddRoomCard />

    </div>
  );
}

// here is where ae add Rooms for the business created
function AddRoomCard() {
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [form,    setForm]    = useState({
    name: '', relay_id: 'relay_1', device_type: 'lights', auto_shutdown: true,
  });

  const submit = async () => {
    if (!form.name || !form.relay_id) { setMsg('Name and relay ID are required'); return; }
    setSaving(true);
    try {
      await api.post('/api/business/rooms', form);
      setMsg('Room created successfully! Refresh the Rooms page.');
      setForm({ name: '', relay_id: 'relay_1', device_type: 'lights', auto_shutdown: true });
      setTimeout(() => setOpen(false), 2000);
    } catch (err) {
      setMsg('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: open ? '20px' : '0' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal)' }}>
            Add New Room
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' }}>
            Configure a new room for monitoring and automation
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="btn btn-primary"
          style={{ fontSize: '12px', padding: '8px 16px' }}
        >
          {open ? '✕ Cancel' : '+ Add Room'}
        </button>
      </div>

      {open && (
        <>
          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--r-md)', marginBottom: '16px',
              background: msg.includes('success') ? 'rgba(29,158,117,0.1)' : 'rgba(216,90,48,0.1)',
              color: msg.includes('success') ? 'var(--teal)' : 'var(--coral)',
              border: `1px solid ${msg.includes('success') ? 'var(--teal)' : 'var(--coral)'}`,
              fontSize: '13px',
            }}>
              {msg}
            </div>
          )}

          <div className="grid-2">
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                Room name *
              </label>
              <input
                className="form-input"
                placeholder="e.g. Main Office"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                Relay ID *
              </label>
              <select
                className="form-input"
                value={form.relay_id}
                onChange={e => setForm(p => ({ ...p, relay_id: e.target.value }))}
              >
                {['relay_1','relay_2','relay_3','relay_4','relay_5','relay_6','relay_7','relay_8'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                Device type
              </label>
              <select
                className="form-input"
                value={form.device_type}
                onChange={e => setForm(p => ({ ...p, device_type: e.target.value }))}
              >
                {['lights','lights_and_fan','ac_and_lights','servers','machines','general', 'Computers'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '22px' }}>
              <input
                type="checkbox"
                id="auto_shutdown"
                checked={form.auto_shutdown}
                onChange={e => setForm(p => ({ ...p, auto_shutdown: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: 'var(--teal)', cursor: 'pointer' }}
              />
              <label htmlFor="auto_shutdown" style={{ fontSize: '13px', color: 'var(--text-1)', cursor: 'pointer' }}>
                Enable auto-shutdown
              </label>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={saving}
            className="btn btn-primary"
            style={{ marginTop: '16px', width: '100%' }}
          >
            {saving ? 'Creating room...' : 'Create Room'}
          </button>
        </>
      )}
    </div>
  );
}

