import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import {
  MdDashboard, MdMeetingRoom, MdNotifications,
  MdBarChart, MdSettings, MdLogout, MdWifi, MdWifiOff
} from 'react-icons/md';

const navItems = [
  { to: '/',          icon: MdDashboard,     label: 'Dashboard'  },
  { to: '/rooms',     icon: MdMeetingRoom,   label: 'Rooms'      },
  { to: '/alerts',    icon: MdNotifications, label: 'Alerts'     },
  { to: '/analytics', icon: MdBarChart,      label: 'Analytics'  },
  { to: '/settings',  icon: MdSettings,      label: 'Settings'   },
];

export default function Layout() {
  const { user, logout }  = useAuth();
  const { connected }     = useSocket();
  const navigate          = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside style={{
        width:      '220px',
        background: 'var(--bg-secondary)',
        borderRight:'1px solid var(--border)',
        display:    'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px' }}>
          <div style={{
            fontSize:   '18px',
            fontWeight: 'bold',
            color:      'var(--color-teal)',
          }}>
            ⚡ AEMS
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Energy Management
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0 12px' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display:       'flex',
                alignItems:    'center',
                gap:           '10px',
                padding:       '10px 12px',
                borderRadius:  '8px',
                marginBottom:  '4px',
                textDecoration:'none',
                fontSize:      '14px',
                fontWeight:    isActive ? 'bold' : 'normal',
                background:    isActive ? 'rgba(29,158,117,0.15)' : 'transparent',
                color:         isActive ? 'var(--color-teal)' : 'var(--text-secondary)',
                transition:    'all 0.15s',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + connection status */}
        <div style={{
          padding:    '16px 20px',
          borderTop:  '1px solid var(--border)',
        }}>
          {/* Connection indicator */}
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '6px',
            fontSize:   '12px',
            color:      connected ? 'var(--color-teal)' : 'var(--color-coral)',
            marginBottom:'12px',
          }}>
            {connected
              ? <><MdWifi size={14} /> Live connected</>
              : <><MdWifiOff size={14} /> Disconnected</>
            }
          </div>

          {/* User info */}
          <div style={{ fontSize: '13px', marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold' }}>{user?.name || 'User'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {user?.role}
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '6px',
              background: 'transparent',
              border:     '1px solid var(--border)',
              borderRadius:'6px',
              color:      'var(--text-secondary)',
              padding:    '6px 12px',
              cursor:     'pointer',
              fontSize:   '12px',
              width:      '100%',
            }}
          >
            <MdLogout size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <main style={{
        flex:       1,
        overflow:   'auto',
        padding:    '24px',
      }}>
        <Outlet />
      </main>

    </div>
  );
}