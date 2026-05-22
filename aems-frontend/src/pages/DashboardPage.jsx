import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import api           from '../api/axiosConfig';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

// ── Metric card component
const MetricCard = ({ label, value, unit, color = 'var(--color-teal)', subtitle }) => (
  <div className="card" style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '12px', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '1px',
                  marginBottom: '8px' }}>
      {label}
    </div>
    <div style={{ fontSize: '32px', fontWeight: 'bold', color }}>
      {value ?? '--'}
      <span style={{ fontSize: '14px', marginLeft: '4px',
                     color: 'var(--text-secondary)' }}>
        {unit}
      </span>
    </div>
    {subtitle && (
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
        {subtitle}
      </div>
    )}
  </div>
);

export default function DashboardPage() {
  const { user }      = useAuth();
  const { connected, liveReading, alerts } = useSocket();

  const [billEstimate, setBillEstimate] = useState(null);
  const [chartData,    setChartData]    = useState([]);
  const [rooms,        setRooms]        = useState([]);

  // ── Load initial data ────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [billRes, todayRes, roomsRes] = await Promise.all([
          api.get('/api/bill/estimate'),
          api.get('/api/readings/today'),
          api.get('/api/rooms'),
        ]);

        setBillEstimate(billRes.data);
        setRooms(roomsRes.data.rooms || []);

        // Build chart data from today's readings
        const readings = todayRes.data.chart_data || [];
        const sampled  = readings.filter((_, i) => i % 12 === 0); // one per minute
        setChartData(sampled.map(r => ({
          time:  new Date(r.time).toLocaleTimeString('fr-CM', {
            hour: '2-digit', minute: '2-digit'
          }),
          power:   Math.round(r.power),
          voltage: Math.round(r.voltage),
          kwh:     r.energy_kwh,
        })));

      } catch (err) {
        console.error('Dashboard load error:', err.message);
      }
    };

    loadData();
  }, []);

  // ── Update chart when new live reading arrives ───────────
//   useEffect(() => {
//     if (!liveReading?.data?.main) return;

//     const main = liveReading.data.main;
//     const point = {
//       time:    new Date().toLocaleTimeString('fr-CM', {
//         hour: '2-digit', minute: '2-digit'
//       }),
//       power:   Math.round(main.power   || 0),
//       voltage: Math.round(main.voltage || 0),
//       kwh:     main.energy_kwh || 0,
//     };

//     setChartData(prev => [...prev.slice(-59), point]); // keep last 60 points
//   }, [liveReading]);

