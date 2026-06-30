import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#1D9E75', '#534AB7', '#D85A30', '#BA7517', '#185FA5'];

const StatCard = ({ label, value, unit, color = '#1D9E75', sub }) => (
  <div style={{
    background:   '#1e3a52',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding:      '20px',
    textAlign:    'center',
  }}>
    <div style={{ fontSize: '12px', color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '1px',
                  marginBottom: '8px' }}>
      {label}
    </div>
    <div style={{ fontSize: '28px', fontWeight: 'bold', color }}>
      {value ?? '--'}
      <span style={{ fontSize: '13px', marginLeft: '4px', color: '#94a3b8' }}>
        {unit}
      </span>
    </div>
    {sub && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{sub}</div>}
  </div>
);

export default function AnalyticsPage() {
  const [summary,  setSummary]  = useState([]);
  const [bill,     setBill]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [days,     setDays]     = useState(7);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sumRes, billRes] = await Promise.all([
          api.get(`/api/readings/summary?days=${days}`),
          api.get('/api/bill/estimate'),
        ]);
        setSummary(sumRes.data.summaries || []);
        setBill(billRes.data);
      } catch (err) {
        console.error('Analytics load error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  // Build pie chart data from summary
  const pieData = summary
    .filter(s => s.max_kwh > 0)
    .slice(-5)
    .map((s, i) => ({
      name:  s.date?.slice(5) || `Day ${i+1}`,
      value: parseFloat(s.max_kwh?.toFixed(2) || 0),
    }));

  const totalKwh  = summary.reduce((sum, s) => sum + (s.max_kwh || 0), 0);
  const totalCost = summary.reduce((sum, s) => sum + (s.cost_fcfa || 0), 0);
  const avgKwh    = summary.length > 0 ? totalKwh / summary.length : 0;
  const peakDay   = summary.reduce((max, s) =>
    (s.max_kwh || 0) > (max.max_kwh || 0) ? s : max, {}
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold' }}>Analytics</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Energy consumption analysis and reports
        </p>
      </div>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding:      '6px 18px',
              borderRadius: '20px',
              border:       'none',
              cursor:       'pointer',
              fontSize:     '13px',
              fontWeight:   days === d ? 'bold' : 'normal',
              background:   days === d ? '#1D9E75' : 'rgba(255,255,255,0.05)',
              color:        days === d ? '#fff' : '#94a3b8',
              transition:   'all 0.2s',
            }}
          >
            {d} days
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap:                 '12px',
        marginBottom:        '24px',
      }}>
        <StatCard
          label="Total consumption"
          value={totalKwh.toFixed(2)}
          unit="kWh"
          sub={`Last ${days} days`}
        />
        <StatCard
          label="Total cost"
          value={totalCost.toLocaleString()}
          unit="FCFA"
          color="#BA7517"
          sub="ENEO tariff applied"
        />
        <StatCard
          label="Daily average"
          value={avgKwh.toFixed(2)}
          unit="kWh/day"
          color="#534AB7"
          sub="Average per day"
        />
        <StatCard
          label="Projected bill"
          value={bill?.projected_cost_fcfa?.toLocaleString() || '--'}
          unit="FCFA"
          color="#D85A30"
          sub={`Full month ${bill?.period || ''}`}
        />
        <StatCard
          label="Peak day"
          value={peakDay.max_kwh?.toFixed(1) || '--'}
          unit="kWh"
          color="#185FA5"
          sub={peakDay.date || 'No data'}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px',
                      color: '#64748b', fontSize: '14px' }}>
          Loading analytics...
        </div>
      ) : (
        <>
          {/* Bar chart — daily consumption */}
          <div style={{
            background:   '#1e3a52',
            border:       '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding:      '20px',
            marginBottom: '20px',
          }}>
            <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>
              Daily Energy Consumption — Last {days} Days
            </h3>
            {summary.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={summary}>
                  <CartesianGrid strokeDasharray="3 3"
                                 stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={d => d?.slice(5) || ''}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background:   '#1a2f45',
                      border:       '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color:        '#fff',
                    }}
                    formatter={(value) => [
                      `${value} kWh`,
                      'Consumption'
                    ]}
                  />
                  <Bar dataKey="max_kwh" fill="#1D9E75"
                       radius={[4,4,0,0]} name="kWh" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px',
                            color: '#64748b', fontSize: '14px' }}>
                No consumption data yet. Run the simulator to generate data.
              </div>
            )}
          </div>

          {/* Two column: cost chart + pie */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:                 '20px',
            marginBottom:        '20px',
          }}>
            {/* Cost line chart */}
            <div style={{
              background:   '#1e3a52',
              border:       '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding:      '20px',
            }}>
              <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>
                Daily Cost (FCFA)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={summary}>
                  <CartesianGrid strokeDasharray="3 3"
                                 stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={d => d?.slice(5) || ''}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a2f45',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', color: '#fff',
                    }}
                    formatter={v => [`${v.toLocaleString()} FCFA`, 'Cost']}
                  />
                  <Line type="monotone" dataKey="cost_fcfa"
                        stroke="#BA7517" strokeWidth={2}
                        dot={false} name="FCFA" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart — recent days */}
            <div style={{
              background:   '#1e3a52',
              border:       '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding:      '20px',
            }}>
              <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>
                Distribution — Last 5 Days
              </h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}kWh`}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1a2f45',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px',
                              color: '#64748b', fontSize: '13px' }}>
                  No data for pie chart yet
                </div>
              )}
            </div>
          </div>

          {/* ENEO tariff info */}
          <div style={{
            background:   '#1e3a52',
            border:       '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding:      '20px',
          }}>
            <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>
              ENEO Tariff Structure — Cameroon
            </h3>
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap:                 '12px',
            }}>
              {[
                { tier: 'Tier 1', range: '0 – 110 kWh',    rate: '50 FCFA/kWh',
                  color: '#1D9E75', note: 'Basic consumption' },
                { tier: 'Tier 2', range: '111 – 400 kWh',  rate: '79 FCFA/kWh',
                  color: '#BA7517', note: 'Standard consumption' },
                { tier: 'Tier 3', range: '400+ kWh',        rate: '94 FCFA/kWh',
                  color: '#D85A30', note: 'High consumption' },
              ].map(t => (
                <div key={t.tier} style={{
                  background:   'rgba(0,0,0,0.2)',
                  borderRadius: '10px',
                  padding:      '16px',
                  borderLeft:   `4px solid ${t.color}`,
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold',
                                color: t.color, marginBottom: '4px' }}>
                    {t.tier}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold',
                                color: '#fff', marginBottom: '2px' }}>
                    {t.rate}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {t.range}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b',
                                marginTop: '4px' }}>
                    {t.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
