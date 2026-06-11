import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

const severityConfig = {
  urgent:  { color: 'var(--coral)',  bg: 'rgba(216,90,48,0.08)',  border: 'rgba(216,90,48,0.2)',  icon: '🚨' },
  warning: { color: 'var(--amber)',  bg: 'rgba(186,117,23,0.08)', border: 'rgba(186,117,23,0.2)', icon: '⚠️' },
  info:    { color: 'var(--teal)',   bg: 'rgba(29,158,117,0.06)', border: 'rgba(29,158,117,0.15)',icon: 'ℹ️' },
};

export default function AlertsPage() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    api.get('/api/alerts/history?limit=50')
      .then(r => setAlerts(r.data.alerts || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const resolve = async (alertId) => {
    try {
      await api.patch(`/api/alerts/${alertId}/resolve`);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
    } catch (err) {
      console.error('Resolve failed:', err.message);
    }
  };

  const filtered = filter === 'all'
    ? alerts
    : filter === 'active'
    ? alerts.filter(a => !a.resolved)
    : alerts.filter(a => a.severity === filter);

  const counts = {
    active:  alerts.filter(a => !a.resolved).length,
    urgent:  alerts.filter(a => a.severity === 'urgent').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info:    alerts.filter(a => a.severity === 'info').length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700' }}>Alerts</h1>
        <p style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '4px' }}>
          {counts.active} active · {alerts.length} total
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap:                 '12px',
        marginBottom:        '20px',
      }}>
        {[
          { label: 'Active alerts', value: counts.active,  color: 'var(--coral)',  key: 'active'  },
          { label: 'Urgent',        value: counts.urgent,  color: 'var(--coral)',  key: 'urgent'  },
          { label: 'Warnings',      value: counts.warning, color: 'var(--amber)',  key: 'warning' },
          { label: 'Info',          value: counts.info,    color: 'var(--teal)',   key: 'info'    },
        ].map(s => (
          <div
            key={s.key}
            onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
            style={{
              background:    'var(--bg-card)',
              border:        `1px solid ${filter === s.key ? s.color : 'var(--border)'}`,
              borderRadius:  'var(--radius-lg)',
              padding:       '16px',
              textAlign:     'center',
              cursor:        'pointer',
              transition:    'border-color 0.15s',
            }}
          >
            <div style={{ fontSize: '26px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['all', 'active', 'urgent', 'warning', 'info'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding:      '5px 14px',
              borderRadius: '20px',
              border:       'none',
              cursor:       'pointer',
              fontSize:     '12px',
              fontWeight:   filter === f ? '600' : '400',
              background:   filter === f ? 'var(--teal)' : 'var(--bg-card)',
              color:        filter === f ? '#fff' : 'var(--text-3)',
              transition:   'all 0.15s',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
          Loading alerts...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(alert => {
            const cfg = severityConfig[alert.severity] || severityConfig.info;
            return (
              <div key={alert.id} style={{
                background:   cfg.bg,
                border:       `1px solid ${cfg.border}`,
                borderRadius: 'var(--radius-lg)',
                padding:      '14px 16px',
                display:      'flex',
                justifyContent:'space-between',
                alignItems:   'flex-start',
                opacity:      alert.resolved ? 0.5 : 1,
                transition:   'opacity 0.2s',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize:     '10px',
                      fontWeight:   '700',
                      padding:      '2px 8px',
                      borderRadius: '10px',
                      background:   `${cfg.color}22`,
                      color:        cfg.color,
                      textTransform:'uppercase',
                      letterSpacing:'0.5px',
                    }}>
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {new Date(alert.timestamp).toLocaleString('fr-CM')}
                    </span>
                    {alert.resolved && (
                      <span style={{
                        fontSize:     '10px',
                        color:        'var(--teal)',
                        padding:      '2px 8px',
                        borderRadius: '10px',
                        background:   'rgba(29,158,117,0.1)',
                      }}>
                        ✓ Resolved
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-1)', marginBottom: '4px', fontWeight: '500' }}>
                    {alert.message}
                  </div>

                  {(alert.value || alert.threshold) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {alert.value && `Value: ${alert.value}`}
                      {alert.threshold && ` · Threshold: ${alert.threshold}`}
                      {alert.room_name && ` · Room: ${alert.room_name}`}
                    </div>
                  )}
                </div>

                {!alert.resolved && (
                  <button
                    onClick={() => resolve(alert.id)}
                    style={{
                      marginLeft:   '14px',
                      padding:      '6px 14px',
                      background:   'transparent',
                      border:       `1px solid var(--border-md)`,
                      borderRadius: 'var(--radius-sm)',
                      color:        'var(--text-3)',
                      fontSize:     '11px',
                      fontWeight:   '600',
                      cursor:       'pointer',
                      flexShrink:   0,
                      transition:   'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.target.style.color = 'var(--teal)';
                      e.target.style.borderColor = 'var(--teal)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.color = 'var(--text-3)';
                      e.target.style.borderColor = 'var(--border-md)';
                    }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{
              textAlign:  'center',
              padding:    '60px 20px',
              color:      'var(--text-3)',
              fontSize:   '14px',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              {filter === 'all' ? 'No alerts — system running perfectly' : `No ${filter} alerts`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}