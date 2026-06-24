import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axiosConfig';
import { provisionApi } from '../api/provisionApi';
import { SetupCodeModal } from '../components/SetupCodeModal';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(1);
  
  // Step 1 Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Step 2 Fields
  const [bizName, setBizName] = useState('');
  const [business_type, setBusiness_type] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');

  // Step 3 Fields
  const [devicename, setDeviceName] = useState('');

  // Status indicators
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Setup Code Modal State ──
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupData, setSetupData] = useState({
    deviceName: '',
    deviceId: '',
    setupCode: '',
    businessId: ''
  });

  const { login } = useAuth();
  const navigate = useNavigate();

  // ── Styles ──
  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: '#223a54',
    border: '1px solid #36506c',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    marginTop: '9px',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'left',
    marginTop: '12px'
  };

  const secondaryBtnStyle = {
    flex: 1,
    padding: '12px',
    background: '#223a54',
    border: '1px solid #36506c',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginRight: '8px'
  };

  // ── Handle Login ──
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Incorrect Credentials');
    } finally {
      setLoading(false);
    }
  };

  // ── Wizard Step Navigation ──
  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!name.trim() || !email.trim() || !password) return setError('User Information is Required.');
      if (password.length < 8) return setError('Password must be at least 8 characters');
      setStep(2);
    } else if(step === 2){
      if (!bizName.trim() || !business_type.trim() || !location.trim()) return setError('Business name, type, and location are required.');
      setStep(3);
    }
  };

  const prevStep = () => {
    setError('');
    setStep((prev) => prev - 1);
  };

  // ── Handle Register Submission ──
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if(!devicename.trim()){
      setError('Please fill the device name!');
      return;
    }
    setLoading(true);

    try {
      // Step 1: Create business
      const generatedBizId = 'biz_' + Date.now();
      await api.post('/api/business/create', {
        business_id: generatedBizId,
        name: bizName.trim(),
        owner_name: name.trim(),
        owner_email: email.trim(),
        owner_phone: phone.trim(),
        location: location.trim(),
        business_type: business_type.trim(),
      });

      // Step 2: Create user
      await api.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        business_id: generatedBizId,
      });

      // Step 3: Login to get token (needed for generating setup code)
      await login(email, password);
      
      // Step 4: Create device
      const generatedDeviceId = 'dev_' + Date.now();
      await api.post('/api/device/NewDevice', {
        deviceId: generatedDeviceId,
        businessId: generatedBizId,
        name: devicename
      });

      // ── Generate setup code automatically ──
      const setupResult = await provisionApi.generateSetupCode(generatedDeviceId);
      
      // ── Show setup code modal ──
      setSetupData({
        deviceName: devicename,
        deviceId: generatedDeviceId,
        setupCode: setupResult.setup_code,
        businessId: generatedBizId
      });
      setShowSetupModal(true);
      
      setSuccess('Account created successfully! Your ESP32 is ready to be configured.');

      // Clear form fields
      setPassword(''); 
      setName(''); 
      setEmail(''); 
      setBizName('');
      setPhone(''); 
      setLocation(''); 
      setBusiness_type(''); 
      setDeviceName('');
      
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Setup Modal Close - Navigate to Success Page ──
  const handleSetupModalClose = () => {
    setShowSetupModal(false);
    // Navigate to the success page with the device data
    navigate('/registration-success', { 
      state: {
        deviceName: setupData.deviceName,
        deviceId: setupData.deviceId,
        setupCode: setupData.setupCode,
        businessId: setupData.businessId
      }
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: '100vh',
      width: '100vw',
      background: '#0e1b29',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px',
        margin: 'auto', 
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ── Header Branding ── */}
        <div style={{ textAlign: 'center', marginBottom: '24px', width: '100%' }}>
          <svg width="45" height="70" viewBox="0 0 24 38" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '12px', display: 'inline-block' }}>
            <defs>
              <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <path d="M13 0L1 21H11V38L23 17H13V0Z" fill="url(#boltGrad)" />
          </svg>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: '0 0 6px', letterSpacing: '1px' }}>AEMS</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0' }}>Automated Energy Management System</p>
        </div>

        {/* ── Main Container Card ── */}
        <div style={{ 
          background: '#182a3d', 
          border: '1px solid #243b54', 
          borderRadius: '12px', 
          padding: '24px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          
          {/* ── View Selection Tabs ── */}
          <div style={{ display: 'flex', background: '#111e2e', borderRadius: '8px', padding: '4px', marginBottom: '20px' }}>
            {['login', 'register'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setStep(1); setError(''); setSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  background: mode === m ? '#10b981' : 'transparent',
                  color: mode === m ? '#ffffff' : '#4b5d73',
                  transition: 'all 0.15s ease',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* ── Step Indicators ── */}
          {mode === 'register' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 32px' }}>
              {[1, 2, 3].map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s !== 3 ? 1 : 'none' }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', 
                    background: step >= s ? '#10b981' : '#223a54',
                    color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 'bold', border: step === s ? '2px solid #34d399' : 'none'
                  }}>
                    {s}
                  </div>
                  {s !== 3 && <div style={{ flex: 1, height: '2px', background: step > s ? '#10b981' : '#223a54', margin: '0 12px' }} />}
                </div>
              ))}
            </div>
          )}

          {/* ── Notification Banners ── */}
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '6px', padding: '10px', marginBottom: '16px', fontSize: '13px', color: '#f87171', textAlign: 'left' }}>{error}</div>}
          {success && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '6px', padding: '10px', marginBottom: '16px', fontSize: '13px', color: '#34d399', textAlign: 'left' }}>{success}</div>}

          {/* ── Login Form ── */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div>
                <label style={{ ...labelStyle, marginTop: '0px' }}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required style={inputStyle} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={inputStyle} />
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#10b981', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              
              {/* Step 1: Personal Information */}
              {step === 1 && (
                <div>
                  <h3 style={{ color: '#ffffff', fontSize: '15px', margin: '0 0 4px', textAlign: 'center' }}>Personal Information</h3>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 12px', textAlign: 'center' }}>Set up your master administrative credentials.</p>
                  
                  <label style={{ ...labelStyle, marginTop: '0px' }}>Your full name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Rochinel lekeugo" style={inputStyle} />
                  
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E@mail.com" style={inputStyle} />
                  
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" style={inputStyle} />
                  
                  <button type="button" onClick={nextStep} style={{ width: '100%', padding: '12px', background: '#10b981', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '20px' }}>
                    Continue to Business Setup
                  </button>
                </div>
              )}

              {/* Step 2: Business Profile */}
              {step === 2 && (
                <div>
                  <h3 style={{ color: '#ffffff', fontSize: '15px', margin: '0 0 4px', textAlign: 'center' }}>Business Profile</h3>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 12px', textAlign: 'center' }}>Provide your operation environment details.</p>
                  
                  <label style={{ ...labelStyle, marginTop: '0px' }}>Business name</label>
                  <input type="text" value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Enterprise" style={inputStyle} />
                  
                  <label style={labelStyle}>Business type</label>
                  <input type="text" value={business_type} onChange={e => setBusiness_type(e.target.value)} placeholder="Small factory, etc." style={inputStyle} />
                  
                  <label style={labelStyle}>Business location</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Douala, Cameroon" style={inputStyle} />
                  
                  <label style={labelStyle}>Phone number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237 691 234 567" style={inputStyle} />
                  
                  <div style={{ display: 'flex', marginTop: '20px' }}>
                    <button type="button" onClick={prevStep} disabled={loading} style={secondaryBtnStyle}>Back</button>
                    <button type="button" onClick={nextStep} style={{ flex: 1, padding: '12px', background: '#10b981', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
                      Device Setup
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Device Profile */}
              {step === 3 && (
                <div>
                  <h3 style={{ color: '#ffffff', fontSize: '15px', margin: '0 0 4px', textAlign: 'center' }}>Device Profile</h3>

                  <label style={{ ...labelStyle, marginTop: '0px' }}>Device Name</label>
                  <input type="text" value={devicename} onChange={e => setDeviceName(e.target.value)} placeholder="ESP32..." style={inputStyle} />

                  <div style={{ display: 'flex', marginTop: '20px' }}>
                    <button type="button" onClick={prevStep} disabled={loading} style={secondaryBtnStyle}>Back</button>
                    <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', background: '#10b981', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                      {loading ? 'Creating Account...' : 'Complete Registration'}
                    </button>
                  </div>
                </div>
              )}

            </form>
          )}

        </div>
      </div>

      {/* ── Setup Code Modal ── */}
      {showSetupModal && (
        <SetupCodeModal
          deviceName={setupData.deviceName}
          deviceId={setupData.deviceId}
          setupCode={setupData.setupCode}
          businessId={setupData.businessId}
          onClose={handleSetupModalClose}
        />
      )}
    </div>
  );
}