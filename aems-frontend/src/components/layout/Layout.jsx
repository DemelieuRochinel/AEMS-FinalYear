import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }   from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';

const NAV = [
  { to: '/',          emoji: '📊', label: 'Dashboard'  },
  { to: '/rooms',     emoji: '🏠', label: 'Rooms'      },
  { to: '/alerts',    emoji: '🔔', label: 'Alerts'     },
  { to: '/analytics', emoji: '📈', label: 'Analytics'  },
  { to: '/settings',  emoji: '⚙️', label: 'Settings'   },
];

export default function Layout() {
  const { user, business, logout } = useAuth();
  const { connected }              = useSocket();
  const navigate                   = useNavigate();
  const [mobileOpen, setMobile]    = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const businessName = business?.name || user?.businessId || 'AEMS';

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(29,158,117,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', flexShrink: 0,
          }}>⚡</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--teal)', letterSpacing: '-0.3px' }}>
              AEMS
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-3)', marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Energy Management
            </div>
          </div>
        </div>

        {/* Business name */}
        <div style={{
          marginTop:    '12px',
          padding:      '8px 10px',
          background:   'var(--bg-input)',
          borderRadius: 'var(--r-md)',
          fontSize:     '12px',
          fontWeight:   '600',
          color:        'var(--text-2)',
          border:       '1px solid var(--border)',
        }}>
          🏢 {businessName}
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflow: 'auto' }}>
        {NAV.map(({ to, emoji, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMobile(false)}
            style={({ isActive }) => ({
              display:        'flex',
              alignItems:     'center',
              gap:            '10px',
              padding:        '10px 12px',
              borderRadius:   'var(--r-md)',
              marginBottom:   '3px',
              textDecoration: 'none',
              fontSize:       '13px',
              fontWeight:     isActive ? '700' : '400',
              color:          isActive ? 'var(--teal)' : 'var(--text-3)',
              background:     isActive ? 'var(--teal-dim)' : 'transparent',
              borderLeft:     isActive ? '3px solid var(--teal)' : '3px solid transparent',
              transition:     'all 0.15s',
            })}
          >
            <span style={{ fontSize: '16px' }}>{emoji}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 14px 20px', borderTop: '1px solid var(--border)' }}>
        {/* Connection */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '11px', fontWeight: '600',
          color: connected ? 'var(--teal)' : 'var(--coral)',
          marginBottom: '12px',
        }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: connected ? 'var(--teal)' : 'var(--coral)',
          }} />
          {connected ? 'Live connected' : 'Disconnected'}
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(29,158,117,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '700', color: 'var(--teal)', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: '13px', fontWeight: '600', color: 'var(--text-1)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{user?.role}</div>
          </div>
        </div>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: '12px', padding: '7px 12px' }}
        >
          ↪ Logout
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Desktop sidebar */}
      <aside style={{
        width:         '220px',
        flexShrink:    0,
        background:    'var(--bg-panel)',
        borderRight:   '1px solid var(--border)',
        display:       'flex',
        flexDirection: 'column',
      }}
        className="desktop-sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobile(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 100, display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Mobile top bar */}
        <div style={{
          display:      'none',
          padding:      '12px 16px',
          background:   'var(--bg-panel)',
          borderBottom: '1px solid var(--border)',
          alignItems:   'center',
          gap:          '12px',
        }} className="mobile-topbar">
          <button
            onClick={() => setMobile(!mobileOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '20px', cursor: 'pointer' }}
          >
            ☰
          </button>
          <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--teal)' }}>⚡ AEMS</span>
        </div>

        <main style={{ flex: 1, overflow: 'auto', padding: 'clamp(16px, 3vw, 32px)' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-overlay { display: block !important; }
        }
      `}</style>
    </div>
  );
}