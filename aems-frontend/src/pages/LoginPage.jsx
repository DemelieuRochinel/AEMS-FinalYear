// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';

// export default function LoginPage() {
//   const [email,    setEmail]    = useState('');
//   const [password, setPassword] = useState('');
//   const [error,    setError]    = useState('');
//   const [loading,  setLoading]  = useState(false);

//   const { login }    = useAuth();
//   const navigate     = useNavigate();

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     try {
//       await login(email, password);
//       navigate('/');
//     } catch (err) {
//       setError(
//         err.response?.data?.message || 'Login failed. Check your credentials.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div style={{
//       minHeight:       '100vh',
//       background:      'var(--bg-primary)',
//       display:         'flex',
//       alignItems:      'center',
//       justifyContent:  'center',
//       padding:         '20px',
//     }}>
//       <div style={{ width: '100%', maxWidth: '400px' }}>

//         {/* Logo */}
//         <div style={{ textAlign: 'center', marginBottom: '40px' }}>
//           <div style={{
//             fontSize:   '40px',
//             marginBottom:'8px',
//           }}>⚡</div>
//           <h1 style={{
//             fontSize:   '28px',
//             fontWeight: 'bold',
//             color:      'var(--color-teal)',
//             margin:     '0 0 4px',
//           }}>
//             AEMS
//           </h1>
//           <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
//             Automated Energy Management System
//           </p>
//           <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
//             University of Buea — Cameroon
//           </p>
//         </div>

//         {/* Login card */}
//         <div className="card">
//           <h2 style={{
//             fontSize:     '18px',
//             marginBottom: '24px',
//             textAlign:    'center',
//           }}>
//             Sign in to your account
//           </h2>

//           {error && (
//             <div style={{
//               background:   'rgba(216,90,48,0.15)',
//               border:       '1px solid var(--color-coral)',
//               borderRadius: '8px',
//               padding:      '12px',
//               marginBottom: '16px',
//               fontSize:     '13px',
//               color:        'var(--color-coral)',
//             }}>
//               {error}
//             </div>
//           )}

//           <form onSubmit={handleLogin}>
//             <div style={{ marginBottom: '16px' }}>
//               <label style={{
//                 display:      'block',
//                 fontSize:     '13px',
//                 color:        'var(--text-secondary)',
//                 marginBottom: '6px',
//               }}>
//                 Email address
//               </label>
//               <input
//                 type="email"
//                 value={email}
//                 onChange={e => setEmail(e.target.value)}
//                 placeholder="your@email.com"
//                 required
//                 style={{
//                   width:        '100%',
//                   padding:      '10px 14px',
//                   background:   'var(--bg-secondary)',
//                   border:       '1px solid var(--border)',
//                   borderRadius: '8px',
//                   color:        'var(--text-primary)',
//                   fontSize:     '14px',
//                   outline:      'none',
//                 }}
//               />
//             </div>

//             <div style={{ marginBottom: '24px' }}>
//               <label style={{
//                 display:      'block',
//                 fontSize:     '13px',
//                 color:        'var(--text-secondary)',
//                 marginBottom: '6px',
//               }}>
//                 Password
//               </label>
//               <input
//                 type="password"
//                 value={password}
//                 onChange={e => setPassword(e.target.value)}
//                 placeholder="••••••••"
//                 required
//                 style={{
//                   width:        '100%',
//                   padding:      '10px 14px',
//                   background:   'var(--bg-secondary)',
//                   border:       '1px solid var(--border)',
//                   borderRadius: '8px',
//                   color:        'var(--text-primary)',
//                   fontSize:     '14px',
//                   outline:      'none',
//                 }}
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={loading}
//               className="btn btn-primary"
//               style={{ width: '100%', padding: '12px', fontSize: '15px' }}
//             >
//               {loading ? 'Signing in...' : 'Sign in'}
//             </button>
//           </form>
//         </div>

//         <p style={{
//           textAlign:  'center',
//           marginTop:  '20px',
//           fontSize:   '12px',
//           color:      'var(--text-muted)',
//         }}>
//           LEKEUGO DEMELIEU ROCHINEL — FE22A247
//         </p>
//       </div>
//     </div>
//   );
// }


import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axiosConfig';

export default function LoginPage() {
  const [mode,     setMode]     = useState('login');  // 'login' or 'register'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  // ── Input style ──────────────────────────────────────────
  const inputStyle = {
    width:        '100%',
    padding:      '10px 14px',
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color:        '#ffffff',
    fontSize:     '14px',
    outline:      'none',
    marginTop:    '6px',
  };

  const labelStyle = {
    display:   'block',
    fontSize:  '13px',
    color:     '#94a3b8',
  };

  // ── Handle Login ─────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Login failed. Check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Register ──────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/register', {
        name,
        email,
        password,
        role:        'owner',
        business_id: 'business_demo_001',
      });

      setSuccess('Account created! You can now log in.');
      setMode('login');
      setPassword('');

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error   ||
        'Registration failed. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:      '100vh',
      background:     '#0d1b2a',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '20px',
      fontFamily:     'Arial, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* ── Logo ──────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>⚡</div>
          <h1 style={{
            fontSize:   '28px',
            fontWeight: 'bold',
            color:      '#1D9E75',
            margin:     '0 0 4px',
          }}>
            AEMS
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>
            Automated Energy Management System
          </p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>
            University of Buea — Cameroon
          </p>
        </div>

        {/* ── Card ──────────────────────────────────────── */}
        <div style={{
          background:   '#1e3a52',
          border:       '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding:      '32px',
        }}>

          {/* ── Mode tabs ─────────────────────────────── */}
          <div style={{
            display:      'flex',
            background:   'rgba(0,0,0,0.2)',
            borderRadius: '10px',
            padding:      '4px',
            marginBottom: '28px',
          }}>
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                style={{
                  flex:         1,
                  padding:      '8px',
                  border:       'none',
                  borderRadius: '8px',
                  cursor:       'pointer',
                  fontSize:     '14px',
                  fontWeight:   mode === m ? 'bold' : 'normal',
                  background:   mode === m ? '#1D9E75' : 'transparent',
                  color:        mode === m ? '#ffffff' : '#94a3b8',
                  transition:   'all 0.2s',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* ── Error message ──────────────────────────── */}
          {error && (
            <div style={{
              background:   'rgba(216,90,48,0.15)',
              border:       '1px solid #D85A30',
              borderRadius: '8px',
              padding:      '12px 16px',
              marginBottom: '20px',
              fontSize:     '13px',
              color:        '#D85A30',
            }}>
              {error}
            </div>
          )}

          {/* ── Success message ────────────────────────── */}
          {success && (
            <div style={{
              background:   'rgba(29,158,117,0.15)',
              border:       '1px solid #1D9E75',
              borderRadius: '8px',
              padding:      '12px 16px',
              marginBottom: '20px',
              fontSize:     '13px',
              color:        '#1D9E75',
            }}>
              {success}
            </div>
          )}

          {/* ── LOGIN FORM ─────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width:        '100%',
                  padding:      '12px',
                  background:   loading ? '#0F6E56' : '#1D9E75',
                  border:       'none',
                  borderRadius: '10px',
                  color:        '#ffffff',
                  fontSize:     '15px',
                  fontWeight:   'bold',
                  cursor:       loading ? 'not-allowed' : 'pointer',
                  transition:   'background 0.2s',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── REGISTER FORM ──────────────────────────── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jean-Baptiste Mbarga"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>
                  Password
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                    minimum 8 characters
                  </span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width:        '100%',
                  padding:      '12px',
                  background:   loading ? '#3C3489' : '#534AB7',
                  border:       'none',
                  borderRadius: '10px',
                  color:        '#ffffff',
                  fontSize:     '15px',
                  fontWeight:   'bold',
                  cursor:       loading ? 'not-allowed' : 'pointer',
                  transition:   'background 0.2s',
                }}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <p style={{
                fontSize:  '12px',
                color:     '#64748b',
                textAlign: 'center',
                marginTop: '16px',
              }}>
                Your account will be linked to the demo business.
                Contact your administrator to link to your business.
              </p>
            </form>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <p style={{
          textAlign:  'center',
          marginTop:  '20px',
          fontSize:   '12px',
          color:      '#475569',
        }}>
          LEKEUGO DEMELIEU ROCHINEL — FE22A247
        </p>
      </div>
    </div>
  );
}