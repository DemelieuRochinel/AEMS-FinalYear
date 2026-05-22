import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

export default function RoomsPage() {
  const [rooms,   setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/rooms')
      .then(res => setRooms(res.data.rooms || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const toggleRelay = async (room) => {
    const action = room.relay_status === 'ON' ? 'OFF' : 'ON';
    try {
      await api.patch(`/api/rooms/${room.id}/relay`, {
        action,
        device_id: room.device_id,
      });
      setRooms(prev => prev.map(r =>
        r.id === room.id ? { ...r, relay_status: action } : r
      ));
    } catch (err) {
      console.error('Relay toggle failed:', err.message);
    }
  };

  if (loading) return (
    <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
      Loading rooms...
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: '22px', marginBottom: '8px' }}>Room Control</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
        Control and monitor all rooms in your SME
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px',
      }}>
        {rooms.map(room => (
          <div key={room.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>{room.name}</h3>
                <div style={{
                  fontSize: '12px',
                  color: room.occupied ? 'var(--color-teal)' : 'var(--text-muted)',
                }}>
                  {room.occupied ? '● Occupied' : '○ Empty'}
                </div>
              </div>
              <button
                onClick={() => toggleRelay(room)}
                className="btn"
                style={{
                  background: room.relay_status === 'ON'
                    ? 'var(--color-teal)'
                    : 'rgba(100,116,139,0.3)',
                  color: 'white',
                  padding: '6px 16px',
                  fontSize: '13px',
                }}
              >
                {room.relay_status}
              </button>
            </div>

            <div style={{
              marginTop: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Relay: <span style={{ color: 'var(--text-primary)' }}>{room.relay_id}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Auto-shutdown:{' '}
                <span style={{
                  color: room.auto_shutdown ? 'var(--color-teal)' : 'var(--text-muted)'
                }}>
                  {room.auto_shutdown ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        ))}

        {rooms.length === 0 && (
          <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
            No rooms configured. Add rooms via the API or hardware setup.
          </div>
        )}
      </div>
    </div>
  );
}