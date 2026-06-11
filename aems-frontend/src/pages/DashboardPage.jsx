import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
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

export default function DashboardPage() {
  const { user, business } = useAuth();
  const { connected, liveReading, alerts } = useSocket();

  const [bill, setBill] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/bill/estimate').catch(() => null),
      api.get('/api/readings/today').catch(() => null),
      api.get('/api/rooms').catch(() => null),
    ]).then(([b, t, r]) => {
      if (b) setBill(b.data);
      if (r) setRooms(r.data.rooms || []);
      if (t) {
        const sampled = (t.data.chart_data || []).filter((_, i) => i % 10 === 0);
        setChartData(sampled.map(item => ({
          time: new Date(item.time).toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }),
          power: Math.round(item.power || 0),
          voltage: Math.round(item.voltage || 0),
        })));
      }
    });
  }, []);

  useEffect(() => {
    if (!liveReading?.data?.main) return;
    const m = liveReading.data.main;
    setChartData(prev => [...prev.slice(-79), {
      time: new Date().toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }),
      power: Math.round(m.power || 0),
      voltage: Math.round(m.voltage || 0),
    }]);
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

        <div style={{
          fontSize: '11px',
          color: 'var(--text-2)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          padding: '6px 12px',
        }}>
          {new Date().toLocaleDateString('fr-CM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

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
      <div style={{ display: 'grid', gridTemplateColumns: 'window' !== typeof window && window.innerWidth < 900 ? '1fr' : '1fr 280px', gap: '20px' }} className="mb-24">

        {/* Chart Component Panel */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '18px' }}>
            Power Consumption Trend (Active Live Window)
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

        {/* Room Breakdowns Segment */}
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
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-1)' }}>
                    {room.name}
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
                  background: room.relay_status === 'ON' ? 'rgba(29,158,117,0.15)' : 'rgba(71,85,105,0.2)',
                  color: room.relay_status === 'ON' ? 'var(--teal)' : 'var(--text-2)',
                }}>
                  {room.relay_status}
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