useEffect(() => {
    if (!liveReading?.data?.main) return;

    const appendPoint = () => {
      const main = liveReading.data.main;
      const point = {
        time: new Date().toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }),
        power:   Math.round(main.power   || 0),
        voltage: Math.round(main.voltage || 0),
        kwh:     main.energy_kwh || 0,
      };
      setChartData(prev => [...prev.slice(-59), point]);
    };

    // Queue the state modification cleanly outside the synchronous phase
    Promise.resolve().then(appendPoint);
  }, [liveReading]);

  const main = liveReading?.data?.main;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold' }}>
          Live Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          {user?.businessId || 'AEMS System'} ·{' '}
          <span style={{ color: connected ? 'var(--color-teal)' : 'var(--color-coral)' }}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </p>
      </div>

      {/* ── Live metric cards ─────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap:                 '12px',
        marginBottom:        '24px',
      }}>
        <MetricCard
          label="Voltage"
          value={main?.voltage?.toFixed(1)}
          unit="V"
          color={
            main?.voltage < 190 ? 'var(--color-coral)' :
            main?.voltage > 245 ? 'var(--color-coral)' :
            'var(--color-teal)'
          }
          subtitle="ENEO supply"
        />
        <MetricCard
          label="Current"
          value={main?.current?.toFixed(1)}
          unit="A"
          subtitle="Total draw"
        />
        <MetricCard
          label="Power"
          value={main?.power?.toFixed(0)}
          unit="W"
          subtitle="Active load"
        />
        <MetricCard
          label="Energy today"
          value={main?.energy_kwh?.toFixed(3)}
          unit="kWh"
          color="var(--color-amber)"
          subtitle={billEstimate
            ? `${billEstimate.current_cost_fcfa?.toLocaleString()} FCFA`
            : 'Calculating...'
          }
        />
        <MetricCard
          label="Frequency"
          value={main?.frequency?.toFixed(2)}
          unit="Hz"
          subtitle="AC frequency"
        />
        <MetricCard
          label="Power factor"
          value={main?.power_factor?.toFixed(2)}
          unit=""
          color={
            main?.power_factor < 0.8 ? 'var(--color-amber)' : 'var(--color-teal)'
          }
          subtitle="Efficiency"
        />
      </div>

      {/* ── Bill estimate banner ──────────────────────────── */}
      {billEstimate && (
        <div className="card" style={{
          marginBottom:  '24px',
          background:    'linear-gradient(135deg, #1a2f45, #1e3a52)',
          border:        '1px solid rgba(29,158,117,0.3)',
        }}>
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            flexWrap:       'wrap',
            gap:            '12px',
          }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Estimated ENEO bill — {billEstimate.period}
              </div>
              <div style={{
                fontSize:   '32px',
                fontWeight: 'bold',
                color:      'var(--color-teal)',
                marginTop:  '4px',
              }}>
                {billEstimate.projected_cost_fcfa?.toLocaleString()} FCFA
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Projected for full month · {billEstimate.days_remaining} days remaining
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Today so far</div>
              <div style={{
                fontSize:   '20px',
                fontWeight: 'bold',
                color:      'var(--color-amber)',
              }}>
                {billEstimate.current_cost_fcfa?.toLocaleString()} FCFA
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Two column layout: chart + rooms ─────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 300px',
        gap:                 '20px',
      }}>

        {/* Power chart */}
        <div className="card">
          <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>
            Power Consumption — Today
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: '#1e3a52',
                    border:     '1px solid rgba(255,255,255,0.1)',
                    borderRadius:'8px',
                    color:      '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke="var(--color-teal)"
                  strokeWidth={2}
                  dot={false}
                  name="Power (W)"
                />
                <Line
                  type="monotone"
                  dataKey="voltage"
                  stroke="var(--color-amber)"
                  strokeWidth={1.5}
                  dot={false}
                  name="Voltage (V)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height:         '220px',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          'var(--text-muted)',
              fontSize:       '14px',
            }}>
              {connected
                ? 'Waiting for first reading...'
                : 'No data — start simulator or connect hardware'
              }
            </div>
          )}
        </div>

        {/* Rooms status */}
        <div className="card">
          <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>
            Room Status
          </h3>
          {rooms.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rooms.map(room => (
                <div key={room.id} style={{
                  display:       'flex',
                  alignItems:    'center',
                  justifyContent:'space-between',
                  padding:       '10px 12px',
                  background:    'var(--bg-secondary)',
                  borderRadius:  '8px',
                  border:        `1px solid ${room.occupied
                    ? 'rgba(29,158,117,0.3)'
                    : 'rgba(255,255,255,0.05)'
                  }`,
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      {room.name}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: room.occupied
                        ? 'var(--color-teal)'
                        : 'var(--text-muted)',
                      marginTop: '2px',
                    }}>
                      {room.occupied ? '● Occupied' : '○ Empty'}
                    </div>
                  </div>
                  <div style={{
                    fontSize:     '12px',
                    fontWeight:   'bold',
                    padding:      '4px 10px',
                    borderRadius: '12px',
                    background:   room.relay_status === 'ON'
                      ? 'rgba(29,158,117,0.2)'
                      : 'rgba(100,116,139,0.2)',
                    color: room.relay_status === 'ON'
                      ? 'var(--color-teal)'
                      : 'var(--text-muted)',
                  }}>
                    {room.relay_status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              color:    'var(--text-muted)',
              fontSize: '13px',
              textAlign:'center',
              padding:  '20px 0',
            }}>
              No rooms configured yet
            </div>
          )}
        </div>
      </div>

      {/* ── Active alerts ─────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>
            Live Alerts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.slice(0, 3).map(alert => (
              <div key={alert.id} style={{
                padding:      '12px 16px',
                borderRadius: '8px',
                border:       `1px solid ${
                  alert.severity === 'urgent'
                    ? 'var(--color-coral)'
                    : 'var(--color-amber)'
                }`,
                background:   alert.severity === 'urgent'
                  ? 'rgba(216,90,48,0.1)'
                  : 'rgba(186,117,23,0.1)',
                fontSize:     '13px',
              }}>
                <span style={{
                  fontWeight: 'bold',
                  color: alert.severity === 'urgent'
                    ? 'var(--color-coral)'
                    : 'var(--color-amber)',
                }}>
                  {alert.severity === 'urgent' ? '🚨' : '⚠️'}{' '}
                  {alert.type?.replace(/_/g, ' ').toUpperCase()}
                </span>
                {alert.voltage && ` — ${alert.voltage}V detected`}
                {alert.kwh && ` — ${alert.kwh} kWh`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}