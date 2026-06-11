// AUTH CONTEXT
// Global authentication state — available everywhere in app

import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axiosConfig';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch business profile
  const fetchBusiness = async () => {
    try {
      const res = await api.get('/api/business/profile');

      if (res.data?.business) {
        setBusiness(res.data.business);
      }
    } catch (error) {
      console.error('Failed to fetch business profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Restore auth state on page refresh
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedUser = localStorage.getItem('aems_user');
        const savedToken = localStorage.getItem('aems_token');

        if (savedUser && savedToken) {
          const parsedUser = JSON.parse(savedUser);

          setUser(parsedUser);

          // Load associated business
          await fetchBusiness();
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error restoring auth state:', error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login
  const login = async (email, password) => {
    const response = await api.post('/api/auth/login', {
      email,
      password,
    });

    const { token, user: userData } = response.data;

    localStorage.setItem('aems_token', token);
    localStorage.setItem('aems_user', JSON.stringify(userData));

    setUser(userData);

    // Load business after successful login
    await fetchBusiness();

    return userData;
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('aems_token');
    localStorage.removeItem('aems_user');

    setUser(null);
    setBusiness(null);
  };

  // Update business locally
  const updateBusiness = (updates) => {
    setBusiness((prev) =>
      prev ? { ...prev, ...updates } : prev
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        loading,
        login,
        logout,
        fetchBusiness,
        updateBusiness,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook
export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return ctx;
};