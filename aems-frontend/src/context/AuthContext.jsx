//  AUTH CONTEXT
//  Global authentication state — available everywhere in app

import { createContext,useState, useEffect } from 'react';
import api from '../api/axiosConfig';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Load user from localStorage on app start ─────────────
  useEffect(() => {
    const savedUser  = localStorage.getItem('aems_user');
    const savedToken = localStorage.getItem('aems_token');

setTimeout(() => {
      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    }, 0);
  }, []);
  
  // ── Login
  const login = async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    const { token, user: userData } = response.data;

    localStorage.setItem('aems_token', token);
    localStorage.setItem('aems_user',  JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  // ── Logout
  const logout = () => {
    localStorage.removeItem('aems_token');
    localStorage.removeItem('aems_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};


