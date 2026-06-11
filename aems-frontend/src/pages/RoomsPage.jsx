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
    </div>
  );
}