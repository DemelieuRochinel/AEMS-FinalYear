import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

export default function AlertsPage() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/alerts/history?limit=50')
      .then(res => setAlerts(res.data.alerts || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const resolveAlert = async (alertId) => {
    try {
      await api.patch(`/api/alerts/${alertId}/resolve`);
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, resolved: true } : a
      ));
    } catch (err) {
      console.error('Resolve failed:', err.message);
    }
  };

  const severityColor = (s) =>
    s === 'urgent' ? 'var(--color-coral)' :
    s === 'warning'? 'var(--color-amber)' : 'var(--color-teal)';

  if (loading) return (
    <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
      Loading alerts...
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: '22px', marginBottom: '8px' }}>Alerts</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
        {alerts.filter(a => !a.resolved).length} active ·{' '}
        {alerts.length} total
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.map(alert => (
          <div key={alert.id} className="card" style={{
            borderLeft: `4px solid ${severityColor(alert.severity)}`,
            opacity: alert.resolved ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: `${severityColor(alert.severity)}22`,
                    color: severityColor(alert.severity),
                    textTransform: 'uppercase',
                  }}>
                    {alert.severity}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(alert.timestamp).toLocaleString('fr-CM')}
                  </span>
                </div>
                <p style={{ fontSize: '14px', margin: '0' }}>{alert.message}</p>
                {alert.value && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Value: {alert.value} · Threshold: {alert.threshold}
                  </p>
                )}
              </div>
              {!alert.resolved && (
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '4px 12px', marginLeft: '12px' }}
                >
                  Resolve
                </button>
              )}
              {alert.resolved && (
                <span style={{ fontSize: '12px', color: 'var(--color-teal)', marginLeft: '12px' }}>
                  ✓ Resolved
                </span>
              )}
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div>No alerts — your system is running perfectly</div>
          </div>
        )}
      </div>
    </div>
  );
}